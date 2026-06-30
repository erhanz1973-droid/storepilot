import {
  allowDemoData,
  getMissingProductionSecrets,
  isProductionRuntime,
  useIntegrationsDemo,
} from "@/lib/env/runtime";
import type { ValidationCheck } from "./types";

/**
 * Automated checks for Shopify App Store / production submission readiness.
 * Run via `npm run validate` or GET /api/validation?run=1
 */
export function validateAppStoreReadiness(): ValidationCheck[] {
  const checks: ValidationCheck[] = [];

  checks.push({
    id: "appstore-production-demo-disabled",
    suite: "app_store",
    name: "Demo data disabled in production",
    status: !isProductionRuntime() || !allowDemoData() ? "pass" : "fail",
    message:
      isProductionRuntime() && allowDemoData()
        ? "STOREPILOT_ALLOW_DEMO must not be true in production"
        : "Demo data policy OK",
  });

  checks.push({
    id: "appstore-integrations-demo-disabled",
    suite: "app_store",
    name: "Integration demo fixtures disabled in production",
    status: !isProductionRuntime() || !useIntegrationsDemo() ? "pass" : "fail",
    message:
      isProductionRuntime() && useIntegrationsDemo()
        ? "Set INTEGRATIONS_DEMO=false in production"
        : "Integration demo policy OK",
  });

  const missingSecrets = getMissingProductionSecrets();
  checks.push({
    id: "appstore-encryption-keys",
    suite: "app_store",
    name: "OAuth token encryption keys",
    status: !isProductionRuntime() || missingSecrets.length === 0 ? "pass" : "fail",
    actual: missingSecrets.length ? missingSecrets.join(", ") : "all set",
    message:
      missingSecrets.length > 0
        ? `Missing production secrets: ${missingSecrets.join(", ")}`
        : "Encryption keys configured (or dev mode)",
  });

  checks.push({
    id: "appstore-shopify-oauth-config",
    suite: "app_store",
    name: "Shopify OAuth credentials",
    status:
      process.env.SHOPIFY_API_KEY && process.env.SHOPIFY_API_SECRET
        ? "pass"
        : isProductionRuntime()
          ? "fail"
          : "warn",
    message:
      process.env.SHOPIFY_API_KEY && process.env.SHOPIFY_API_SECRET
        ? "Shopify API key and secret configured"
        : "SHOPIFY_API_KEY and SHOPIFY_API_SECRET required for App Store",
  });

  checks.push({
    id: "appstore-ga4-connector-status",
    suite: "app_store",
    name: "GA4 live connector",
    status: "warn",
    message:
      "GA4 Data API connector is not implemented — traffic/funnel metrics require GA4 or show empty states. Do not claim live GA4 in listing until shipped.",
  });

  checks.push({
    id: "appstore-synthetic-attribution",
    suite: "app_store",
    name: "Synthetic attribution disabled in production",
    status:
      !isProductionRuntime() || process.env.STOREPILOT_ALLOW_SYNTHETIC_ATTRIBUTION !== "true"
        ? "pass"
        : "fail",
    message:
      process.env.STOREPILOT_ALLOW_SYNTHETIC_ATTRIBUTION === "true"
        ? "Synthetic attribution must not be enabled in production"
        : "Attribution uses live events or returns empty",
  });

  return checks;
}
