import type { RecommendationCategory } from "@/lib/types";

export type LifecycleStage =
  | "created"
  | "displayed"
  | "approved"
  | "rejected"
  | "snoozed"
  | "executed"
  | "observing"
  | "measured"
  | "closed";

export type LifecycleEventType =
  | "created"
  | "displayed"
  | "approved"
  | "rejected"
  | "snoozed"
  | "executed"
  | "observation_started"
  | "outcome_measured"
  | "closed"
  | "expired";

export type RecommendationActionStatus =
  | "pending"
  | "approved"
  | "rejected"
  | "executed"
  | "expired"
  | "snoozed";

export type LifecycleEvent = {
  id: string;
  recommendationId: string;
  storeId: string;
  eventType: LifecycleEventType;
  label: string;
  detail?: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
};

export type RecommendationActionRecord = {
  id: string;
  recommendationId: string;
  storeId: string;
  status: RecommendationActionStatus;
  userId?: string;
  userLabel: string;
  note?: string;
  approvedAt?: string;
  rejectedAt?: string;
  executedAt?: string;
  snoozedUntil?: string;
  createdAt: string;
};

export type OutcomeMetricsRecord = {
  id: string;
  recommendationId: string;
  storeId: string;
  measurementStart: string;
  measurementEnd: string;
  observationDays: number;
  revenueBefore?: number;
  revenueAfter?: number;
  profitBefore?: number;
  profitAfter?: number;
  roasBefore?: number;
  roasAfter?: number;
  conversionBefore?: number;
  conversionAfter?: number;
  aovBefore?: number;
  aovAfter?: number;
  trafficBefore?: number;
  trafficAfter?: number;
  success?: boolean;
  revenueDeltaPct?: number;
  roasDeltaPct?: number;
  notes?: string;
};

export type RecommendationTypeStats = {
  category: RecommendationCategory | string;
  successRatePct: number;
  avgRevenueImprovementPct: number;
  avgRoasImprovementPct: number;
  evaluatedCount: number;
  approvedCount: number;
  rejectedCount: number;
  executedCount: number;
};

export type LearningRecord = {
  id: string;
  storeId: string;
  recommendationId?: string;
  category: string;
  industry?: string;
  storeSize?: string;
  confidence?: number;
  validationScore?: number;
  approved: boolean;
  successful?: boolean;
  revenueImpactPct?: number;
  roasImpactPct?: number;
  profitImpactPct?: number;
  observationDays?: number;
  evidence: unknown[];
  createdAt: string;
};

export type IntelligenceDashboard = {
  generated: number;
  approvedPct: number;
  rejectedPct: number;
  executionRatePct: number;
  successRatePct: number;
  revenueRecovered: number;
  revenueGenerated: number;
  costSaved: number;
  avgConfidence: number;
  avgValidationScore: number;
  topPerforming: RecommendationTypeStats[];
  worstPerforming: RecommendationTypeStats[];
  recentTimeline: LifecycleEvent[];
};
