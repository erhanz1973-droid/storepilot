import type { EnrichedDecisionItem } from "@/lib/decisions/engine/types";
import type { BusinessModel } from "@/lib/business-model/types";
import {
  DROPSHIPPING_FORBIDDEN_INTENTS,
  INTENT_LABELS,
  SCENARIO_EXPECTED_INTENTS,
  type DecisionIntent,
} from "./intents";
import {
  findDecisionsMatchingIntent,
  mapDecisionToIntents,
} from "./intent-mapper";

export type IntentEvaluationVerdict = "pass" | "warn" | "fail";

export type IntentMatchResult = {
  expectedIntent: DecisionIntent;
  expectedLabel: string;
  actualIntents: DecisionIntent[];
  verdict: IntentEvaluationVerdict;
  matchedDecisionSummary?: string;
  confidencePct?: number;
  qualityScorePct?: number;
  reason: string;
};

export type SemanticEvaluationResult = {
  matches: IntentMatchResult[];
  forbiddenHits: string[];
  passCount: number;
  warnCount: number;
  failCount: number;
  accuracyPct: number;
  verdict: IntentEvaluationVerdict;
};

function searchableDecisions(decisions: EnrichedDecisionItem[]): EnrichedDecisionItem[] {
  const open = decisions.filter((d) => d.status === "open" || !d.status);
  return open.length > 0 ? open : decisions;
}

export function evaluateSemanticIntents(input: {
  decisions: EnrichedDecisionItem[];
  scenarioId?: string;
  expectedIntents?: DecisionIntent[];
  forbiddenIntents?: DecisionIntent[];
  businessModel?: BusinessModel;
}): SemanticEvaluationResult {
  const decisions = searchableDecisions(input.decisions);
  const expected =
    input.expectedIntents ??
    (input.scenarioId ? SCENARIO_EXPECTED_INTENTS[input.scenarioId] ?? [] : []);

  const forbidden = [
    ...(input.forbiddenIntents ?? []),
    ...(input.businessModel === "dropshipping" ? DROPSHIPPING_FORBIDDEN_INTENTS : []),
  ];

  const forbiddenHits: string[] = [];
  for (const intent of forbidden) {
    for (const d of decisions) {
      const actual = mapDecisionToIntents(d);
      if (actual.includes(intent)) {
        forbiddenHits.push(`${INTENT_LABELS[intent]} → ${d.summary}`);
      }
    }
  }

  if (expected.length === 0 && forbiddenHits.length === 0) {
    return {
      matches: [],
      forbiddenHits,
      passCount: 1,
      warnCount: 0,
      failCount: 0,
      accuracyPct: 100,
      verdict: "pass",
    };
  }

  const matches: IntentMatchResult[] = expected.map((expectedIntent) => {
    const hits = findDecisionsMatchingIntent(decisions, expectedIntent);
    const best = hits[0];
    if (best) {
      return {
        expectedIntent,
        expectedLabel: INTENT_LABELS[expectedIntent],
        actualIntents: mapDecisionToIntents(best),
        verdict: "pass",
        matchedDecisionSummary: best.summary,
        confidencePct: best.confidencePct,
        qualityScorePct: (best as { qualityScorePct?: number }).qualityScorePct,
        reason: `Semantic intent match: ${INTENT_LABELS[expectedIntent]}`,
      };
    }
    return {
      expectedIntent,
      expectedLabel: INTENT_LABELS[expectedIntent],
      actualIntents: [],
      verdict: "fail",
      reason: `No decision matched intent: ${INTENT_LABELS[expectedIntent]}`,
    };
  });

  const passCount = matches.filter((m) => m.verdict === "pass").length;
  const failCount = matches.filter((m) => m.verdict === "fail").length;
  const warnCount = matches.filter((m) => m.verdict === "warn").length;
  const accuracyPct =
    expected.length > 0 ? Math.round((passCount / expected.length) * 1000) / 10 : 100;

  let verdict: IntentEvaluationVerdict = "pass";
  if (forbiddenHits.length > 0 || (expected.length > 0 && passCount === 0)) {
    verdict = "fail";
  } else if (failCount > 0 && passCount > 0) {
    verdict = "warn";
  } else if (failCount > 0) {
    verdict = "fail";
  }

  return {
    matches,
    forbiddenHits,
    passCount,
    warnCount,
    failCount,
    accuracyPct,
    verdict,
  };
}
