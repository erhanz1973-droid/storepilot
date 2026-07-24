/**
 * Runtime environment policy for production vs development.
 *
 * Demo / synthetic merchant data:
 *   - NEVER available in production (Shopify App Store / live merchants)
 *   - Development only when STOREPILOT_ALLOW_DEMO=true
 *   - Never auto-entered for authenticated Shopify merchants
 */

export function isProductionRuntime(): boolean {
  return process.env.NODE_ENV === "production";
}

/** Whether synthetic demo stores / integration fixtures may be used. */
export function allowDemoData(): boolean {
  // Hard kill — production App Store / Railway must never serve fictional merchants.
  if (isProductionRuntime()) return false;
  const flag = process.env.STOREPILOT_ALLOW_DEMO?.trim().toLowerCase();
  // Explicit opt-in only — never default into demo mode.
  return flag === "true";
}

/** Phase-6 integration demo (GA4, TikTok, etc.) — off by default in production. */
export function useIntegrationsDemo(): boolean {
  if (!allowDemoData()) return false;
  return process.env.INTEGRATIONS_DEMO !== "false";
}

/** Whether fabricated attribution journeys may be synthesized from campaign totals. */
export function allowSyntheticAttribution(): boolean {
  return allowDemoData() && process.env.STOREPILOT_ALLOW_SYNTHETIC_ATTRIBUTION === "true";
}

export const REQUIRED_PRODUCTION_SECRETS = [
  "SHOPIFY_TOKEN_ENCRYPTION_KEY",
  "META_TOKEN_ENCRYPTION_KEY",
  "GOOGLE_ADS_TOKEN_ENCRYPTION_KEY",
] as const;

export function getMissingProductionSecrets(): string[] {
  if (!isProductionRuntime()) return [];
  return REQUIRED_PRODUCTION_SECRETS.filter((key) => {
    const value = process.env[key]?.trim();
    return !value || value.length < 32;
  });
}

export function assertProductionSecrets(): void {
  const missing = getMissingProductionSecrets();
  if (missing.length > 0) {
    throw new Error(
      `Missing production encryption keys: ${missing.join(", ")}. Set each to a random string ≥32 characters.`,
    );
  }
}
