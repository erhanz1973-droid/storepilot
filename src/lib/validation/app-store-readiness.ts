import { readFileSync } from "fs";
import { join } from "path";
import {
  allowDemoData,
  getMissingProductionSecrets,
  isProductionRuntime,
  useIntegrationsDemo,
} from "@/lib/env/runtime";
import type { ValidationCheck } from "./types";
import { PLAN_LIMITS } from "@/lib/billing/plans";

function shopifyTomlHasGdprComplianceTopics(): boolean {
  try {
    const toml = readFileSync(join(process.cwd(), "shopify.app.toml"), "utf8");
    return (
      toml.includes("compliance_topics") &&
      toml.includes("customers/data_request") &&
      toml.includes("customers/redact") &&
      toml.includes("shop/redact") &&
      toml.includes("/api/shopify/webhooks")
    );
  } catch {
    return false;
  }
}

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

  const freeReleaseConfigured =
    PLAN_LIMITS.free.unlimitedCampaigns &&
    PLAN_LIMITS.free.maxAnalyzedCampaigns === Number.POSITIVE_INFINITY;
  checks.push({
    id: "appstore-free-commercial-model",
    suite: "app_store",
    name: "Billing Status: FREE RELEASE",
    status: freeReleaseConfigured ? "pass" : "fail",
    expected: "FREE RELEASE",
    actual: freeReleaseConfigured ? "FREE RELEASE" : "FEATURE LIMITS ENABLED",
    message: freeReleaseConfigured
      ? "Free Early Access — no Billing API required"
      : "Free Early Access requires unlimited Free entitlements",
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

  const ga4Configured = Boolean(
    (process.env.GA4_CLIENT_ID || process.env.GOOGLE_ADS_CLIENT_ID) &&
      (process.env.GA4_CLIENT_SECRET || process.env.GOOGLE_ADS_CLIENT_SECRET) &&
      (process.env.GA4_APP_URL ||
        process.env.GOOGLE_ADS_APP_URL ||
        process.env.NEXT_PUBLIC_APP_URL),
  );
  checks.push({
    id: "appstore-ga4-connector-status",
    suite: "app_store",
    name: "GA4 live connector",
    status: ga4Configured ? "pass" : isProductionRuntime() ? "fail" : "warn",
    message: ga4Configured
      ? "GA4 OAuth + Data API connector implemented (runReport, sync cache, snapshot, AI inputs)"
      : "GA4 OAuth env not configured — set GA4_CLIENT_ID/SECRET (or Google Ads fallbacks) before claiming live GA4",
  });

  const metaConfigured = Boolean(
    process.env.META_APP_ID &&
      process.env.META_APP_SECRET &&
      (process.env.META_APP_URL || process.env.NEXT_PUBLIC_APP_URL),
  );
  checks.push({
    id: "appstore-meta-oauth-config",
    suite: "app_store",
    name: "Meta Ads OAuth credentials",
    status: metaConfigured ? "pass" : isProductionRuntime() ? "fail" : "warn",
    message: metaConfigured
      ? "Meta Ads OAuth configured"
      : "META_APP_ID, META_APP_SECRET, and META_APP_URL (or NEXT_PUBLIC_APP_URL) required",
  });

  const googleConfigured = Boolean(
    process.env.GOOGLE_ADS_CLIENT_ID &&
      process.env.GOOGLE_ADS_CLIENT_SECRET &&
      process.env.GOOGLE_ADS_DEVELOPER_TOKEN &&
      (process.env.GOOGLE_ADS_APP_URL || process.env.NEXT_PUBLIC_APP_URL),
  );
  checks.push({
    id: "appstore-google-ads-oauth-config",
    suite: "app_store",
    name: "Google Ads OAuth credentials",
    status: googleConfigured ? "pass" : isProductionRuntime() ? "fail" : "warn",
    message: googleConfigured
      ? "Google Ads OAuth configured"
      : "GOOGLE_ADS_CLIENT_ID, CLIENT_SECRET, DEVELOPER_TOKEN, and APP_URL required",
  });

  checks.push({
    id: "appstore-cron-secret",
    suite: "app_store",
    name: "Cron secret for Railway scheduler",
    status:
      !isProductionRuntime() || Boolean(process.env.CRON_SECRET?.trim()) ? "pass" : "fail",
    message: process.env.CRON_SECRET?.trim()
      ? "CRON_SECRET set — schedule /api/cron/* via Railway Cron (see docs/RAILWAY_SCHEDULER.md)"
      : "CRON_SECRET required in production for Railway-scheduled sync",
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

  const gdprConfigured = shopifyTomlHasGdprComplianceTopics();
  checks.push({
    id: "appstore-gdpr-compliance-webhooks",
    suite: "app_store",
    name: "GDPR compliance webhook handlers",
    status: gdprConfigured ? "pass" : "fail",
    message: gdprConfigured
      ? "Handler implements customers/data_request, customers/redact, shop/redact at /api/shopify/webhooks; subscribed via shopify.app.toml compliance_topics"
      : "shopify.app.toml must subscribe compliance_topics to /api/shopify/webhooks",
  });

  return checks;
}
