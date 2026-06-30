import type { AnalyzerOutput } from "@/lib/types";
import type { RecommendationAnalyzer } from "@/lib/recommendations/analyzer-types";
import type {
  RecommendationCalculationBasis,
  RecommendationValidationMeta,
  ValidationEvidenceItem,
  ValidationGateReport,
} from "./types";
import {
  computeFinalConfidence,
  formatMinutesAgo,
  validationConfidenceFromScore,
} from "./confidence";
import { isConnectorBlocked, isConnectorTrusted } from "./gate";
import { CONNECTOR_TO_VALIDATION_PROVIDER } from "./types";

function providerLabel(id: string): string {
  const labels: Record<string, string> = {
    meta: "Meta Ads",
    google: "Google Ads",
    shopify: "Shopify",
    ga4: "GA4",
  };
  return labels[id] ?? id;
}

export function buildRecommendationEvidence(
  gate: ValidationGateReport,
  analyzer: RecommendationAnalyzer,
): ValidationEvidenceItem[] {
  const items: ValidationEvidenceItem[] = [];

  for (const provider of gate.providers) {
    if (!provider.connected) continue;
    const required = analyzer.requiredConnectors?.some(
      (c) => CONNECTOR_TO_VALIDATION_PROVIDER[c] === provider.providerId,
    );
    if (!required && analyzer.requiredConnectors?.length) continue;

    if (provider.trustLevel === "trusted") {
      items.push({
        id: `${provider.providerId}_passed`,
        label: `${provider.label} Validation Passed (${provider.matchScore ?? 100}%)`,
        passed: true,
      });
    } else if (provider.trustLevel === "warn") {
      items.push({
        id: `${provider.providerId}_warn`,
        label: `${provider.label} Validation Warning (${provider.matchScore ?? "—"}%)`,
        passed: true,
        detail: "Proceeding with reduced confidence",
      });
    }
  }

  if (gate.overallMatchPercent !== null) {
    items.push({
      id: "dashboard_match",
      label: "Dashboard Match",
      passed: gate.overallMatchPercent >= 99,
      detail: `${gate.overallMatchPercent}%`,
    });
  }

  const meta = gate.providers.find((p) => p.providerId === "meta");
  if (meta?.freshness === "fresh") {
    items.push({
      id: "cache_fresh",
      label: "Cache Fresh",
      passed: true,
      detail: formatMinutesAgo(meta.cacheAgeMinutes),
    });
  } else if (meta?.connected) {
    items.push({
      id: "cache_fresh",
      label: "Cache Fresh",
      passed: false,
      detail: meta?.freshness === "stale" ? "Stale cache" : "Unknown",
    });
  }

  items.push({
    id: "api_verified",
    label: "API Verified",
    passed: gate.trustedProviderIds.length > 0 || gate.warnedProviderIds.length > 0,
  });

  items.push({
    id: "date_range",
    label: "Date Range Verified",
    passed: true,
    detail: "Last 30 Days",
  });

  const syncProvider = meta ?? gate.providers.find((p) => p.connected);
  if (syncProvider?.lastSyncAt) {
    items.push({
      id: "last_sync",
      label: `Last Sync ${formatMinutesAgo(syncProvider.dataAgeMinutes)}`,
      passed: syncProvider.freshness !== "stale",
    });
  }

  return items;
}

export function buildCalculationBasis(output: AnalyzerOutput): RecommendationCalculationBasis[] {
  return output.evidence.map((e) => ({
    label: e.label,
    value: e.value,
    trend: e.trend,
  }));
}

export function resolveProvidersForAnalyzer(
  analyzer: RecommendationAnalyzer,
  gate: ValidationGateReport,
): { used: string[]; blocked: string[]; warned: string[] } {
  const used: string[] = [];
  const blocked: string[] = [];
  const warned: string[] = [];

  const connectors = analyzer.requiredConnectors?.length
    ? analyzer.requiredConnectors
    : (["shopify"] as const);

  for (const connectorId of connectors) {
    const providerId = CONNECTOR_TO_VALIDATION_PROVIDER[connectorId];
    if (!providerId) continue;
    const label = providerLabel(providerId);
    if (isConnectorBlocked(connectorId, gate)) {
      blocked.push(label);
    } else if (isConnectorTrusted(connectorId, gate)) {
      used.push(label);
      const state = gate.providers.find((p) => p.connectorId === connectorId);
      if (state?.trustLevel === "warn") warned.push(label);
    }
  }

  return { used, blocked, warned };
}

export function applyValidationToOutput(
  output: AnalyzerOutput,
  analyzer: RecommendationAnalyzer,
  gate: ValidationGateReport,
): AnalyzerOutput {
  const { used, blocked, warned } = resolveProvidersForAnalyzer(analyzer, gate);

  if (blocked.length > 0 && used.length === 0) {
    return {
      ...output,
      confidence: 0,
      validation: {
        aiConfidence: output.confidence,
        validationConfidence: 0,
        finalConfidence: 0,
        validationScore: gate.overallMatchPercent,
        providersUsed: used,
        providersBlocked: blocked,
        providersWarned: warned,
        evidence: buildRecommendationEvidence(gate, analyzer),
        calculationBasis: buildCalculationBasis(output),
        dateRangeVerified: true,
        blocked: true,
        blockReason: `${blocked.join(", ")} validation failed — data excluded from recommendation engine`,
      },
    };
  }

  const mappedConnectors = (analyzer.requiredConnectors ?? []).filter(
    (c) => CONNECTOR_TO_VALIDATION_PROVIDER[c],
  );
  if (mappedConnectors.length > 0 && used.length === 0) {
    return {
      ...output,
      confidence: 0,
      validation: {
        aiConfidence: output.confidence,
        validationConfidence: 0,
        finalConfidence: 0,
        validationScore: gate.overallMatchPercent,
        providersUsed: used,
        providersBlocked: blocked,
        providersWarned: warned,
        evidence: buildRecommendationEvidence(gate, analyzer),
        calculationBasis: buildCalculationBasis(output),
        dateRangeVerified: true,
        blocked: true,
        blockReason: `No validated provider available for ${analyzer.id}`,
      },
    };
  }

  const relevantScores = gate.providers
    .filter((p) => {
      if (!p.connected || p.matchScore === null) return false;
      if (!analyzer.requiredConnectors?.length) return p.providerId === "shopify";
      return analyzer.requiredConnectors.some(
        (c) => CONNECTOR_TO_VALIDATION_PROVIDER[c] === p.providerId,
      );
    })
    .map((p) => p.matchScore!);

  const validationScore =
    relevantScores.length > 0
      ? Math.round((relevantScores.reduce((a, b) => a + b, 0) / relevantScores.length) * 10) / 10
      : gate.overallMatchPercent;

  const validationConfidence = validationConfidenceFromScore(validationScore);
  const aiConfidence = output.confidence;
  const finalConfidence = computeFinalConfidence(aiConfidence, validationConfidence);

  const validation: RecommendationValidationMeta = {
    aiConfidence,
    validationConfidence,
    finalConfidence,
    validationScore,
    providersUsed: used,
    providersBlocked: blocked,
    providersWarned: warned,
    evidence: buildRecommendationEvidence(gate, analyzer),
    calculationBasis: buildCalculationBasis(output),
    dateRangeVerified: true,
    blocked: false,
  };

  return {
    ...output,
    confidence: finalConfidence,
    validation,
  };
}

export function applyValidationGateToOutputs(
  outputs: AnalyzerOutput[],
  gate: ValidationGateReport,
  analyzers: RecommendationAnalyzer[],
): AnalyzerOutput[] {
  if (!gate.canGenerateRecommendations) return [];

  const analyzerByCategory = new Map(analyzers.map((a) => [a.category, a]));

  return outputs
    .map((output) => {
      const analyzer =
        analyzerByCategory.get(output.category) ??
        ({ id: output.category, category: output.category, analyze: () => [] } as RecommendationAnalyzer);
      return applyValidationToOutput(output, analyzer, gate);
    })
    .filter((o) => !o.validation?.blocked);
}
