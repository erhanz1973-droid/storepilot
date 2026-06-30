import type { DecisionItem } from "@/lib/decisions/center";
import type { DecisionConfidenceBreakdown, ConfidenceBreakdownItem } from "./types";

function itemStatus(scorePct: number, missing = false): ConfidenceBreakdownItem["status"] {
  if (missing) return "missing";
  if (scorePct >= 95) return "pass";
  if (scorePct >= 80) return "warn";
  return "fail";
}

export function buildDecisionConfidenceBreakdown(
  item: DecisionItem,
): DecisionConfidenceBreakdown {
  const components: ConfidenceBreakdownItem[] = [];
  const validation = item.validation;
  const providers = item.providerFreshness ?? item.validationGate?.providers ?? [];

  for (const provider of providers.filter((p) => p.connected)) {
    const score = provider.matchScore ?? 0;
    components.push({
      label: `${provider.label} Validation`,
      scorePct: score,
      status: itemStatus(score, provider.matchScore === null),
      detail:
        provider.matchScore !== null
          ? `${provider.matchScore}% match`
          : provider.readiness === "not_connected"
            ? "Not connected"
            : "Not validated",
    });
  }

  const shopifyProvider = providers.find((p) => p.providerId === "shopify");
  if (shopifyProvider?.connected) {
    const freshnessScore =
      shopifyProvider.freshness === "fresh"
        ? 95
        : shopifyProvider.freshness === "stale"
          ? 60
          : 50;
    components.push({
      label: "Inventory Freshness",
      scorePct: freshnessScore,
      status: itemStatus(freshnessScore),
      detail: shopifyProvider.cacheAgeMinutes != null
        ? `Synced ${shopifyProvider.cacheAgeMinutes}m ago`
        : undefined,
    });
  }

  const metaProvider = providers.find((p) => p.providerId === "meta");
  const googleProvider = providers.find((p) => p.providerId === "google");
  if (!googleProvider?.connected) {
    components.push({
      label: "Google Ads",
      scorePct: 0,
      status: "missing",
      detail: "Missing — ads strategies use estimates only",
    });
  }
  if (!metaProvider?.connected && item.summary.toLowerCase().includes("campaign")) {
    components.push({
      label: "Meta Ads",
      scorePct: 0,
      status: "missing",
      detail: "Missing — campaign data unavailable",
    });
  }

  if (item.supportingMetrics.length < 2) {
    components.push({
      label: "Sales History",
      scorePct: 55,
      status: "warn",
      detail: "Limited supporting metrics",
    });
  }

  if (validation) {
    const valPct = Math.round(validation.validationConfidence * 100);
    if (!components.some((c) => c.label.includes("Validation"))) {
      components.push({
        label: "Data Validation",
        scorePct: valPct,
        status: itemStatus(valPct),
      });
    }
  }

  const overallPct =
    components.length > 0
      ? Math.round(
          components.reduce((sum, c) => sum + c.scorePct, 0) / components.length,
        )
      : item.confidencePct;

  return { overallPct, components };
}
