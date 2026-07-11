import type { ValidationGateReport } from "@/lib/recommendations/validation/types";
import type {
  AiTrustSummary,
  CapabilityMatrixRow,
  DataQualityIssue,
  HealthDimensionStatus,
  MissingDataBlock,
  ProviderHealthDetail,
  SystemSummary,
} from "./types";

export type { AiTrustSummary, SystemSummary };

function authorizedCount(providers: ProviderHealthDetail[]): number {
  return providers.filter((p) => p.authentication.status === "good").length;
}

function dataStatusFromPct(pct: number): HealthDimensionStatus {
  if (pct >= 80) return "good";
  if (pct >= 55) return "warning";
  return "bad";
}

function aiStatusFromPct(pct: number): HealthDimensionStatus {
  if (pct >= 75) return "good";
  if (pct >= 45) return "warning";
  return "bad";
}

function buildConfidenceReductions(input: {
  providers: ProviderHealthDetail[];
  missingBlocks: MissingDataBlock[];
  qualityIssues: DataQualityIssue[];
}): string[] {
  const reductions: string[] = [];

  for (const p of input.providers) {
    if (p.authentication.status === "bad") {
      reductions.push(`Authentication: ${p.label} — ${p.authentication.detail}`);
      continue;
    }
    if (p.dataAvailability.status === "bad") {
      reductions.push(`Data: ${p.label} — ${p.dataAvailability.detail}`);
    } else if (p.dataAvailability.status === "warning") {
      reductions.push(`Data: ${p.label} — ${p.dataAvailability.label}`);
    }
    if (p.aiReadiness.status === "bad") {
      reductions.push(`AI readiness: ${p.label} — ${p.aiReadiness.detail}`);
    } else if (p.aiReadiness.status === "warning") {
      reductions.push(`AI readiness: ${p.label} — ${p.aiReadiness.label}`);
    }
  }

  for (const block of input.missingBlocks) {
    const line = `Data: ${block.headline.replace(/\.$/, "")}`;
    if (!reductions.some((r) => r.includes(block.module))) {
      reductions.push(line);
    }
  }

  for (const issue of input.qualityIssues) {
    if (issue.severity === "critical" || issue.severity === "warning") {
      const line = `Data: ${issue.message}`;
      if (!reductions.includes(line)) {
        reductions.push(line);
      }
    }
  }

  return reductions.slice(0, 8);
}

export function buildAiTrustSummary(input: {
  overallAiReadinessPct: number;
  dataQualityPct: number;
  gate: ValidationGateReport;
  providers: ProviderHealthDetail[];
  missingBlocks: MissingDataBlock[];
  qualityIssues: DataQualityIssue[];
  capabilityMatrix: CapabilityMatrixRow[];
}): AiTrustSummary {
  const authRatio =
    input.providers.length > 0 ? authorizedCount(input.providers) / input.providers.length : 0;
  const gateBoost = input.gate.canGenerateRecommendations ? 12 : 0;
  const criticalPenalty = input.qualityIssues.some((i) => i.severity === "critical") ? 15 : 0;

  const aiTrustScorePct = Math.round(
    Math.min(
      100,
      Math.max(
        0,
        input.dataQualityPct * 0.35 +
          input.overallAiReadinessPct * 0.45 +
          authRatio * 100 * 0.2 +
          gateBoost -
          criticalPenalty,
      ),
    ),
  );

  const confidenceReductions = buildConfidenceReductions({
    providers: input.providers,
    missingBlocks: input.missingBlocks,
    qualityIssues: input.qualityIssues,
  });

  const narrative =
    confidenceReductions.length === 0
      ? "Authentication, data, and validation checks support reliable AI recommendations."
      : aiTrustScorePct >= 70
        ? "AI can recommend actions, but confidence is reduced until authentication, data, or validation gaps are resolved."
        : "Resolve authorization and data gaps before relying on AI decisions — readiness is not yet sufficient.";

  return { aiTrustScorePct, narrative, confidenceReductions };
}

export function buildSystemSummary(input: {
  providers: ProviderHealthDetail[];
  dataQualityPct: number;
  overallAiReadinessPct: number;
  capabilityMatrix: CapabilityMatrixRow[];
  gate: ValidationGateReport;
  generatedAt: string;
  testSuiteRanAt: string | null;
}): SystemSummary {
  const total = input.providers.length;
  const authorized = authorizedCount(input.providers);
  const aiFeaturesAvailable = input.capabilityMatrix.filter((r) => r.status === "ready").length;
  const totalAiFeatures = input.capabilityMatrix.length;

  const authStatus: HealthDimensionStatus =
    authorized === total ? "good" : authorized === 0 ? "bad" : "warning";
  const dataStatus = dataStatusFromPct(input.dataQualityPct);
  const aiStatus = aiStatusFromPct(input.overallAiReadinessPct);

  return {
    authentication: {
      authorizedCount: authorized,
      totalProviders: total,
      label:
        authorized === total
          ? "All platforms authorized"
          : `${authorized} of ${total} authorized`,
      status: authStatus,
    },
    data: {
      qualityPct: input.dataQualityPct,
      label:
        input.dataQualityPct >= 80
          ? "Usable data across sources"
          : input.dataQualityPct >= 55
            ? "Partial data quality"
            : "Data gaps present",
      status: dataStatus,
    },
    aiReadiness: {
      readinessPct: input.overallAiReadinessPct,
      featuresAvailable: aiFeaturesAvailable,
      totalFeatures: totalAiFeatures,
      label:
        input.overallAiReadinessPct >= 75
          ? "AI recommendations reliable"
          : input.overallAiReadinessPct >= 45
            ? "AI with limited confidence"
            : "AI not ready",
      status: aiStatus,
    },
    lastValidationAt: input.testSuiteRanAt ?? input.gate.evaluatedAt ?? input.generatedAt,
    systemStatus:
      authStatus === "bad" || dataStatus === "bad"
        ? "attention"
        : authStatus === "warning" || dataStatus === "warning" || aiStatus === "warning"
          ? "degraded"
          : "operational",
    dataQualityPct: input.dataQualityPct,
    connectedProviders: authorized,
    totalProviders: total,
    aiFeaturesAvailable,
    totalAiFeatures,
  };
}

export function relativeValidationTime(iso: string): string {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} minute${mins === 1 ? "" : "s"} ago`;
  const hours = Math.round(mins / 60);
  if (hours < 48) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  return new Date(iso).toLocaleString();
}
