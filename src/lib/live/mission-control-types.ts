import type { MetricCard } from "@/lib/analytics/types";
import type { MergedLiveEvent } from "./event-merge";

export type StoreHealthLevel = "healthy" | "caution" | "attention" | "critical";

export type StoreHealthBanner = {
  level: StoreHealthLevel;
  emoji: string;
  label: string;
  headline: string;
  primaryIssue: string;
  currentRoas: number | null;
  breakEvenRoas: number | null;
  estimatedLossToday: number | null;
};

export type LiveKpiCard = MetricCard & {
  reason?: string;
  statusLabel?: string;
  targetValue?: string;
};

export type WatchlistItem = {
  id: string;
  label: string;
  status: "watching" | "alert" | "healthy" | "waiting";
  statusLabel: string;
  detail?: string;
};

export type ActiveIncident = {
  id: string;
  priority: "critical" | "warning" | "positive";
  emoji: string;
  title: string;
  statusLabel: string;
  metricLabel: string;
  metricValue: string;
};

export type LiveAlert = {
  id: string;
  emoji: string;
  message: string;
  priority: "critical" | "warning" | "positive";
};

export type TodaysAiFocus = {
  headline: string;
  expectedMonthlyImprovement: number;
  confidencePct: number;
  primaryRecommendation: string;
  simulationHref: string;
  decisionHref: string;
};

export type LiveMissionControlView = {
  syncedAt: string;
  health: StoreHealthBanner;
  kpis: LiveKpiCard[];
  events: MergedLiveEvent[];
  watchlist: WatchlistItem[];
  incidents: ActiveIncident[];
  alerts: LiveAlert[];
  aiFocus: TodaysAiFocus | null;
  requiresGa4: boolean;
  visionStatement: string;
};
