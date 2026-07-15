import type { RawFacts } from "../facts/types";
import type { BusinessKPIs } from "../kpis/engine";
import { calculateBusinessKPIs } from "../kpis/engine";
import type { Decision } from "../decisions/types";
import {
  buildDecisionImpactPresentation,
  calculateDecisionImpact,
  type DecisionImpact,
} from "../impact/engine";
import {
  resolveBusinessModelConfig,
  type BusinessModelConfig,
} from "../business-model/config";
import type { BusinessModel, MerchantBusinessProfile } from "@/lib/business-model/types";
import { FORMULA_ENGINE_VERSION } from "../version";
import {
  explainBusinessRecovery,
  explainNetProfit,
  explainNetProfitImpact,
} from "./explained-formulas";
import type { CalculationAudit, ExplainedValue, PipelineStageSnapshot } from "./types";
import { isVerificationMode, verificationLog } from "./verification";

export function decisionImpactFingerprint(impact: DecisionImpact): string {
  const payload = [
    impact.businessRecovery,
    impact.netProfitImpact,
    impact.advertisingSavings ?? 0,
    impact.grossProfitImpact,
    impact.cashFlowImpact,
    impact.confidence,
    impact.paybackDays ?? "",
  ].join("|");
  // FNV-1a 32-bit — portable (no Node crypto / edge issues)
  let h = 0x811c9dc5;
  for (let i = 0; i < payload.length; i++) {
    h ^= payload.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, "0");
}

function stage(
  id: PipelineStageSnapshot["stage"],
  label: string,
  payload: unknown,
): PipelineStageSnapshot {
  return {
    stage: id,
    label,
    timestamp: new Date().toISOString(),
    payload,
  };
}

function explainAdSavingsFromImpact(impact: DecisionImpact): ExplainedValue | undefined {
  if (impact.advertisingSavings == null) return undefined;
  return {
    value: impact.advertisingSavings,
    formula: "Advertising Efficiency Gain (midpoint of projected savings)",
    formulaId: "advertising_savings",
    formulaVersion: FORMULA_ENGINE_VERSION,
    inputs: {
      advertisingSavings: impact.advertisingSavings,
      advertisingSavingsLow: impact.advertisingSavingsLow,
      advertisingSavingsHigh: impact.advertisingSavingsHigh,
    },
    intermediateSteps: [
      {
        label: "Savings (low)",
        value: impact.advertisingSavingsLow,
        unit: "currency",
        op: "input",
      },
      {
        label: "Savings (high)",
        value: impact.advertisingSavingsHigh,
        unit: "currency",
        op: "input",
      },
      {
        label: "Advertising Efficiency Gain",
        value: impact.advertisingSavings,
        unit: "currency",
        op: "result",
      },
    ],
    dataSources: ["Meta Ads", "Google Ads", "Impact Engine"],
  };
}

/**
 * Full pipeline: Raw Facts → KPIs → Decision → Impact → Presentation
 * Returns an immutable CalculationAudit — screens should render from this, not recompute.
 */
export function buildCalculationAudit(input: {
  decisionId?: string;
  decision: Decision;
  rawFacts: RawFacts;
  kpis?: BusinessKPIs;
  businessModel?: BusinessModelConfig | BusinessModel | MerchantBusinessProfile | null;
  lastSyncedAt?: string | null;
}): CalculationAudit {
  const verificationMode = isVerificationMode();
  const config = resolveBusinessModelConfig(input.businessModel ?? null);
  const warnings: string[] = [];
  const timestamp = new Date().toISOString();
  const decisionId =
    input.decisionId ??
    input.decision.id ??
    `DEC-${timestamp.slice(0, 10).replace(/-/g, "")}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;

  const kpis = input.kpis ?? calculateBusinessKPIs(input.rawFacts);
  const pipeline: PipelineStageSnapshot[] = [
    stage("raw_facts", "Raw Facts", input.rawFacts),
    stage("business_kpis", "Business KPIs", kpis),
    stage("decision", "Decision", input.decision),
  ];

  if (input.rawFacts.commerce.cogs <= 0 && input.rawFacts.commerce.revenue > 0) {
    warnings.push("COGS is zero while revenue > 0 — margin may be overstated.");
  }
  if (input.rawFacts.advertising.adSpend <= 0) {
    warnings.push("Ad spend is zero — advertising savings cannot be derived from spend delta.");
  }

  const decisionImpact = calculateDecisionImpact(input.decision, kpis, {
    businessModel: config,
    historicalAccuracyPct: input.rawFacts.historicalPredictionAccuracy,
  });
  pipeline.push(stage("decision_impact", "DecisionImpact", decisionImpact));

  const presentation = buildDecisionImpactPresentation(decisionImpact);
  pipeline.push(stage("presentation", "Presentation", presentation));

  const netProfitExplained = explainNetProfit({
    revenue: kpis.revenue,
    cogs: kpis.cogs,
    shippingCost: kpis.shippingCost,
    refunds: kpis.refunds,
    platformFees: kpis.platformFees,
    adSpend: kpis.adSpend,
    lastUpdatedAt: input.lastSyncedAt ?? null,
    assumptions:
      config.defaultNetMarginRate > 0
        ? [
            `Default net margin rate for ${config.label}: ${Math.round(config.defaultNetMarginRate * 100)}%`,
          ]
        : [],
  });

  const recoveryExplained = explainBusinessRecovery({
    avoidedWaste: decisionImpact.recoverableWaste ?? decisionImpact.advertisingSavingsLow ?? 0,
    advertisingSavings: decisionImpact.advertisingSavings ?? 0,
    recoveredRevenue: decisionImpact.recoverableRevenue ?? decisionImpact.revenueRecovered ?? 0,
    marginImprovement: 0,
    composedValue: decisionImpact.businessRecovery,
    recoveryDefinition: config.recoveryDefinition,
    businessLeakage: decisionImpact.recoverableWaste ?? decisionImpact.businessRecovery,
  });

  const netImpactExplained = explainNetProfitImpact({
    sourceAmount: decisionImpact.sourceAmount,
    netProfitImpact: decisionImpact.netProfitImpact,
    isMarketingEfficiency: config.treatAdSavingsAsEfficiencyGain,
    storeNetMarginPct: kpis.netMarginPct,
  });

  if (verificationMode) {
    verificationLog({
      decisionId,
      formulaVersion: FORMULA_ENGINE_VERSION,
      warnings,
      impact: {
        businessRecovery: decisionImpact.businessRecovery,
        netProfitImpact: decisionImpact.netProfitImpact,
      },
    });
  }

  return {
    decisionId,
    formulaVersion: FORMULA_ENGINE_VERSION,
    timestamp,
    businessModel: config.businessModel,
    rawFacts: input.rawFacts,
    calculatedKPIs: kpis,
    decision: input.decision,
    decisionImpact,
    presentation,
    businessModelConfig: {
      businessModel: config.businessModel,
      recoveryStrategy: config.recoveryStrategy,
      recoveryDefinition: config.recoveryDefinition,
      defaultNetMarginRate: config.defaultNetMarginRate,
    },
    explained: {
      netProfit: netProfitExplained,
      businessRecovery: recoveryExplained,
      advertisingSavings: explainAdSavingsFromImpact(decisionImpact),
      netProfitImpact: netImpactExplained,
      confidence: {
        value: decisionImpact.confidence,
        formula: "Confidence = weighted factors (data quality × sample × stability × history)",
        formulaId: "confidence",
        formulaVersion: FORMULA_ENGINE_VERSION,
        inputs: { confidence: decisionImpact.confidence },
        intermediateSteps: [
          {
            label: "AI Confidence",
            value: `${decisionImpact.confidence}%`,
            unit: "percent",
            op: "result",
          },
        ],
        confidencePct: decisionImpact.confidence,
      },
    },
    pipeline,
    warnings,
    verificationMode,
    decisionImpactFingerprint: decisionImpactFingerprint(decisionImpact),
  };
}
