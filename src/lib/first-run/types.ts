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
  emptyReason: string | null;
  durationMs: number;
};
