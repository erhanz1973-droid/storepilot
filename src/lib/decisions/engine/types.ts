import type { DecisionItem } from "@/lib/decisions/center";
import type { MerchantMode } from "@/lib/decisions/merchant-mode";
import type { StrategyComparisonResult } from "@/lib/decisions/strategy-comparison";
import type { ProfitWaterfall } from "@/lib/decisions/product-economics";
import type { BusinessModel, MerchantBusinessProfile } from "@/lib/business-model/types";
import type { DecisionPackContext } from "@/lib/decision-packs/types";
import type { MerchantDNA } from "@/lib/merchant-dna/types";

export type DecisionRejectionReason =
  | "too_aggressive"
  | "need_more_evidence"
  | "will_execute_later"
  | "already_doing"
  | "business_preference"
  | "other";

export const DECISION_REJECTION_LABELS: Record<DecisionRejectionReason, string> = {
  too_aggressive: "Too Aggressive",
  need_more_evidence: "Need More Evidence",
  will_execute_later: "Will Execute Later",
  already_doing: "Already Doing This",
  business_preference: "Business Preference",
  other: "Other",
};

export type ConfidenceBreakdownItem = {
  label: string;
  scorePct: number;
  status: "pass" | "warn" | "fail" | "missing";
  detail?: string;
};

export type DecisionConfidenceBreakdown = {
  overallPct: number;
  components: ConfidenceBreakdownItem[];
};

export type ModeWeightDisplay = {
  label: string;
  weightPct: number;
};

export type DecisionExplainability = {
  scorePct: number;
  validationPct: number;
  confidencePct: number;
  evidenceStatus: "complete" | "partial" | "minimal";
  hasStrategyComparison: boolean;
};

export type StrategyWinnerExplanation = {
  recommendedLabel: string;
  recommendedNetProfit: number;
  runnerUpLabel?: string;
  runnerUpNetProfit?: number;
  profitDifference?: number;
  narrative: string;
  businessReasons: string[];
};

export type EnrichedDecisionItem = DecisionItem & {
  strategyComparison?: StrategyComparisonResult;
  confidenceBreakdown?: DecisionConfidenceBreakdown;
  explainability?: DecisionExplainability;
  profitWaterfall?: ProfitWaterfall;
  modeWeights?: ModeWeightDisplay[];
  merchantMode?: MerchantMode;
  strategyExplanation?: StrategyWinnerExplanation;
  mergedFrom?: string[];
  problemKey?: string;
  businessModel?: BusinessModel;
  businessModelPack?: string;
  businessModelPromptContext?: string;
  merchantDna?: MerchantDNA;
  merchantDnaContext?: string;
};

export type DecisionEngineInput = Parameters<
  typeof import("@/lib/decisions/center").buildDecisionCenter
>[0] & {
  merchantMode?: MerchantMode;
  profitStrategiesByProductId?: Map<string, StrategyComparisonResult>;
  businessProfile?: MerchantBusinessProfile;
  decisionPackContext?: DecisionPackContext;
  merchantDna?: MerchantDNA;
};
