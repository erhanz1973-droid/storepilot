import type { StoreSnapshot } from "@/lib/connectors/types";
import type { TrafficMix } from "../types";

export function inferTrafficMix(snapshot: StoreSnapshot): {
  trafficMix: TrafficMix;
  primaryChannel: string;
  preferredPlatforms: string[];
} {
  const metaSpend =
    snapshot.campaigns?.reduce((s, c) => s + (c.spend7d ?? 0), 0) ?? 0;
  const googleSpend = snapshot.googleAdsSnapshot?.rollups.last7d.spend ?? 0;
  const tiktokSpend =
    snapshot.tiktokAdsSnapshot?.campaigns?.reduce(
      (s, c) => s + (c.spend7d ?? 0),
      0,
    ) ?? 0;
  const emailRevenue = snapshot.klaviyoSnapshot?.emailAttributedRevenue30d ?? 0;
  const totalPaid = metaSpend + googleSpend + tiktokSpend;

  const preferredPlatforms: string[] = [];
  if (snapshot.connectorStates?.meta_ads === "connected" || metaSpend > 0) {
    preferredPlatforms.push("meta_ads");
  }
  if (snapshot.connectorStates?.google_ads === "connected" || googleSpend > 0) {
    preferredPlatforms.push("google_ads");
  }
  if (snapshot.connectorStates?.tiktok === "connected" || tiktokSpend > 0) {
    preferredPlatforms.push("tiktok");
  }
  if (snapshot.connectorStates?.klaviyo === "connected" || emailRevenue > 0) {
    preferredPlatforms.push("klaviyo");
  }

  if (totalPaid < 50) {
    return {
      trafficMix: emailRevenue > 500 ? "email_first" : "organic_first",
      primaryChannel: emailRevenue > 500 ? "email" : "organic",
      preferredPlatforms,
    };
  }

  const shares = [
    { mix: "meta_first" as const, channel: "meta_ads", spend: metaSpend },
    { mix: "google_first" as const, channel: "google_ads", spend: googleSpend },
    { mix: "tiktok_first" as const, channel: "tiktok", spend: tiktokSpend },
  ].sort((a, b) => b.spend - a.spend);

  const top = shares[0];
  const second = shares[1];
  if (top.spend > 0 && second.spend > top.spend * 0.35) {
    return { trafficMix: "hybrid", primaryChannel: top.channel, preferredPlatforms };
  }

  return {
    trafficMix: top.mix,
    primaryChannel: top.channel,
    preferredPlatforms,
  };
}
