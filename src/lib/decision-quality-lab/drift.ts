import type { DecisionIntent } from "./intents";
import { INTENT_LABELS } from "./intents";
import { mapDecisionToIntents } from "./intent-mapper";
import type { EnrichedDecisionItem } from "@/lib/decisions/engine/types";

export type DriftBaseline = {
  scenarioId: string;
  businessModel: string;
  expectedIntents: DecisionIntent[];
  sampleDecisionSummary?: string;
  releaseVersion?: string;
  updatedAt: string;
};

export type DriftAlert = {
  scenarioId: string;
  businessModel: string;
  baselineIntents: DecisionIntent[];
  currentIntents: DecisionIntent[];
  baselineSummary?: string;
  currentSummary?: string;
  message: string;
};

const memoryBaselines = new Map<string, DriftBaseline>();

function baselineKey(scenarioId: string, businessModel: string): string {
  return `${scenarioId}::${businessModel}`;
}

export function setDriftBaseline(baseline: Omit<DriftBaseline, "updatedAt">): void {
  memoryBaselines.set(baselineKey(baseline.scenarioId, baseline.businessModel), {
    ...baseline,
    updatedAt: new Date().toISOString(),
  });
}

export function getDriftBaseline(
  scenarioId: string,
  businessModel: string,
): DriftBaseline | undefined {
  return memoryBaselines.get(baselineKey(scenarioId, businessModel));
}

export function detectDecisionDrift(input: {
  scenarioId: string;
  businessModel: string;
  decisions: EnrichedDecisionItem[];
  baseline?: DriftBaseline;
}): DriftAlert | null {
  const baseline =
    input.baseline ?? getDriftBaseline(input.scenarioId, input.businessModel);
  if (!baseline || baseline.expectedIntents.length === 0) return null;

  const top = input.decisions[0];
  if (!top) return null;

  const currentIntents = mapDecisionToIntents(top);
  const overlap = baseline.expectedIntents.filter((i) => currentIntents.includes(i));

  if (overlap.length > 0) return null;

  return {
    scenarioId: input.scenarioId,
    businessModel: input.businessModel,
    baselineIntents: baseline.expectedIntents,
    currentIntents,
    baselineSummary: baseline.sampleDecisionSummary,
    currentSummary: top.summary,
    message: `Decision drift: expected ${baseline.expectedIntents.map((i) => INTENT_LABELS[i] ?? i).join(", ")}, got ${currentIntents.map((i) => INTENT_LABELS[i] ?? i).join(", ") || top.summary}`,
  };
}

export function listDriftBaselines(): DriftBaseline[] {
  return [...memoryBaselines.values()];
}
