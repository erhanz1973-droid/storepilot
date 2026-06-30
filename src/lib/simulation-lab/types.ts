import type { BusinessModel } from "@/lib/business-model/types";
import type { EnrichedDecisionItem } from "@/lib/decisions/engine/types";
import type { RecommendationCategory } from "@/lib/types";
import type { StoreSnapshot } from "@/lib/connectors/types";
import type { ValidationGateReport } from "@/lib/recommendations/validation/types";

export type SimulationScenarioId =
  | "dead_inventory"
  | "winning_product"
  | "roas_collapse"
  | "creative_fatigue"
  | "inventory_overstock"
  | "low_conversion"
  | "high_cpc"
  | "high_refund_rate"
  | "seasonal_demand"
  | "scaling_opportunity"
  | "cash_flow_crisis"
  | "subscription_churn"
  | "price_too_high"
  | "price_too_low"
  | "google_outperforms_meta"
  | "meta_outperforms_google"
  | "organic_growth"
  | "launch_campaign"
  | "healthy_store"
  | "custom";

export type SimulationVerdict = "pass" | "warn" | "fail";

export type ExpectedDecisionSpec = {
  id: string;
  label: string;
  /** Match if any open decision summary/why contains one of these (case-insensitive) */
  matchKeywords: string[];
  /** Optional recommendation categories */
  categories?: RecommendationCategory[];
};

export type ScenarioProductSpec = {
  id: string;
  title: string;
  price: number;
  unitCost: number;
  inventory: number;
  unitsSold30d: number;
  tags?: string[];
};

export type ScenarioParams = {
  revenue30d: number;
  orders30d: number;
  conversionRate30d: number;
  metaSpend7d: number;
  metaRevenue7d: number;
  googleSpend7d: number;
  googleRevenue7d: number;
  sessions30d: number;
  refundRatePct: number;
  products: ScenarioProductSpec[];
  creativeFatigue?: "low" | "medium" | "high";
};

export type SimulationScenarioDefinition = {
  id: SimulationScenarioId;
  label: string;
  description: string;
  defaultBusinessModel: BusinessModel;
  params: ScenarioParams;
  expectedDecisions: ExpectedDecisionSpec[];
  forbiddenDecisionKeywords?: string[];
};

export type SimulationStoreRecord = {
  storeId: string;
  scenarioId: SimulationScenarioId;
  businessModel: BusinessModel;
  snapshot: StoreSnapshot;
  gate: ValidationGateReport;
  generatedAt: string;
  customParams?: Partial<ScenarioParams>;
};

export type DecisionMatchResult = {
  expectedId: string;
  expectedLabel: string;
  verdict: SimulationVerdict;
  actualSummary?: string;
  confidencePct?: number;
  qualityScorePct?: number;
  reason: string;
};

export type SimulationPerformance = {
  generationMs: number;
  validationMs: number;
  decisionEngineMs: number;
  totalMs: number;
  withinTargets: boolean;
};

export type SimulationRunResult = {
  runId: string;
  scenarioId: SimulationScenarioId;
  scenarioLabel: string;
  businessModel: BusinessModel;
  storeId: string;
  verdict: SimulationVerdict;
  passCount: number;
  warnCount: number;
  failCount: number;
  decisionMatches: DecisionMatchResult[];
  forbiddenHits: string[];
  decisions: EnrichedDecisionItem[];
  analyzerCount: number;
  performance: SimulationPerformance;
  generatedAt: string;
  logs: string[];
};

export type SimulationRegressionReport = {
  generatedAt: string;
  totalScenarios: number;
  passed: number;
  warned: number;
  failed: number;
  results: SimulationRunResult[];
  performance: SimulationPerformance;
};

export type CustomScenarioInput = {
  businessModel: BusinessModel;
  revenue30d: number;
  orders30d: number;
  metaSpend: number;
  googleSpend: number;
  roas: number;
  ctr: number;
  creativeFatigue: "low" | "medium" | "high";
  inventory: number;
  conversionRate30d?: number;
};
