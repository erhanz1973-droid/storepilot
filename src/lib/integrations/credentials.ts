import type { IntegrationDefinition } from "./types";
import { PHASE6_INTEGRATIONS } from "./types";

export function isIntegrationConfigured(def: IntegrationDefinition): boolean {
  if (def.id === "meta_capi") {
    return Boolean(process.env.META_CAPI_PIXEL_ID && process.env.META_CAPI_ACCESS_TOKEN);
  }
  if (def.id === "inventory") {
    return Boolean(process.env.INVENTORY_API_KEY || process.env.CIN7_API_KEY);
  }
  if (def.id === "accounting") {
    return Boolean(
      process.env.QUICKBOOKS_REALM_ID ||
        process.env.XERO_TENANT_ID ||
        process.env.ACCOUNTING_API_KEY,
    );
  }
  if (def.id === "shipping") {
    return Boolean(process.env.SHIPSTATION_API_KEY || process.env.EASYPOST_API_KEY);
  }
  if (def.id === "support") {
    return Boolean(process.env.GORGIAS_API_KEY || process.env.ZENDESK_API_KEY);
  }
  if (def.id === "warehouse") {
    return Boolean(process.env.WAREHOUSE_API_KEY);
  }
  if (def.id === "google_ads") {
    return Boolean(
      process.env.GOOGLE_ADS_CLIENT_ID &&
        process.env.GOOGLE_ADS_CLIENT_SECRET &&
        process.env.GOOGLE_ADS_DEVELOPER_TOKEN,
    );
  }
  if (def.id === "ga4") {
    return Boolean(
      (process.env.GA4_CLIENT_ID ?? process.env.GOOGLE_ADS_CLIENT_ID) &&
        (process.env.GA4_CLIENT_SECRET ?? process.env.GOOGLE_ADS_CLIENT_SECRET),
    );
  }
  return def.envKeys.some((key) => Boolean(process.env[key]?.trim()));
}

import { useIntegrationsDemo } from "@/lib/env/runtime";

export { useIntegrationsDemo };

export function getConfiguredIntegrations(): IntegrationDefinition[] {
  return PHASE6_INTEGRATIONS.filter(isIntegrationConfigured);
}
