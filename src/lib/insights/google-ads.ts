import type { StoreSnapshot } from "@/lib/connectors/types";
import type { ProfitDashboard } from "@/lib/profit/types";
import type { GoogleAdsCampaign } from "@/lib/integrations/types";
import { buildBusinessFirstInsight } from "@/lib/metrics/hierarchy";
import { createCommerceOpportunity } from "./opportunity-schema";
import type { CommerceOpportunity } from "./opportunity-schema";

const ROAS_TARGET = 1.5;

function isBranded(name: string): boolean {
  return /brand|branded|trademark|official/i.test(name);
}

function accountAverages(campaigns: GoogleAdsCampaign[]) {
  const active = campaigns.filter((c) => c.spend7d > 0);
  const totalSpend = active.reduce((s, c) => s + c.spend7d, 0);
  const totalConv = active.reduce((s, c) => s + c.conversions7d, 0);
  const totalClicks = active.reduce((s, c) => s + c.clicks7d, 0);
  const totalRev = active.reduce((s, c) => s + c.revenue7d, 0);
  return {
    cpa: totalConv > 0 ? totalSpend / totalConv : totalSpend,
    cpc: totalClicks > 0 ? totalSpend / totalClicks : 0,
    roas: totalSpend > 0 ? totalRev / totalSpend : 0,
    convRate: totalClicks > 0 ? totalConv / totalClicks : 0,
  };
}

function analyzeCampaign(
  campaign: GoogleAdsCampaign,
  accountAvg: ReturnType<typeof accountAverages>,
): CommerceOpportunity[] {
  const results: CommerceOpportunity[] = [];
  const cpc = campaign.clicks7d > 0 ? campaign.spend7d / campaign.clicks7d : 0;
  const cpa = campaign.conversions7d > 0 ? campaign.spend7d / campaign.conversions7d : campaign.spend7d;
  const convRate = campaign.clicks7d > 0 ? campaign.conversions7d / campaign.clicks7d : 0;

  if (campaign.spend7d > 100 && campaign.conversions7d === 0) {
    results.push(
      createCommerceOpportunity({
        id: `g-zero-conv-${campaign.id}`,
        source: "google_ads",
        severity: "critical",
        confidence: 92,
        title: `${campaign.name} — spending with zero conversions`,
        description: `Spent $${campaign.spend7d.toLocaleString()} in 7 days with 0 conversions.`,
        recommendation: "Pause campaign or tighten keywords and negatives immediately.",
        category: "conversion",
        supportingMetrics: [
          { label: "7-day spend", value: `$${campaign.spend7d.toLocaleString()}` },
          { label: "Conversions (7d)", value: "0" },
          { label: "Clicks (7d)", value: String(campaign.clicks7d) },
        ],
        expectedImpact: { profitMonthly: Math.round(campaign.spend7d * 4.33), label: "" },
        futureAction: "pause_campaign",
        relatedEntityType: "campaign",
        relatedEntityId: campaign.id,
      }),
    );
  }

  if (cpa > accountAvg.cpa * 1.4 && campaign.conversions7d > 0) {
    results.push(
      createCommerceOpportunity({
        id: `g-cpa-high-${campaign.id}`,
        source: "google_ads",
        severity: "high",
        confidence: 87,
        title: `CPA above account average — ${campaign.name}`,
        description: `CPA $${cpa.toFixed(0)} vs account avg $${accountAvg.cpa.toFixed(0)}.`,
        recommendation: "Reduce bids or pause low-intent keywords and search terms.",
        category: "spend_efficiency",
        supportingMetrics: [
          { label: "CPA (7d)", value: `$${cpa.toFixed(0)}`, trend: "up" },
          { label: "Account avg CPA", value: `$${accountAvg.cpa.toFixed(0)}` },
          { label: "ROAS (7d)", value: campaign.roas7d.toFixed(2) },
        ],
        expectedImpact: { profitMonthly: Math.round((cpa - accountAvg.cpa) * campaign.conversions7d * 4.33), label: "" },
        futureAction: "reduce_budget",
        relatedEntityType: "campaign",
        relatedEntityId: campaign.id,
      }),
    );
  }

  if (campaign.roas7d < ROAS_TARGET && campaign.spend7d > 100) {
    results.push(
      createCommerceOpportunity({
        id: `g-roas-below-${campaign.id}`,
        source: "google_ads",
        severity: campaign.roas7d < 1 ? "high" : "medium",
        confidence: 83,
        title: `ROAS below target — ${campaign.name}`,
        description: `ROAS ${campaign.roas7d.toFixed(2)} under target ${ROAS_TARGET}.`,
        recommendation: "Review search terms, bids, and landing pages before scaling.",
        category: "roas",
        supportingMetrics: [
          { label: "ROAS (7d)", value: campaign.roas7d.toFixed(2), trend: "down" },
          { label: "Target ROAS", value: ROAS_TARGET.toFixed(1) },
          { label: "7-day spend", value: `$${campaign.spend7d.toLocaleString()}` },
        ],
        expectedImpact: { profitMonthly: Math.round(campaign.spend7d * 0.2 * 4.33), label: "" },
        relatedEntityType: "campaign",
        relatedEntityId: campaign.id,
      }),
    );
  }

  if (
    campaign.roas7d >= 2.2 &&
    campaign.impressions7d > 8000 &&
    campaign.spend7d > 200 &&
    campaign.clicks7d > 100
  ) {
    results.push(
      createCommerceOpportunity({
        id: `g-budget-limited-${campaign.id}`,
        source: "google_ads",
        severity: "medium",
        confidence: 81,
        title: `Budget limited — ${campaign.name}`,
        description: "Strong ROAS and delivery suggest the campaign may be budget-capped.",
        recommendation: "Increase daily budget 15–20% and monitor impression share.",
        category: "campaign_performance",
        supportingMetrics: [
          { label: "ROAS (7d)", value: campaign.roas7d.toFixed(2), trend: "up" },
          { label: "Impressions (7d)", value: campaign.impressions7d.toLocaleString() },
          { label: "7-day spend", value: `$${campaign.spend7d.toLocaleString()}` },
        ],
        expectedImpact: { revenueMonthly: Math.round(campaign.revenue7d * 0.2 * 4.33), label: "" },
        futureAction: "increase_budget",
        relatedEntityType: "campaign",
        relatedEntityId: campaign.id,
      }),
    );
  }

  if (cpc > accountAvg.cpc * 1.42 && campaign.clicks7d > 30 && accountAvg.cpc > 0) {
    const cpcIncrease = Math.round(((cpc / accountAvg.cpc) - 1) * 100);
    const copy = buildBusinessFirstInsight({
      headline: `Customer acquisition costs rising — ${campaign.name}`,
      why: "Each click is costing more without a proportional lift in revenue, which erodes advertising efficiency.",
      businessImpact: `CPC is ${cpcIncrease}% above account average while ROAS is ${campaign.roas7d.toFixed(2)}.`,
      action: "Audit keyword competition, quality score, and match types before increasing bids.",
      diagnostics: [
        { label: "ROAS (7d)", value: campaign.roas7d.toFixed(2) },
        { label: "CPC (7d)", value: `$${cpc.toFixed(2)}`, trend: "up" },
        { label: "Account avg CPC", value: `$${accountAvg.cpc.toFixed(2)}` },
        { label: "Clicks (7d)", value: String(campaign.clicks7d) },
      ],
    });
    results.push(
      createCommerceOpportunity({
        id: `g-cpc-growth-${campaign.id}`,
        source: "google_ads",
        severity: "medium",
        confidence: 77,
        title: copy.headline,
        description: copy.summary,
        recommendation: copy.action,
        category: "spend_efficiency",
        supportingMetrics: copy.evidence,
        expectedImpact: { profitMonthly: Math.round(campaign.spend7d * 0.1 * 4.33), label: "" },
        relatedEntityType: "campaign",
        relatedEntityId: campaign.id,
      }),
    );
  }

  if (convRate < accountAvg.convRate * 0.65 && campaign.clicks7d > 50 && accountAvg.convRate > 0) {
    results.push(
      createCommerceOpportunity({
        id: `g-conv-decline-${campaign.id}`,
        source: "google_ads",
        severity: "high",
        confidence: 80,
        title: `Conversion rate declining — ${campaign.name}`,
        description: `Conversion rate ${(convRate * 100).toFixed(2)}% vs account ${(accountAvg.convRate * 100).toFixed(2)}%.`,
        recommendation: "Check landing page speed, offer, and query-to-page relevance.",
        category: "conversion",
        supportingMetrics: [
          { label: "Conv. rate (7d)", value: `${(convRate * 100).toFixed(2)}%`, trend: "down" },
          { label: "Account avg", value: `${(accountAvg.convRate * 100).toFixed(2)}%` },
          { label: "Conversions (7d)", value: String(campaign.conversions7d) },
        ],
        expectedImpact: { revenueMonthly: Math.round(campaign.spend7d * 0.15 * 4.33), label: "" },
        relatedEntityType: "campaign",
        relatedEntityId: campaign.id,
      }),
    );
  }

  if (campaign.roas7d >= 2.5 && campaign.spend7d > 200) {
    results.push(
      createCommerceOpportunity({
        id: `g-scale-${campaign.id}`,
        source: "google_ads",
        severity: "medium",
        confidence: 84,
        title: `Ready to scale — ${campaign.name}`,
        description: `ROAS ${campaign.roas7d.toFixed(2)} with stable delivery.`,
        recommendation: "Increase budget 15–20% while monitoring Blended ROAS for 5 days.",
        category: "campaign_performance",
        supportingMetrics: [
          { label: "ROAS (7d)", value: campaign.roas7d.toFixed(2), trend: "up" },
          { label: "CPA vs avg", value: cpa < accountAvg.cpa ? `${Math.round((1 - cpa / accountAvg.cpa) * 100)}% below avg` : "At avg" },
          { label: "7-day spend", value: `$${campaign.spend7d.toLocaleString()}` },
        ],
        expectedImpact: { revenueMonthly: Math.round(campaign.revenue7d * 0.25 * 4.33), label: "" },
        futureAction: "scale_campaign",
        relatedEntityType: "campaign",
        relatedEntityId: campaign.id,
      }),
    );
  }

  if (campaign.roas7d < 1 && campaign.spend7d > 150) {
    results.push(
      createCommerceOpportunity({
        id: `g-pause-${campaign.id}`,
        source: "google_ads",
        severity: "high",
        confidence: 88,
        title: `Pause ${campaign.name}`,
        description: `ROAS ${campaign.roas7d.toFixed(2)} below break-even.`,
        recommendation: "Pause and reallocate budget to profitable campaigns.",
        category: "spend_efficiency",
        supportingMetrics: [
          { label: "ROAS (7d)", value: campaign.roas7d.toFixed(2), trend: "down" },
          { label: "7-day spend", value: `$${campaign.spend7d.toLocaleString()}` },
        ],
        expectedImpact: { profitMonthly: Math.round(campaign.spend7d * 0.3 * 4.33), label: "" },
        futureAction: "pause_campaign",
        relatedEntityType: "campaign",
        relatedEntityId: campaign.id,
      }),
    );
  }

  return results;
}

function analyzeChannelComparisons(campaigns: GoogleAdsCampaign[]): CommerceOpportunity[] {
  const results: CommerceOpportunity[] = [];

  const byType = new Map<string, { spend: number; revenue: number; count: number }>();
  for (const c of campaigns) {
    const b = byType.get(c.type) ?? { spend: 0, revenue: 0, count: 0 };
    b.spend += c.spend7d;
    b.revenue += c.revenue7d;
    b.count += 1;
    byType.set(c.type, b);
  }

  const search = byType.get("search");
  const shopping = byType.get("shopping");
  if (search && shopping && search.spend > 50 && shopping.spend > 50) {
    const searchRoas = search.revenue / search.spend;
    const shopRoas = shopping.revenue / shopping.spend;
    if (Math.abs(searchRoas - shopRoas) > 0.4) {
      const winner = searchRoas > shopRoas ? "Search" : "Shopping";
      const loser = winner === "Search" ? "Shopping" : "Search";
      results.push(
        createCommerceOpportunity({
          id: "g-search-vs-shopping",
          source: "google_ads",
          severity: "medium",
          confidence: 75,
          title: `${winner} outperforms ${loser}`,
          description: `${winner} ROAS ${Math.max(searchRoas, shopRoas).toFixed(2)} vs ${loser} ${Math.min(searchRoas, shopRoas).toFixed(2)}.`,
          recommendation: `Shift budget from ${loser.toLowerCase()} toward ${winner.toLowerCase()} campaigns.`,
          category: "channel_comparison",
          supportingMetrics: [
            { label: "Search ROAS", value: searchRoas.toFixed(2) },
            { label: "Shopping ROAS", value: shopRoas.toFixed(2) },
          ],
          expectedImpact: { profitMonthly: Math.round((search.spend + shopping.spend) * 0.08 * 4.33), label: "" },
          relatedEntityType: "channel",
          relatedEntityId: "search_shopping",
        }),
      );
    }
  }

  const branded = campaigns.filter((c) => isBranded(c.name));
  const nonBranded = campaigns.filter((c) => !isBranded(c.name) && c.type === "search");
  if (branded.length > 0 && nonBranded.length > 0) {
    const bSpend = branded.reduce((s, c) => s + c.spend7d, 0);
    const bRev = branded.reduce((s, c) => s + c.revenue7d, 0);
    const nbSpend = nonBranded.reduce((s, c) => s + c.spend7d, 0);
    const nbRev = nonBranded.reduce((s, c) => s + c.revenue7d, 0);
    const bRoas = bSpend > 0 ? bRev / bSpend : 0;
    const nbRoas = nbSpend > 0 ? nbRev / nbSpend : 0;
    if (bSpend > 50 && nbSpend > 50 && Math.abs(bRoas - nbRoas) > 0.5) {
      const winner = bRoas > nbRoas ? "Branded" : "Non-branded";
      results.push(
        createCommerceOpportunity({
          id: "g-branded-vs-non",
          source: "google_ads",
          severity: "low",
          confidence: 72,
          title: `${winner} search performs better`,
          description: `Branded ROAS ${bRoas.toFixed(2)} vs non-branded ${nbRoas.toFixed(2)}.`,
          recommendation: `Optimize ${winner.toLowerCase()} keyword bids and negative overlap.`,
          category: "channel_comparison",
          supportingMetrics: [
            { label: "Branded ROAS", value: bRoas.toFixed(2) },
            { label: "Non-branded ROAS", value: nbRoas.toFixed(2) },
          ],
          expectedImpact: { profitMonthly: Math.round(nbSpend * 0.06 * 4.33), label: "" },
        }),
      );
    }
  }

  return results;
}

function analyzeWeekdayPatterns(
  dailySpend: { date: string; spend: number }[],
): CommerceOpportunity[] {
  if (dailySpend.length < 14) return [];

  let weekend = 0;
  let weekday = 0;
  let weekendDays = 0;
  let weekdayDays = 0;

  for (const d of dailySpend) {
    const day = new Date(d.date).getUTCDay();
    const isWeekend = day === 0 || day === 6;
    if (isWeekend) {
      weekend += d.spend;
      weekendDays += 1;
    } else {
      weekday += d.spend;
      weekdayDays += 1;
    }
  }

  const weekendAvg = weekendDays > 0 ? weekend / weekendDays : 0;
  const weekdayAvg = weekdayDays > 0 ? weekday / weekdayDays : 0;
  if (weekendAvg <= 0 || weekdayAvg <= 0) return [];

  const diff = ((weekendAvg - weekdayAvg) / weekdayAvg) * 100;
  if (Math.abs(diff) < 20) return [];

  const better = diff > 0 ? "Weekend" : "Weekday";
  const results: CommerceOpportunity[] = [
    createCommerceOpportunity({
      id: "g-weekend-weekday",
      source: "google_ads",
      severity: "low",
      confidence: 68,
      title: `${better} performance differs from ${better === "Weekend" ? "weekday" : "weekend"}`,
      description: `Avg daily spend: weekend $${weekendAvg.toFixed(0)} vs weekday $${weekdayAvg.toFixed(0)}.`,
      recommendation: `Consider day-parting or bid adjustments to align budget with ${better.toLowerCase()} efficiency.`,
      category: "trend",
      supportingMetrics: [
        { label: "Weekend avg spend", value: `$${weekendAvg.toFixed(0)}` },
        { label: "Weekday avg spend", value: `$${weekdayAvg.toFixed(0)}` },
        { label: "Difference", value: `${Math.abs(diff).toFixed(0)}%` },
      ],
      expectedImpact: { profitMonthly: Math.round(weekday * 0.05 * 4.33), label: "" },
    }),
  ];
  return results;
}

export function buildGoogleAdsInsights(snapshot: StoreSnapshot): CommerceOpportunity[] {
  const google = snapshot.googleAdsSnapshot;
  if (!google) return [];

  const campaigns = google.campaigns.filter((c) => c.status !== "REMOVED");
  if (campaigns.length === 0) return [];

  const accountAvg = accountAverages(campaigns);
  const results: CommerceOpportunity[] = [];

  for (const campaign of campaigns) {
    results.push(...analyzeCampaign(campaign, accountAvg));
  }
  results.push(...analyzeChannelComparisons(campaigns));
  results.push(...analyzeWeekdayPatterns(google.dailySpend));

  return results;
}

export function buildCrossChannelInsights(
  snapshot: StoreSnapshot,
  profitDashboard?: ProfitDashboard | null,
): CommerceOpportunity[] {
  const results: CommerceOpportunity[] = [];
  const adSpend = snapshot.adSpendSnapshot;
  if (!adSpend || adSpend.platforms.length < 2) return results;

  const google = adSpend.platforms.find((p) => p.platform === "google_ads");
  const meta = adSpend.platforms.find((p) => p.platform === "meta_ads");
  if (!google || !meta) return results;

  const googleRoas =
    google.rollups.last30d.spend > 0
      ? google.rollups.last30d.attributedRevenue / google.rollups.last30d.spend
      : 0;
  const metaRoas =
    meta.rollups.last30d.spend > 0
      ? meta.rollups.last30d.attributedRevenue / meta.rollups.last30d.spend
      : 0;

  if (googleRoas > 0 && metaRoas > 0 && Math.abs(googleRoas - metaRoas) > 0.5) {
    const winner = googleRoas > metaRoas ? "Google" : "Meta";
    const loser = winner === "Google" ? "Meta" : "Google";
    results.push(
      createCommerceOpportunity({
        id: `cross-channel-${winner.toLowerCase()}`,
        source: "google_ads",
        severity: "medium",
        confidence: 76,
        title: `${winner} is more efficient than ${loser}`,
        description: `${winner} ROAS ${Math.max(googleRoas, metaRoas).toFixed(2)} vs ${loser} ${Math.min(googleRoas, metaRoas).toFixed(2)}.`,
        recommendation: `Shift incremental budget from ${loser} to ${winner}.`,
        category: "channel_comparison",
        supportingMetrics: [
          { label: "Google ROAS (30d)", value: googleRoas.toFixed(2) },
          { label: "Meta ROAS (30d)", value: metaRoas.toFixed(2) },
        ],
        expectedImpact: { profitMonthly: Math.round(adSpend.totalRollups.last30d.spend * 0.06), label: "" },
        relatedEntityType: "channel",
        relatedEntityId: winner.toLowerCase(),
      }),
    );
  }

  const blended = profitDashboard?.blendedRoas?.blendedRoas30d;
  if (blended != null && blended < ROAS_TARGET && adSpend.totalRollups.last30d.spend > 500) {
    results.push(
      createCommerceOpportunity({
        id: "blended-roas-below-target",
        source: "google_ads",
        severity: "high",
        confidence: 85,
        title: "Blended ROAS below profitability target",
        description: `30-day Blended ROAS ${blended.toFixed(2)} on $${adSpend.totalRollups.last30d.spend.toLocaleString()} spend.`,
        recommendation: "Pause zero-conversion campaigns; scale only ROAS > 2.0 winners.",
        category: "roas",
        supportingMetrics: [
          { label: "Blended ROAS (30d)", value: blended.toFixed(2), trend: "down" },
          { label: "Total ad spend (30d)", value: `$${adSpend.totalRollups.last30d.spend.toLocaleString()}` },
        ],
        expectedImpact: { profitMonthly: Math.round(adSpend.totalRollups.last30d.spend * 0.1), label: "" },
      }),
    );
  }

  return results;
}
