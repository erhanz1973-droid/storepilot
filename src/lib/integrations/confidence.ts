import type { StoreSnapshot } from "@/lib/connectors/types";
import type { IntegrationSnapshot } from "./types";
import { PHASE6_INTEGRATIONS } from "./types";
import { useIntegrationsDemo } from "./credentials";
import { isGoogleAdsAvailable } from "@/lib/google-ads/oauth";

export type IntegrationConfidence = {
  scorePct: number;
  level: "High" | "Medium" | "Low";
  liveDataPct: number;
  connectedIntegrations: string[];
  estimatedAreas: string[];
  message: string;
};

export function computeIntegrationConfidence(
  snapshot: StoreSnapshot,
  integration?: IntegrationSnapshot | null,
): IntegrationConfidence {
  const connected: string[] = [];
  const estimated: string[] = [];

  if (
    snapshot.connectorStates?.shopify === "connected" ||
    snapshot.connectorStates?.shopify === "demo"
  ) {
    connected.push("Shopify");
  } else {
    estimated.push("Orders & products");
  }

  if (snapshot.connectorStates?.meta_ads === "connected") connected.push("Meta Ads");
  else if (snapshot.connectorStates?.meta_ads === "demo") connected.push("Meta Ads (demo)");
  else estimated.push("Meta ad spend");

  if (snapshot.googleAdsSnapshot || snapshot.connectorStates?.google_ads === "connected") {
    connected.push("Google Ads");
  } else if (integration?.googleAds) connected.push("Google Ads (demo)");
  else estimated.push("Google Ads");

  if (integration?.tiktokAds) connected.push("TikTok Ads");
  else estimated.push("TikTok Ads");

  if (integration?.klaviyo) connected.push("Klaviyo");
  else estimated.push("Email attribution");

  if (integration?.ga4 || snapshot.ga4Snapshot?.sessions30d) connected.push("GA4");
  else estimated.push("Session & UTM data");

  if (integration?.metaCapi?.enabled) connected.push("Meta CAPI");
  else estimated.push("Server-side Meta events");

  if (integration?.accounting?.liveSync) connected.push("Accounting COGS");
  else if (snapshot.profitRollups) estimated.push("COGS (estimated/manual)");

  if (integration?.shipping?.liveSync) connected.push("Shipping costs");
  else estimated.push("Shipping (estimated)");

  if (integration?.support?.liveSync) connected.push("Support costs");
  if (integration?.warehouse?.liveSync) connected.push("Warehouse costs");
  if (integration?.inventory?.liveSync) connected.push("Live inventory");

  const total = PHASE6_INTEGRATIONS.length + 2;
  const liveCount = connected.length;
  const liveDataPct = Math.round((liveCount / total) * 100);

  let score = 25 + liveCount * 8;
  if (integration?.ga4 || snapshot.ga4Snapshot?.sessions30d) score += 10;
  if (snapshot.ga4Snapshot?.funnelEvents?.verified) score += 6;
  if (integration?.accounting?.liveSync) score += 12;
  if (integration?.shipping?.liveSync) score += 8;
  if (integration?.metaCapi?.enabled) score += 8;
  score = Math.min(100, score);

  let level: IntegrationConfidence["level"] = "Low";
  if (score >= 75) level = "High";
  else if (score >= 50) level = "Medium";

  const message =
    level === "High"
      ? "Most profit and attribution inputs use live connected data."
      : level === "Medium"
        ? "Core store data connected — connect more sources to replace estimates."
        : "Many metrics use estimates — connect Shopify, ads, and accounting for accuracy.";

  return {
    scorePct: score,
    level,
    liveDataPct,
    connectedIntegrations: connected,
    estimatedAreas: estimated.slice(0, 6),
    message,
  };
}

export function shouldUseDemoIntegrations(snapshot: StoreSnapshot): boolean {
  if (snapshot.source === "demo" || snapshot.connectorStates?.shopify === "demo") {
    return true;
  }
  if (snapshot.googleAdsSnapshot) return false;
  if (isGoogleAdsAvailable()) return false;
  return useIntegrationsDemo();
}
