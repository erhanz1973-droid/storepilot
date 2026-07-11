import type { StoreSnapshot } from "@/lib/connectors/types";
import type { ProfitDashboard } from "@/lib/profit/types";
import { buildMarketingCampaigns } from "@/lib/analytics/marketing";
import {
  buildBusinessScaleContext,
  constrainRecoveryEstimate,
  constrainRecoveryTotal,
  type BusinessScaleContext,
  type RecoveryExplanation,
} from "@/lib/analytics/recovery-business-constraints";

export type CalculationLine = {
  id: string;
  label: string;
  amount: number;
  sign: "add" | "subtract";
};

export type ProfitCalculationTrace = {
  lines: CalculationLine[];
  estimatedProfit: number;
  computedProfit: number;
  isBalanced: boolean;
  status: "verified" | "estimated" | "unavailable";
  formula: string;
};

export type MoneyLeakSource = {
  id: string;
  label: string;
  amountMonthly: number;
  category: "campaign" | "inventory" | "refunds" | "aggregate";
  campaignId?: string;
};

export type DedupedMoneyLeaks = {
  items: { id: string; label: string; amountMonthly: number }[];
  totalLostMonthly: number;
  excludedOverlaps: { label: string; reason: string; amountMonthly: number }[];
};

export type RecoveryTotals = {
  grossMonthly: number;
  netMonthly: number;
  overlapRemoved: number;
  items: { id: string; label: string; amountMonthly: number; includedInNet: boolean }[];
  explanation?: RecoveryExplanation;
  wasCapped?: boolean;
  forecast?: import("./recovery-business-constraints").RecoveryForecast;
};

export type RecommendationInput = {
  id: string;
  title: string;
  impactMonthly: number;
  confidencePct: number;
  opportunityKey?: string;
  decisionId?: string;
  recommendationId?: string;
};

const round = (n: number) => Math.round(n);

function operationalCost30d(snapshot: StoreSnapshot): number {
  const ops = snapshot.operationalCosts;
  if (!ops) return 0;
  return round(ops.supportCost30d + ops.warehouseCost30d + (ops.packingCost30d ?? 0));
}

export function buildProfitCalculationTrace(
  profitDashboard: ProfitDashboard | null,
  snapshot: StoreSnapshot,
): ProfitCalculationTrace {
  if (!profitDashboard || profitDashboard.primaryProfit.status === "unavailable") {
    return {
      lines: [],
      estimatedProfit: 0,
      computedProfit: 0,
      isBalanced: false,
      status: "unavailable",
      formula: "Revenue − COGS − Shipping − Payment Fees − Ad Spend − Returns − Other Costs = Estimated Profit",
    };
  }

  const p = profitDashboard.primary;
  const otherCosts = operationalCost30d(snapshot);
  const taxes = 0;

  const lines: CalculationLine[] = [
    { id: "revenue", label: "Revenue", amount: p.revenue, sign: "add" },
    { id: "cogs", label: "COGS", amount: p.cogs, sign: "subtract" },
    { id: "ad_spend", label: "Ad Spend", amount: p.adSpend, sign: "subtract" },
    { id: "shipping", label: "Shipping", amount: p.shippingCost, sign: "subtract" },
    { id: "payment_fees", label: "Payment Fees", amount: p.transactionFees, sign: "subtract" },
    { id: "returns", label: "Returns", amount: p.refunds, sign: "subtract" },
    { id: "taxes", label: "Taxes", amount: taxes, sign: "subtract" },
  ];

  if (otherCosts > 0) {
    lines.push({ id: "other", label: "Other Costs", amount: otherCosts, sign: "subtract" });
  }

  const computedProfit = round(
    p.revenue -
      p.cogs -
      p.adSpend -
      p.shippingCost -
      p.transactionFees -
      p.refunds -
      taxes -
      otherCosts,
  );

  const estimatedProfit = p.netProfit ?? computedProfit;
  const isBalanced = Math.abs(computedProfit - estimatedProfit) <= 1;

  return {
    lines,
    estimatedProfit,
    computedProfit,
    isBalanced,
    status: profitDashboard.primaryProfit.status === "estimated" ? "estimated" : "verified",
    formula:
      "Revenue − COGS − Ad Spend − Shipping − Payment Fees − Returns − Taxes − Other Costs = Estimated Profit",
  };
}

export function buildRawMoneyLeaks(
  profitDashboard: ProfitDashboard | null,
  snapshot: StoreSnapshot,
): MoneyLeakSource[] {
  const items: MoneyLeakSource[] = [];
  const campaigns = buildMarketingCampaigns(snapshot);
  const scale = 30 / 7;

  for (const c of campaigns) {
    if (c.roas < 1 && c.spend > 30) {
      const loss = c.profit < 0 ? Math.abs(c.profit) * 4.33 : Math.round(c.spend * scale * 0.35);
      if (loss > 100) {
        items.push({
          id: `leak-${c.id}`,
          label: c.campaign.replace(/^[^:]+:\s*/, "").slice(0, 40) || c.campaign,
          amountMonthly: round(loss),
          category: "campaign",
          campaignId: c.id,
        });
      }
    }
  }

  const deadProducts = snapshot.products.filter(
    (p) => p.inventoryQuantity > 5 && p.unitsSold30d < 2,
  );
  if (deadProducts.length > 0) {
    const tiedUp = deadProducts.reduce(
      (s, p) => s + p.inventoryQuantity * (p.price * 0.45),
      0,
    );
    items.push({
      id: "leak-dead-inventory",
      label: "Dead Inventory",
      amountMonthly: round(Math.min(tiedUp * 0.08, tiedUp / 12)),
      category: "inventory",
    });
  }

  if (profitDashboard?.primary) {
    const p = profitDashboard.primary;
    const campaignLossTotal = items
      .filter((i) => i.category === "campaign")
      .reduce((s, i) => s + i.amountMonthly, 0);

    if (p.adSpend > p.grossProfit && p.grossProfit > 0) {
      const aggregateCpa = round((p.adSpend - p.grossProfit) * 0.25);
      items.push({
        id: "leak-high-cpa",
        label: "High CPA",
        amountMonthly: aggregateCpa,
        category: "aggregate",
      });
      void campaignLossTotal;
    }

    if (p.refunds > p.revenue * 0.02) {
      items.push({
        id: "leak-refunds",
        label: "Refunds",
        amountMonthly: round(p.refunds),
        category: "refunds",
      });
    }
  }

  return items.sort((a, b) => b.amountMonthly - a.amountMonthly);
}

/** Remove aggregate High CPA when campaign-level losses already cover the same waste. */
export function dedupeMoneyLeaks(sources: MoneyLeakSource[]): DedupedMoneyLeaks {
  const excludedOverlaps: DedupedMoneyLeaks["excludedOverlaps"] = [];
  const campaignTotal = sources
    .filter((s) => s.category === "campaign")
    .reduce((sum, s) => sum + s.amountMonthly, 0);

  const aggregate = sources.find((s) => s.id === "leak-high-cpa");
  const kept: MoneyLeakSource[] = [];

  for (const source of sources) {
    if (source.id === "leak-high-cpa" && aggregate) {
      if (campaignTotal >= aggregate.amountMonthly * 0.5) {
        excludedOverlaps.push({
          label: "High CPA",
          reason: "Already counted in campaign-level losses (Prospecting, Retargeting, etc.)",
          amountMonthly: aggregate.amountMonthly,
        });
        continue;
      }
    }
    kept.push(source);
  }

  const items = kept.slice(0, 6).map(({ id, label, amountMonthly }) => ({
    id,
    label,
    amountMonthly,
  }));

  return {
    items,
    totalLostMonthly: items.reduce((s, i) => s + i.amountMonthly, 0),
    excludedOverlaps,
  };
}

function normalizeActionKey(title: string, opportunityKey?: string): string {
  if (opportunityKey) return opportunityKey.toLowerCase();
  const t = title.toLowerCase();
  const pauseMatch = t.match(/pause[^—-]*[—-]\s*(.+)/i) ?? t.match(/pause\s+(.+)/i);
  if (pauseMatch) return `pause:${pauseMatch[1].trim().slice(0, 30)}`;
  const reduceMatch = t.match(/reduce[^—-]*[—-]\s*(.+)/i);
  if (reduceMatch) return `reduce:${reduceMatch[1].trim().slice(0, 30)}`;
  if (t.includes("clearance") || t.includes("inventory")) return "inventory:clearance";
  if (t.includes("google") || t.includes("increase budget")) return "scale:google";
  if (t.includes("reduce") && t.includes("cac")) return "aggregate:cac";
  return t.slice(0, 40);
}

function simplifyLabel(title: string): string {
  const t = title.toLowerCase();
  if (t.includes("pause") && t.includes("prospect")) return "Pause Prospecting";
  if (t.includes("reduce") && t.includes("retarget")) return "Reduce Retargeting";
  if (t.includes("clearance") || t.includes("inventory")) return "Inventory Clearance";
  if (t.includes("google") || (t.includes("increase") && t.includes("budget")))
    return "Google Budget Shift";
  if (t.includes("pause")) return title.replace(/^Pause\s+/i, "Pause ").slice(0, 36);
  return title.length > 40 ? `${title.slice(0, 37)}…` : title;
}

function rowTitle(row: RecommendationInput): string {
  return row.title ?? "";
}

export function computeRecoveryTotals(
  rows: RecommendationInput[],
  options?: {
    businessContext?: BusinessScaleContext;
    avgConfidencePct?: number;
  },
): RecoveryTotals {
  const constrainedRows = options?.businessContext
    ? rows.map((row) => {
        const constrained = constrainRecoveryEstimate(
          row.impactMonthly,
          row.confidencePct,
          options.businessContext!,
          undefined,
          row.title,
        );
        return {
          ...row,
          impactMonthly: constrained.amount,
          confidencePct: constrained.confidencePct,
        };
      })
    : rows;

  const grossMonthly = constrainedRows.reduce((s, r) => s + r.impactMonthly, 0);

  const byKey = new Map<string, RecommendationInput>();
  for (const row of constrainedRows) {
    const key = normalizeActionKey(rowTitle(row), row.opportunityKey);
    const existing = byKey.get(key);
    if (!existing || row.impactMonthly > existing.impactMonthly) {
      byKey.set(key, row);
    }
  }

  let deduped = [...byKey.values()];

  const hasCampaignAction = deduped.some(
    (r) => {
      const t = rowTitle(r).toLowerCase();
      return t.includes("pause") || t.includes("reduce budget");
    },
  );
  if (hasCampaignAction) {
    deduped = deduped.filter((r) => !rowTitle(r).toLowerCase().includes("acquisition cost"));
  }

  const channelGroups = new Map<string, RecommendationInput[]>();
  for (const row of deduped) {
    const t = rowTitle(row).toLowerCase();
    let channel = "other";
    if (t.includes("meta") || t.includes("prospect") || t.includes("retarget")) channel = "meta";
    else if (t.includes("google")) channel = "google";
    else if (t.includes("inventory") || t.includes("clearance")) channel = "inventory";
    const list = channelGroups.get(channel) ?? [];
    list.push(row);
    channelGroups.set(channel, list);
  }

  const netRows: RecommendationInput[] = [];
  for (const [, group] of channelGroups) {
    if (group.length === 1) {
      netRows.push(group[0]);
      continue;
    }
    const sorted = [...group].sort((a, b) => b.impactMonthly - a.impactMonthly);
    netRows.push(sorted[0]);
    for (let i = 1; i < sorted.length; i++) {
      netRows.push({ ...sorted[i], impactMonthly: round(sorted[i].impactMonthly * 0.35) });
    }
  }

  const netIds = new Set(netRows.map((r) => r.id));

  const items = constrainedRows.slice(0, 8).map((r) => ({
    id: r.id,
    label: simplifyLabel(rowTitle(r)),
    amountMonthly: r.impactMonthly,
    includedInNet: netIds.has(r.id) || deduped.some((d) => d.id === r.id),
  }));

  let netMonthly = round(netRows.reduce((s, r) => s + r.impactMonthly, 0));
  let explanation: RecoveryExplanation | undefined;
  let wasCapped = false;
  let forecast: import("./recovery-business-constraints").RecoveryForecast | undefined;

  if (options?.businessContext) {
    const avgConfidence =
      options.avgConfidencePct ??
      (constrainedRows.length > 0
        ? Math.round(
            constrainedRows.reduce((s, r) => s + r.confidencePct, 0) /
              constrainedRows.length,
          )
        : 72);
    const totalConstrained = constrainRecoveryTotal(
      netMonthly,
      avgConfidence,
      options.businessContext,
    );
    if (totalConstrained.wasCapped || totalConstrained.amount !== netMonthly) {
      wasCapped = true;
      const scale =
        netMonthly > 0 ? totalConstrained.amount / netMonthly : 0;
      netMonthly = totalConstrained.amount;
      if (scale > 0 && scale < 1) {
        for (const item of items) {
          item.amountMonthly = round(item.amountMonthly * scale);
        }
      }
    }
    explanation = totalConstrained.explanation;
    forecast = totalConstrained.forecast;
  }

  return {
    grossMonthly: round(grossMonthly),
    netMonthly,
    overlapRemoved: round(Math.max(0, grossMonthly - netMonthly)),
    items,
    explanation,
    wasCapped,
    forecast,
  };
}

export { buildBusinessScaleContext, type BusinessScaleContext, type RecoveryExplanation };

export function computeTrackingScore(snapshot: StoreSnapshot): number {
  const shopify =
    snapshot.connectorStates?.shopify === "connected" ||
    snapshot.connectorStates?.shopify === "demo";
  const meta =
    snapshot.connectorStates?.meta_ads === "connected" ||
    snapshot.connectorStates?.meta_ads === "demo";
  const google =
    snapshot.connectorStates?.google_ads === "connected" ||
    Boolean(snapshot.googleAdsSnapshot);
  const ga4 = Boolean(snapshot.ga4Snapshot?.sessions30d);
  const funnelVerified = Boolean(snapshot.ga4Snapshot?.funnelEvents?.verified);
  const ga4Fresh =
    snapshot.ga4Snapshot?.syncedAt != null &&
    Date.now() - new Date(snapshot.ga4Snapshot.syncedAt).getTime() < 6 * 60 * 60 * 1000;

  let score = 35;
  if (shopify) score = 52;
  if (shopify && meta) score = 68;
  if (shopify && meta && google) score = 82;
  if (shopify && meta && google && ga4) score = 92;
  if (ga4 && funnelVerified) score = Math.min(100, score + 5);
  if (ga4 && ga4Fresh) score = Math.min(100, score + 2);

  return score;
}

export function explainTrackingScore(score: number, snapshot: StoreSnapshot): string {
  const ga4 = Boolean(snapshot.ga4Snapshot?.sessions30d);
  if (score >= 90) return "All major integrations connected including GA4 — full funnel visibility.";
  if (score >= 75) return "Shopify, Meta, and Google connected — connect GA4 for complete tracking.";
  if (score >= 60) return "Core commerce and ad platforms connected — GA4 needed for conversion tracking.";
  if (score >= 45) return "Shopify connected with partial ad tracking — expand integrations to improve accuracy.";
  return ga4
    ? "Limited data sources connected — tracking confidence is low."
    : "Connect GA4 and additional ad platforms for reliable conversion tracking.";
}

export function explainInventoryScore(score: number, deadSkus: number): string {
  if (score >= 70) return "Inventory levels and sell-through are healthy.";
  if (score >= 40)
    return `${deadSkus > 0 ? `${deadSkus} SKU${deadSkus === 1 ? "" : "s"} moving slowly` : "Sell-through is weakening"} — review reorder and clearance plans.`;
  return deadSkus > 0
    ? `Inventory turnover is critically low — ${deadSkus} SKU${deadSkus === 1 ? "" : "s"} have stock with near-zero sales.`
    : "Inventory turnover is critically low — dead stock is tying up capital.";
}

export function explainProfitabilityScore(
  score: number,
  netProfit: number | null,
  adSpend: number,
  grossProfit: number,
): string {
  if (netProfit != null && netProfit < 0) {
    if (adSpend > grossProfit && grossProfit > 0) {
      return "Advertising costs exceed gross margin. Current business is operating below profitability.";
    }
    return "Current business is operating below profitability — costs exceed revenue after deductions.";
  }
  if (score >= 70) return "Revenue and profit trends are healthy.";
  if (score >= 40) return "Margins are under pressure — review ad spend and product economics.";
  return "Profitability is poor — immediate action needed on cost structure and acquisition efficiency.";
}

export function clampConfidence(pct: number): number {
  return Math.max(0, Math.min(100, Math.round(pct)));
}

/** Normalize timeline/feed text — never expose raw placeholder values. */
export function sanitizeTimelineText(text: string): string {
  let result = text;

  result = result.replace(
    /will be out of stock within 0 days?/gi,
    "is out of stock today",
  );
  result = result.replace(
    /out of stock within 1 day/gi,
    "out of stock in less than 24 hours",
  );
  result = result.replace(
    /within 0 days?/gi,
    "today",
  );
  result = result.replace(
    /(\d+)\s*days?\s*remaining/gi,
    (_, days: string) => {
      const n = Number(days);
      if (n <= 0) return "less than 24 hours remaining";
      if (n === 1) return "less than 24 hours remaining";
      return `${n} days remaining`;
    },
  );

  return result;
}

export function dedupeRecommendations<T extends RecommendationInput>(rows: T[]): T[] {
  const seen = new Map<string, T>();
  for (const row of rows) {
    const key = normalizeActionKey(rowTitle(row), row.opportunityKey);
    const existing = seen.get(key);
    if (!existing || row.impactMonthly > existing.impactMonthly) {
      seen.set(key, row);
    }
  }
  return [...seen.values()].sort((a, b) => b.impactMonthly - a.impactMonthly);
}

export function projectedMonthlyProfit(profitDashboard: ProfitDashboard | null): number {
  if (!profitDashboard || profitDashboard.primaryProfit.status === "unavailable") return 0;
  return profitDashboard.primary.netProfit ?? 0;
}
