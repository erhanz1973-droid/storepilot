export type FunnelConfidence = "verified" | "estimated" | "unavailable";

export type Ga4ConnectionStatus = "connected" | "estimated" | "unavailable";

/** How much behavioral data powers the workspace */
export type FunnelDataTier = "step_level" | "session_level" | "commerce_only";

export type FunnelAvailableMetric = {
  id: string;
  label: string;
  value: string;
  status: FunnelConfidence;
  notice?: string;
};

export type FunnelTrafficSource = {
  label: string;
  sharePct: number;
  status: FunnelConfidence;
  conversionPct?: number | null;
};

export type FunnelStepView = {
  id: string;
  label: string;
  users: number;
  conversionPct: number;
  dropOffPct: number;
  revenueLost: number | null;
  revenueLostStatus: FunnelConfidence;
  recommendation: string | null;
  status: FunnelConfidence;
};

export type FunnelAiInsight = {
  id: string;
  text: string;
  tone: "positive" | "neutral" | "warning";
};

export type FunnelOptimizationAction = {
  id: string;
  priority: "critical" | "high" | "medium";
  title: string;
  description: string;
  recommendation: string;
  expectedMonthlyImpact: number | null;
  confidenceScore: number;
  focusArea: "checkout" | "product_page" | "traffic" | "mobile" | "channel" | "aov" | "retention";
  dataTier: FunnelConfidence;
};

export type FunnelBottleneck = {
  title: string;
  description: string;
  impactLabel: string;
  focusStep: string;
  confidence: FunnelConfidence;
};

export type FunnelPageView = {
  dataTier: FunnelDataTier;
  dataTierLabel: string;
  confidence: FunnelConfidence;
  confidenceScore: number;
  confidenceNotice: string;
  availableMetrics: FunnelAvailableMetric[];
  trafficSources: FunnelTrafficSource[];
  funnelSteps: FunnelStepView[];
  bottleneck: FunnelBottleneck | null;
  optimizationActions: FunnelOptimizationAction[];
  aiInsights: FunnelAiInsight[];
};

export const FUNNEL_STEP_LABELS = [
  "Sessions",
  "Product Views",
  "Add To Cart",
  "Checkout",
  "Purchase",
] as const;
