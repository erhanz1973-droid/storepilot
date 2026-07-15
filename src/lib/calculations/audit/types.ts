import type { RawFacts } from "../facts/types";
import type { BusinessKPIs } from "../kpis/engine";
import type { Decision } from "../decisions/types";
import type {
  DecisionImpact,
  DecisionImpactPresentation,
} from "../impact/engine";
import type { BusinessModelConfig } from "../business-model/config";
import type { FORMULA_ENGINE_VERSION } from "../version";

/** Single intermediate row in an explained calculation waterfall */
export type CalculationStep = {
  label: string;
  value: number | string | null;
  unit?: "currency" | "percent" | "ratio" | "count" | "days" | "text";
  op?: "input" | "subtract" | "add" | "multiply" | "divide" | "result" | "note";
  source?: string;
  assumed?: boolean;
};

/**
 * Every formula should return this instead of a bare number when explainability is required.
 */
export type ExplainedValue = {
  value: number | null;
  formula: string;
  formulaId: string;
  formulaVersion: string;
  inputs: Record<string, number | string | null | undefined>;
  intermediateSteps: CalculationStep[];
  dataSources?: string[];
  assumptions?: string[];
  warnings?: string[];
  lastUpdatedAt?: string | null;
  confidencePct?: number | null;
};

export type PipelineStageId =
  | "raw_facts"
  | "business_kpis"
  | "decision"
  | "decision_impact"
  | "presentation";

export type PipelineStageSnapshot = {
  stage: PipelineStageId;
  label: string;
  timestamp: string;
  payload: unknown;
};

/**
 * Immutable audit record — do not recalculate; re-display from this object.
 */
export type CalculationAudit = {
  decisionId: string;
  formulaVersion: typeof FORMULA_ENGINE_VERSION | string;
  timestamp: string;
  businessModel: string;
  rawFacts: RawFacts;
  calculatedKPIs: BusinessKPIs;
  decision: Decision;
  decisionImpact: DecisionImpact;
  presentation: DecisionImpactPresentation;
  businessModelConfig?: Pick<
    BusinessModelConfig,
    "businessModel" | "recoveryStrategy" | "recoveryDefinition" | "defaultNetMarginRate"
  >;
  /** Explained metrics produced during this run */
  explained: {
    netProfit?: ExplainedValue;
    businessRecovery?: ExplainedValue;
    advertisingSavings?: ExplainedValue;
    netProfitImpact?: ExplainedValue;
    confidence?: ExplainedValue;
  };
  pipeline: PipelineStageSnapshot[];
  warnings: string[];
  verificationMode: boolean;
  /** Cross-screen binding — same object id on Executive / Approval / Story */
  decisionImpactFingerprint: string;
};

export type CrossScreenSurfaces = {
  executiveHero: number;
  approvalSummary: number;
  story?: number | null;
  askAi?: number | null;
  history?: number | null;
};

export type CrossScreenValidationResult = {
  ok: boolean;
  expected: number;
  surfaces: CrossScreenSurfaces;
  mismatches: Array<{ surface: keyof CrossScreenSurfaces; value: number | null | undefined }>;
};
