export type FunnelConfidence = "verified" | "estimated" | "unavailable";

export type Ga4ConnectionStatus = "connected" | "estimated" | "unavailable";

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

export type FunnelWizardStep = {
  step: number;
  label: string;
  description: string;
  complete: boolean;
};

export type FunnelPageView = {
  mode: "readiness" | "full";
  ga4Status: Ga4ConnectionStatus;
  ga4StatusLabel: string;
  ga4StatusNotice: string;
  confidence: FunnelConfidence;
  confidenceScore: number;
  confidenceNotice: string;
  availableMetrics: FunnelAvailableMetric[];
  trafficSources: FunnelTrafficSource[];
  previewStepLabels: string[];
  limitationMessage: string;
  unlockCapabilities: string[];
  wizardSteps: FunnelWizardStep[];
  setupTimeMinutes: number;
  funnelSteps: FunnelStepView[];
  aiInsights: FunnelAiInsight[];
};

export const FUNNEL_PREVIEW_STEPS = [
  "Sessions",
  "Product Views",
  "Add To Cart",
  "Checkout",
  "Purchase",
] as const;

export const FUNNEL_UNLOCK_CAPABILITIES = [
  "Highest abandonment step",
  "Checkout issues",
  "Product page problems",
  "Landing page performance",
  "Channel-specific conversion rates",
] as const;
