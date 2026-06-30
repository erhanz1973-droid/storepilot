import { evaluateSemanticIntents } from "@/lib/decision-quality-lab/semantic-evaluator";
import type { EnrichedDecisionItem } from "@/lib/decisions/engine/types";
import type {
  DecisionMatchResult,
  ExpectedDecisionSpec,
  SimulationRunResult,
  SimulationVerdict,
} from "./types";
import type { BusinessModel } from "@/lib/business-model/types";
import { SCENARIO_EXPECTED_INTENTS } from "@/lib/decision-quality-lab/intents";

/** @deprecated Use semantic intent evaluation — kept for backward compatibility */
function normalize(text: string): string {
  return text.toLowerCase().replace(/\s+/g, " ");
}

export function evaluateExpectedDecisions(
  decisions: EnrichedDecisionItem[],
  expected: ExpectedDecisionSpec[],
  forbiddenKeywords: string[] = [],
  options?: { scenarioId?: string; businessModel?: BusinessModel },
): {
  matches: DecisionMatchResult[];
  forbiddenHits: string[];
  passCount: number;
  warnCount: number;
  failCount: number;
  verdict: SimulationVerdict;
  accuracyPct?: number;
} {
  const semantic = evaluateSemanticIntents({
    decisions,
    scenarioId: options?.scenarioId,
    businessModel: options?.businessModel,
    expectedIntents:
      options?.scenarioId && SCENARIO_EXPECTED_INTENTS[options.scenarioId]
        ? SCENARIO_EXPECTED_INTENTS[options.scenarioId]
        : undefined,
  });

  const matches: DecisionMatchResult[] = semantic.matches.map((m) => ({
    expectedId: m.expectedIntent,
    expectedLabel: m.expectedLabel,
    verdict: m.verdict,
    actualSummary: m.matchedDecisionSummary,
    confidencePct: m.confidencePct,
    qualityScorePct: m.qualityScorePct,
    reason: m.reason,
  }));

  if (expected.length > 0 && matches.length === 0) {
    for (const spec of expected) {
      matches.push({
        expectedId: spec.id,
        expectedLabel: spec.label,
        verdict: "fail",
        reason: `Legacy keyword spec not mapped to intent: ${spec.label}`,
      });
    }
  }

  const forbiddenHits = [...semantic.forbiddenHits];
  for (const kw of forbiddenKeywords) {
    const n = normalize(kw);
    const hit = decisions.find((d) =>
      normalize([d.summary, d.why, d.recommendedAction].join(" ")).includes(n),
    );
    if (hit) forbiddenHits.push(`${kw} → ${hit.summary}`);
  }

  let verdict = semantic.verdict;
  if (forbiddenHits.length > 0) verdict = "fail";

  return {
    matches,
    forbiddenHits,
    passCount: semantic.passCount,
    warnCount: semantic.warnCount,
    failCount: semantic.failCount,
    verdict,
    accuracyPct: semantic.accuracyPct,
  };
}

export function aggregateVerdict(results: SimulationRunResult[]): SimulationVerdict {
  if (results.some((r) => r.verdict === "fail")) return "fail";
  if (results.some((r) => r.verdict === "warn")) return "warn";
  return "pass";
}
