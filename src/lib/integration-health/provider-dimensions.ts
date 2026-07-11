import type { IntegrationHealthCard } from "@/lib/integrations/health";
import type { ProviderValidationState } from "@/lib/recommendations/validation/types";
import type { EntityCheck, IntegrationHealthDimension } from "./types";

function dimension(
  label: string,
  detail: string,
  status: IntegrationHealthDimension["status"],
  scorePct?: number | null,
): IntegrationHealthDimension {
  return { label, detail, status, scorePct };
}

export function buildAuthenticationDimension(
  card: IntegrationHealthCard,
  tokenValid: boolean,
): IntegrationHealthDimension {
  if (card.status === "demo") {
    return dimension(
      "Demo access",
      "StorePilot uses curated demo data — no live platform authorization required.",
      "good",
    );
  }

  if (card.status === "disconnected") {
    return dimension(
      "Not authorized",
      "StorePilot cannot access this platform. Connect it in Connections.",
      "bad",
    );
  }

  if (card.status === "waiting") {
    return dimension(
      "Authorization pending",
      "OAuth is available but access has not been granted yet.",
      "warning",
    );
  }

  if (!tokenValid) {
    return dimension(
      "Token expired",
      "Authorization existed but the token is no longer valid. Reconnect to restore access.",
      "bad",
    );
  }

  return dimension(
    "Authorized",
    "StorePilot can access this platform with a valid connection.",
    "good",
  );
}

export function buildDataAvailabilityDimension(input: {
  card: IntegrationHealthCard;
  entityChecks: EntityCheck[];
  entityScore: number;
  dataFreshness: "fresh" | "stale" | "unknown";
  dataQualityPct: number | null;
}): IntegrationHealthDimension {
  const { card, entityChecks, entityScore, dataFreshness, dataQualityPct } = input;

  if (card.status === "disconnected" || card.status === "waiting") {
    return dimension(
      "No data",
      "Without platform access, StorePilot has no usable data from this source.",
      "bad",
      0,
    );
  }

  if (card.syncFailed || card.status === "error") {
    return dimension(
      "Sync interrupted",
      "Access exists but the latest sync failed — data may be incomplete or outdated.",
      "warning",
      Math.min(entityScore, 40),
    );
  }

  const missing = entityChecks.filter((e) => e.status === "missing");
  const partial = entityChecks.filter((e) => e.status === "partial");
  const score = dataQualityPct ?? entityScore;

  if (missing.length > 0 && entityChecks.length > 0 && missing.length === entityChecks.length) {
    return dimension(
      "No usable data",
      `Required datasets are missing: ${missing.map((m) => m.label).join(", ")}.`,
      "bad",
      0,
    );
  }

  if (dataFreshness === "stale") {
    return dimension(
      "Stale data",
      "Data exists but has not synced recently — metrics may not reflect today.",
      "warning",
      score,
    );
  }

  if (missing.length > 0 || partial.length > 0) {
    const gaps = [...missing, ...partial].map((g) => g.label).slice(0, 4);
    return dimension(
      "Partial data",
      gaps.length > 0
        ? `Some datasets are incomplete: ${gaps.join(", ")}.`
        : "Some datasets are incomplete.",
      "warning",
      score,
    );
  }

  if (score < 60) {
    return dimension(
      "Limited data",
      "Synced data is present but quality checks found gaps that limit analysis.",
      "warning",
      score,
    );
  }

  return dimension(
    "Data available",
    "Synced datasets are present and usable for analysis.",
    "good",
    score,
  );
}

export function buildAiReadinessDimension(input: {
  card: IntegrationHealthCard;
  validation: ProviderValidationState | undefined;
  entityScore: number;
  dataDimension: IntegrationHealthDimension;
  authenticationDimension: IntegrationHealthDimension;
}): IntegrationHealthDimension {
  const { card, validation, entityScore, dataDimension, authenticationDimension } = input;

  if (authenticationDimension.status === "bad") {
    return dimension(
      "Not ready",
      "AI cannot use this source until StorePilot is authorized to access the platform.",
      "bad",
      0,
    );
  }

  if (dataDimension.status === "bad") {
    return dimension(
      "Not ready",
      "AI needs usable synced data before it can generate reliable recommendations from this source.",
      "bad",
      Math.min(25, entityScore),
    );
  }

  if (card.syncFailed || card.status === "error") {
    return dimension(
      "Limited confidence",
      "Sync issues reduce how confidently AI can recommend actions from this source.",
      "warning",
      Math.min(45, entityScore),
    );
  }

  const validationScore =
    validation?.readiness === "production_ready"
      ? 100
      : validation?.readiness === "development"
        ? 72
        : validation?.connected
          ? 55
          : 35;

  const dataScore = dataDimension.scorePct ?? entityScore;
  const pct = Math.round(dataScore * 0.55 + validationScore * 0.45);

  if (pct >= 80) {
    return dimension(
      "AI ready",
      "Data quality and validation checks support reliable AI recommendations from this source.",
      "good",
      pct,
    );
  }

  if (pct >= 50) {
    return dimension(
      "Limited confidence",
      "AI can suggest actions but confidence is reduced until data gaps are resolved.",
      "warning",
      pct,
    );
  }

  return dimension(
    "Not ready",
    "Insufficient validated data for reliable AI recommendations from this source.",
    "bad",
    pct,
  );
}
