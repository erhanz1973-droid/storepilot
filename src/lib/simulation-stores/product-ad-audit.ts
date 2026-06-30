import type { StoreSnapshot, MetaCampaign } from "@/lib/connectors/types";
import { buildCustomerJourneys } from "@/lib/attribution/journeys";
import { synthesizeAttributionEvents } from "@/lib/attribution/touchpoints";
import { classifyCampaignObjective } from "@/lib/meta/campaign-objectives";
import type {
  AuditCheckStatus,
  CampaignSuccessAudit,
  ProductAdAuditResult,
  ProductAdSalesAudit,
  SimulationAuditCheck,
} from "./audit-types";

function roas(spend: number, revenue: number): number {
  if (spend <= 0) return 0;
  return Math.round((revenue / spend) * 100) / 100;
}

function near(a: number, b: number, tolerancePct = 0.05): boolean {
  if (b === 0) return a === 0;
  return Math.abs(a - b) / Math.abs(b) <= tolerancePct;
}

function campaignSuccessVerdict(
  campaign: MetaCampaign,
): { status: AuditCheckStatus; detail: string } {
  const objective = classifyCampaignObjective(campaign);
  const roas7d = campaign.roas7d ?? roas(campaign.spend7d, campaign.revenue7d);

  if (objective === "brand_awareness" || objective === "reach") {
    const cpm =
      campaign.impressions7d > 0
        ? (campaign.spend7d / campaign.impressions7d) * 1000
        : 0;
    if (campaign.impressions7d < 3000 && campaign.spend7d > 50) {
      return { status: "fail", detail: `Low impressions (${campaign.impressions7d}) for awareness goal` };
    }
    if (cpm > 40) {
      return { status: "warn", detail: `CPM $${cpm.toFixed(2)} — elevated for awareness` };
    }
    if (campaign.frequency7d > 5) {
      return { status: "warn", detail: `Frequency ${campaign.frequency7d} — audience fatigue risk` };
    }
    return { status: "pass", detail: `Awareness delivery healthy — CPM $${cpm.toFixed(2)}, freq ${campaign.frequency7d}` };
  }

  if (objective === "video_views") {
    const views = campaign.videoViews7d ?? 0;
    const thru = campaign.thruPlay7d ?? 0;
    const cpv = views > 0 ? campaign.spend7d / views : 0;
    if (views === 0 && campaign.spend7d > 50) {
      return { status: "fail", detail: "No video views despite spend" };
    }
    if (cpv > 0.2) {
      return { status: "warn", detail: `Cost per view $${cpv.toFixed(2)} — above benchmark` };
    }
    if (views > 0 && thru / views < 0.15) {
      return { status: "warn", detail: `Completion rate ${((thru / views) * 100).toFixed(0)}% — weak ThruPlay` };
    }
    return { status: "pass", detail: `Video performance OK — ${views} views, CPV $${cpv.toFixed(2)}` };
  }

  if (objective === "leads") {
    const leads = campaign.leads7d ?? 0;
    const cpl = leads > 0 ? campaign.spend7d / leads : 0;
    if (leads === 0 && campaign.spend7d > 75) {
      return { status: "fail", detail: "No leads generated" };
    }
    if (cpl > 70) {
      return { status: "warn", detail: `CPL $${cpl.toFixed(2)} — above benchmark` };
    }
    return { status: "pass", detail: `Lead gen OK — ${leads} leads, CPL $${cpl.toFixed(2)}` };
  }

  if (roas7d < 1) return { status: "fail", detail: `ROAS ${roas7d}x — spend not paying back` };
  if (roas7d < 2) return { status: "warn", detail: `ROAS ${roas7d}x — marginal` };
  if (campaign.ctr7d != null && campaign.ctr7d < 1 && (campaign.frequency7d ?? 0) > 3) {
    return { status: "warn", detail: `ROAS ${roas7d}x — marginal, CTR ${campaign.ctr7d}%` };
  }
  return { status: "pass", detail: `ROAS ${roas7d}x — healthy return on ad spend` };
}

function adsToSalesVerdict(
  unitsSold30d: number,
  allocatedAdSpend7d: number,
  productRoas7d: number,
  revenueMatchesUnits: boolean,
): AuditCheckStatus {
  if (!revenueMatchesUnits) return "fail";
  if (allocatedAdSpend7d > 50 && unitsSold30d === 0) return "fail";
  if (allocatedAdSpend7d > 100 && productRoas7d < 1) return "fail";
  if (allocatedAdSpend7d > 50 && productRoas7d < 1.5) return "warn";
  if (unitsSold30d > 0 && allocatedAdSpend7d > 0) return "pass";
  if (unitsSold30d > 0 && allocatedAdSpend7d === 0) return "pass";
  return "warn";
}

function auditMetaCampaigns(campaigns: MetaCampaign[]): CampaignSuccessAudit[] {
  return campaigns.map((c) => {
    const computedRoas = roas(c.spend7d, c.revenue7d);
    const roas7d = c.roas7d ?? computedRoas;
    const { status: verdict, detail } = campaignSuccessVerdict(c);
    return {
      campaignId: c.id,
      campaignName: c.name,
      platform: "meta",
      spend7d: c.spend7d,
      revenue7d: c.revenue7d,
      roas7d,
      ctr7d: c.ctr7d,
      frequency7d: c.frequency7d,
      successVerdict: verdict,
      detail,
    };
  });
}

function auditGoogleCampaigns(snapshot: StoreSnapshot): CampaignSuccessAudit[] {
  const google = snapshot.googleAdsSnapshot;
  if (!google?.campaigns.length) return [];

  return google.campaigns.map((c) => {
    const roas7d = c.roas7d ?? roas(c.spend7d, c.revenue7d);
    const metaLike: MetaCampaign = {
      id: c.id,
      name: c.name,
      status: c.status ?? "ACTIVE",
      effectiveStatus: "ACTIVE",
      metaEffectiveStatus: "ACTIVE",
      spend7d: c.spend7d,
      revenue7d: c.revenue7d,
      roas7d,
      ctr7d:
        c.impressions7d > 0 ? Math.round((c.clicks7d / c.impressions7d) * 10000) / 100 : 0,
      frequency7d: 0,
      impressions7d: c.impressions7d,
      clicks7d: c.clicks7d,
      conversions7d: c.conversions7d,
      objective: c.type === "video" ? "VIDEO_VIEWS" : "OUTCOME_SALES",
    };
    const { status: verdict, detail } = campaignSuccessVerdict(metaLike);
    return {
      campaignId: c.id,
      campaignName: c.name,
      platform: "google",
      spend7d: c.spend7d,
      revenue7d: c.revenue7d,
      roas7d,
      successVerdict: verdict,
      detail,
    };
  });
}

/** Ürün bazında reklam → satış yansıması ve kampanya başarı denetimi. */
export function auditProductAdAttribution(snapshot: StoreSnapshot): ProductAdAuditResult {
  const checks: SimulationAuditCheck[] = [];

  const metaSpend7d = snapshot.metaAccountRollups?.last7d.spend ?? 0;
  const googleSpend7d = snapshot.googleAdsSnapshot?.rollups.last7d.spend ?? 0;
  const totalAdSpend7d = metaSpend7d + googleSpend7d;

  const events =
    snapshot.attributionEvents ??
    synthesizeAttributionEvents(
      snapshot.campaigns,
      snapshot.storeMetrics.revenue30d,
      snapshot.storeMetrics.orders30d,
    );

  const journeys = buildCustomerJourneys(events);
  const attributedOrderRevenue = journeys.reduce((s, j) => s + j.orderValue, 0);
  const attributedOrderCount = journeys.length;

  const storeRevenue30d = snapshot.storeMetrics.revenue30d;
  checks.push({
    id: "attribution_revenue",
    label: "Attributed orders → store revenue",
    status: near(attributedOrderRevenue, storeRevenue30d, 0.35) ? "pass" : "warn",
    detail: `Journeys $${attributedOrderRevenue.toFixed(0)} vs store $${storeRevenue30d.toFixed(0)} (${attributedOrderCount} orders)`,
  });

  const paidJourneys = journeys.filter((j) =>
    j.touchpoints.some((t) => t.channelId === "meta_ads" || t.channelId === "google_ads"),
  );
  const paidRevenue = paidJourneys.reduce((s, j) => s + j.orderValue, 0);
  checks.push({
    id: "paid_attribution",
    label: "Paid ads → attributed sales",
    status:
      totalAdSpend7d > 0 && paidRevenue > 0
        ? "pass"
        : totalAdSpend7d > 0
          ? "fail"
          : "warn",
    detail:
      totalAdSpend7d > 0
        ? `$${paidRevenue.toFixed(0)} revenue from ${paidJourneys.length} paid-attributed orders`
        : "No ad spend in snapshot",
  });

  const totalProductRevenue = snapshot.products.reduce((s, p) => s + (p.revenue30d ?? 0), 0);
  const products: ProductAdSalesAudit[] = snapshot.products.map((p) => {
    const expectedRevenue = Math.round(p.price * p.unitsSold30d * 100) / 100;
    const revenueMatchesUnits = near(p.revenue30d ?? 0, expectedRevenue, 0.02);
    const revenueShare =
      totalProductRevenue > 0 ? (p.revenue30d ?? 0) / totalProductRevenue : 0;
    const allocatedAdSpend7d = Math.round(totalAdSpend7d * revenueShare * 100) / 100;
    const revenue7d =
      snapshot.productOrderStats?.[p.id]?.last7d.revenue ??
      Math.round((p.revenue30d ?? 0) * 0.28 * 100) / 100;
    const productRoas7d = roas(allocatedAdSpend7d, revenue7d);
    const verdict = adsToSalesVerdict(
      p.unitsSold30d,
      allocatedAdSpend7d,
      productRoas7d,
      revenueMatchesUnits,
    );

    let detail: string;
    if (!revenueMatchesUnits) {
      detail = `Revenue $${p.revenue30d} ≠ price×units ($${expectedRevenue})`;
    } else if (allocatedAdSpend7d > 0 && p.unitsSold30d === 0) {
      detail = `$${allocatedAdSpend7d.toFixed(0)} ad share allocated but 0 units sold`;
    } else if (allocatedAdSpend7d > 0) {
      detail = `${p.unitsSold30d} units · $${revenue7d.toFixed(0)} rev (7d) · ROAS ${productRoas7d}x · $${allocatedAdSpend7d.toFixed(0)} ad share`;
    } else {
      detail = `${p.unitsSold30d} units · $${(p.revenue30d ?? 0).toFixed(0)} revenue (30d)`;
    }

    return {
      productId: p.id,
      productTitle: p.title,
      unitsSold30d: p.unitsSold30d,
      revenue30d: p.revenue30d ?? 0,
      revenue7d,
      allocatedAdSpend7d,
      productRoas7d,
      revenueMatchesUnits,
      adsToSalesVerdict: verdict,
      detail,
    };
  });

  const campaigns = [
    ...auditMetaCampaigns(snapshot.campaigns),
    ...auditGoogleCampaigns(snapshot),
  ];

  const failingCampaigns = campaigns.filter((c) => c.successVerdict === "fail");
  const failingProducts = products.filter((p) => p.adsToSalesVerdict === "fail");

  if (campaigns.length > 0) {
    const avgRoas =
      campaigns.reduce((s, c) => s + c.roas7d, 0) / campaigns.length;
    checks.push({
      id: "campaign_success",
      label: "Campaign ad success (avg ROAS)",
      status:
        failingCampaigns.length > campaigns.length / 2
          ? "fail"
          : failingCampaigns.length > 0
            ? "warn"
            : "pass",
      detail: `${campaigns.length} campaigns · avg ROAS ${avgRoas.toFixed(2)}x · ${failingCampaigns.length} failing`,
    });
  }

  if (products.length > 0 && totalAdSpend7d > 0) {
    const hero = [...products].sort((a, b) => b.revenue30d - a.revenue30d)[0];
    checks.push({
      id: "hero_product_ads",
      label: `Top SKU ad → sales (${hero.productTitle})`,
      status: hero.adsToSalesVerdict,
      detail: hero.detail,
    });
  }

  if (failingProducts.length > 0) {
    checks.push({
      id: "product_ad_mismatch",
      label: "Products with ad/sales mismatch",
      status: "fail",
      detail: failingProducts.map((p) => p.productTitle).join(", "),
    });
  }

  return {
    products,
    campaigns,
    checks,
    attributedOrderRevenue,
    attributedOrderCount,
  };
}
