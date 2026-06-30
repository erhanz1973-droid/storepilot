import type { StoreSnapshot } from "@/lib/connectors/types";
import type { AttributionConfidence, CustomerJourney } from "./models";

export function computeAttributionConfidence(
  snapshot: StoreSnapshot,
  journeys: CustomerJourney[],
  hasExplicitEvents: boolean,
): AttributionConfidence {
  const missingData: string[] = [];
  let score = 35;

  const shopifyOk =
    snapshot.connectorStates?.shopify === "connected" ||
    snapshot.connectorStates?.shopify === "demo";
  const metaOk =
    snapshot.connectorStates?.meta_ads === "connected" ||
    snapshot.connectorStates?.meta_ads === "demo";

  if (shopifyOk) score += 20;
  else missingData.push("Shopify orders");

  if (metaOk) score += 15;
  else missingData.push("Meta Ads");

  if (snapshot.profitRollups) score += 10;
  else missingData.push("Profit rollups");

  const avgTouchpoints =
    journeys.length > 0
      ? Math.round(
          (journeys.reduce((s, j) => s + j.touchpoints.length, 0) / journeys.length) * 10,
        ) / 10
      : 0;

  if (avgTouchpoints >= 2.5) score += 12;
  else if (avgTouchpoints >= 1.5) score += 6;
  else missingData.push("Multi-touch journeys");

  if (hasExplicitEvents) score += 15;
  else {
    missingData.push("UTM / pixel journey data (using inferred journeys)");
    score += 5;
  }

  if (snapshot.campaigns.length >= 2) score += 8;

  if (snapshot.ga4Snapshot) {
    score += 12;
    if (snapshot.ga4Snapshot.sourceMedium.length >= 3) score += 5;
  } else {
    missingData.push("GA4 sessions & UTMs");
  }

  if (snapshot.klaviyoSnapshot) {
    score += 10;
  } else {
    missingData.push("Email / SMS attribution (Klaviyo)");
  }

  if (snapshot.metaCapiStatus?.enabled) {
    score += 8;
    if (snapshot.metaCapiStatus.matchRatePct >= 80) score += 5;
  }

  const multiTouchPct =
    journeys.length > 0
      ? Math.round(
          (journeys.filter((j) => j.touchpoints.length > 1).length / journeys.length) * 100,
        )
      : 0;

  const trackingCompletenessPct = Math.min(
    100,
    Math.round(
      (shopifyOk ? 40 : 0) +
        (metaOk ? 30 : 0) +
        (hasExplicitEvents ? 20 : 10) +
        (journeys.length > 20 ? 10 : journeys.length > 5 ? 5 : 0),
    ),
  );

  const identityResolutionPct = Math.min(
    100,
    Math.round(
      (hasExplicitEvents ? 75 : 45) +
        (multiTouchPct > 30 ? 15 : 0) +
        (journeys.length > 30 ? 10 : 0),
    ),
  );

  score = Math.min(100, score);

  let level: AttributionConfidence["level"] = "Low";
  if (score >= 75) level = "High";
  else if (score >= 50) level = "Medium";

  // Never report High when journey or channel evidence is incomplete
  const hasGa4 = Boolean(snapshot.ga4Snapshot?.sourceMedium.length);
  const journeyEvidenceStrong =
    hasExplicitEvents &&
    (avgTouchpoints >= 1.5 || hasGa4) &&
    journeys.length >= 3;
  const channelEvidenceStrong = metaOk || hasGa4;

  if (level === "High" && (!journeyEvidenceStrong || !channelEvidenceStrong)) {
    level = "Medium";
    score = Math.min(score, 74);
  }

  if (!hasExplicitEvents && level === "High") {
    level = "Medium";
    score = Math.min(score, 74);
  }

  if (!channelEvidenceStrong && avgTouchpoints < 2) {
    level = "Low";
    score = Math.min(score, 49);
  }

  const reason =
    level === "High"
      ? "Strong order history, campaign data, and multi-touch journeys support attribution."
      : level === "Medium"
        ? "Attribution uses store orders and ad data; some channels are inferred."
        : "Limited tracking — connect Shopify and Meta, or add UTM parameters for higher confidence.";

  return {
    scorePct: score,
    level,
    reason,
    trackingCompletenessPct,
    identityResolutionPct,
    avgTouchpoints,
    missingData,
  };
}
