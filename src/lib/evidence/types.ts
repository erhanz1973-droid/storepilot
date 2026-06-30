import type { SupportingMetric } from "@/lib/types";

export type EvidenceSectionId =
  | "revenue_trend"
  | "inventory_trend"
  | "campaign_metrics"
  | "customer_metrics";

export type EvidenceSection = {
  id: EvidenceSectionId;
  title: string;
  metrics: SupportingMetric[];
  narrative?: string;
};

export type HistoricalComparison = {
  label: string;
  current: string;
  previous: string;
  changePct: number | null;
  direction: "up" | "down" | "flat" | "unknown";
};

export type DataFreshness = {
  lastSyncedAt: string;
  sources: { label: string; status: string; lastSyncAt?: string }[];
};

export type RecommendationEvidence = {
  recommendationId?: string;
  opportunityId?: string;
  title: string;
  kpisUsed: string[];
  historicalComparisons: HistoricalComparison[];
  confidenceExplanation: string;
  confidenceScore: number;
  supportingMetrics: SupportingMetric[];
  sections: EvidenceSection[];
  dataFreshness: DataFreshness;
  measuredHistoricalNote?: string;
};
