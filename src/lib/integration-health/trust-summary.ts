import type { ValidationGateReport } from "@/lib/recommendations/validation/types";
import type {
  AiTrustSummary,
  CapabilityMatrixRow,
  DataQualityIssue,
  MissingDataBlock,
  ProviderHealthDetail,
  SystemSummary,
} from "./types";

export type { AiTrustSummary, SystemSummary };

function connectedCount(providers: ProviderHealthDetail[]): number {
  return providers.filter(
    (p) => p.connectionStatus === "connected" || p.connectionStatus === "demo",
  ).length;
}

function buildConfidenceReductions(input: {
  providers: ProviderHealthDetail[];
  missingBlocks: MissingDataBlock[];
  qualityIssues: DataQualityIssue[];
}): string[] {
  const reductions: string[] = [];

  for (const p of input.providers) {
    if (p.connectionStatus === "disconnected" || p.connectionStatus === "waiting") {
      reductions.push(`${p.label} is disconnected`);
      continue;
    }
    if (!p.tokenValid) {
      reductions.push(`${p.label} token expired or invalid`);
    }
    const missing = p.entityChecks.filter((e) => e.status === "missing");
    if (missing.length > 0 && p.id === "shopify") {
      reductions.push(`Shopify ${missing.map((m) => m.label).join(", ")} are missing`);
    }
    if (p.id === "ga4" && missing.some((m) => m.label === "Ecommerce Events")) {
      reductions.push("GA4 Ecommerce Events are missing");
    }
  }

  for (const block of input.missingBlocks) {
    if (!reductions.some((r) => r.toLowerCase().includes(block.module.toLowerCase()))) {
      reductions.push(block.headline.replace(/\.$/, ""));
    }
  }

  for (const issue of input.qualityIssues) {
    if (issue.severity === "critical" || issue.severity === "warning") {
      if (!reductions.includes(issue.message)) {
        reductions.push(issue.message);
      }
    }
  }

  return reductions.slice(0, 6);
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
  const connectedRatio =
    input.providers.length > 0
      ? connectedCount(input.providers) / input.providers.length
      : 0;
  const gateBoost = input.gate.canGenerateRecommendations ? 12 : 0;
  const criticalPenalty = input.qualityIssues.some((i) => i.severity === "critical") ? 15 : 0;

  const aiTrustScorePct = Math.round(
    Math.min(
      100,
      Math.max(
        0,
        input.dataQualityPct * 0.35 +
          input.overallAiReadinessPct * 0.45 +
          connectedRatio * 100 * 0.2 +
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
      ? "The AI has enough validated business data to generate reliable recommendations."
      : aiTrustScorePct >= 70
        ? "The AI can generate recommendations, but confidence is reduced until data gaps are resolved."
        : "Insufficient validated data — connect integrations and resolve sync gaps before relying on AI decisions.";

  return { aiTrustScorePct, narrative, confidenceReductions };
}

export function buildSystemSummary(input: {
  providers: ProviderHealthDetail[];
  dataQualityPct: number;
  capabilityMatrix: CapabilityMatrixRow[];
  gate: ValidationGateReport;
  generatedAt: string;
  testSuiteRanAt: string | null;
}): SystemSummary {
  const connected = connectedCount(input.providers);
  const total = input.providers.length;
  const aiFeaturesAvailable = input.capabilityMatrix.filter((r) => r.status === "ready").length;
  const totalAiFeatures = input.capabilityMatrix.length;

  let systemStatus: SystemSummary["systemStatus"] = "operational";
  if (connected < total * 0.4 || input.dataQualityPct < 60) {
    systemStatus = "attention";
  } else if (connected < total * 0.7 || input.dataQualityPct < 80) {
    systemStatus = "degraded";
  }

  return {
    systemStatus,
    dataQualityPct: input.dataQualityPct,
    connectedProviders: connected,
    totalProviders: total,
    aiFeaturesAvailable,
    totalAiFeatures,
    lastValidationAt: input.testSuiteRanAt ?? input.gate.evaluatedAt ?? input.generatedAt,
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
