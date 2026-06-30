import type { ValidationProviderId } from "@/lib/validation/framework/types";
import type { ProviderTrustLevel } from "./types";

export type ProviderReadiness = "production_ready" | "development" | "not_validated" | "not_connected";

export function resolveProviderReadiness(
  providerId: ValidationProviderId,
  connected: boolean,
  matchScore: number | null,
  trustLevel: ProviderTrustLevel,
): ProviderReadiness {
  if (!connected) return "not_connected";

  if (providerId === "meta") {
    if (matchScore !== null && matchScore >= 99) return "production_ready";
    if (matchScore !== null && matchScore >= 95) return "development";
    return "not_validated";
  }

  if (providerId === "shopify") {
    if (connected && (matchScore === null || matchScore >= 95)) return "development";
    return "not_validated";
  }

  if (providerId === "google" || providerId === "ga4") {
    if (matchScore !== null && matchScore >= 99) return "production_ready";
    return "not_validated";
  }

  if (trustLevel === "trusted") return "production_ready";
  if (trustLevel === "warn") return "development";
  return "not_validated";
}

export const READINESS_LABELS: Record<ProviderReadiness, string> = {
  production_ready: "Production Ready",
  development: "Development",
  not_validated: "Not Validated",
  not_connected: "Not Connected",
};
