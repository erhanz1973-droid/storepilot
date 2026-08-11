export type FirstRunStageId =
  | "shopify_connected"
  | "analyzing_products"
  | "analyzing_orders"
  | "checking_inventory"
  | "calculating_profitability"
  | "looking_for_growth"
  | "preparing_briefing";

export type FirstRunStage = {
  id: FirstRunStageId;
  label: string;
  status: "pending" | "active" | "done";
  detail?: string;
};

export type FirstRunPrimaryCta = {
  label: string;
  href: string;
};

export type FirstRunKnownFact = {
  label: string;
  value: string;
};

export type FirstRunDecision = {
  recommendationId: string;
  title: string;
  actionLabel: string;
  reason: string;
  expectedImpactLabel: string;
  impactMonthly: number;
  confidencePct: number;
  estimatedMinutes: number;
  risk: string;
  evidencePoints: string[];
  category: string;
  presentation: "executive_decision" | "first_insight";
  recommendationType: string;
  whyThisMatters: string;
  whatToDoNext: string;
  primaryCta: FirstRunPrimaryCta;
  why: {
    productsAnalyzed: number;
    ordersAnalyzed: number;
    campaignsAnalyzed: number;
    confidenceSummary: string;
  };
  approvePreview: {
    estimatedMonthlyImprovement: string;
    estimatedImplementationTime: string;
    riskLevel: string;
    expectedConfidence: string;
  };
};

export type FirstRunFirstValue = {
  kind: "recommendation" | "low_data";
  headline: string;
  body: string;
  known: FirstRunKnownFact[];
  unknown: FirstRunKnownFact[];
  nextActions: FirstRunPrimaryCta[];
  primaryAction: FirstRunPrimaryCta;
  whyThisMatters: string;
  whatToDoNext: string;
  recommendationType: string;
};

export type FirstRunAnalyzeResult = {
  ok: boolean;
  storeId: string;
  shopifyConnected: boolean;
  stages: FirstRunStage[];
  stats: {
    productsAnalyzed: number;
    ordersAnalyzed: number;
    campaignsAnalyzed: number;
    inventorySkus: number;
  };
  decision: FirstRunDecision | null;
  firstValue: FirstRunFirstValue | null;
  emptyReason: string | null;
  durationMs: number;
  merchantStage?: import("@/lib/growth-copilot/types").MerchantStage;
};

export type FirstRunUiPhase = "welcome" | "analyzing" | "decision" | "low_data" | "error";

export function resolveFirstRunPhase(input: {
  result: FirstRunAnalyzeResult | null;
  error: string | null;
  analyzing: boolean;
}): FirstRunUiPhase {
  if (input.error && !input.result?.ok) return "error";
  if (input.analyzing || !input.result) return "analyzing";
  if (input.result.decision) return "decision";
  if (input.result.firstValue?.kind === "low_data") return "low_data";
  if (input.error) return "error";
  return "low_data";
}
