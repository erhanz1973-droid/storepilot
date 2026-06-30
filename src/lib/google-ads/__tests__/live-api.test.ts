import fs from "fs";
import path from "path";
import { describe, expect, it } from "vitest";
import { fetchGoogleAdSnapshot } from "../api";
import { buildAdSpendSnapshot } from "@/lib/ads/spend";
import { computeBlendedRoasDashboard } from "@/lib/profit/roas";
import { summarizeGoogleCampaigns } from "../campaign-stats";
import type { StoreSnapshot } from "@/lib/connectors/types";
import { DEMO_STORE_SNAPSHOT } from "@/lib/connectors/demo-data";

function loadDotEnv() {
  const envPath = path.resolve(__dirname, "../../../../.env");
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim();
    if (!process.env[key]) process.env[key] = value;
  }
}

loadDotEnv();

const accessToken = process.env.GOOGLE_ADS_ACCESS_TOKEN;
const customerId = process.env.GOOGLE_ADS_CUSTOMER_ID;
const developerToken = process.env.GOOGLE_ADS_DEVELOPER_TOKEN;
const hasLiveCredentials = Boolean(accessToken && customerId && developerToken);

describe.skipIf(!hasLiveCredentials)("Google Ads live API", () => {
  it("fetches campaigns, daily spend, and conversions from Google Ads API", async () => {
    const snapshot = await fetchGoogleAdSnapshot(accessToken!, customerId!);

    expect(Array.isArray(snapshot.campaigns)).toBe(true);
    expect(snapshot.campaigns.length).toBeGreaterThanOrEqual(0);

    for (const campaign of snapshot.campaigns) {
      expect(campaign.id).toBeTruthy();
      expect(campaign.name).toBeTruthy();
      expect(typeof campaign.spend7d).toBe("number");
      expect(typeof campaign.conversions7d).toBe("number");
      expect(campaign.spend7d).toBeGreaterThanOrEqual(0);
      expect(campaign.conversions7d).toBeGreaterThanOrEqual(0);
    }

    const stats = summarizeGoogleCampaigns(snapshot.campaigns);
    expect(stats.totalCount).toBe(snapshot.campaigns.length);

    expect(snapshot.dailySpend.length).toBeGreaterThan(0);
    expect(snapshot.dailySpend.length).toBeLessThanOrEqual(30);

    const dailySpendTotal = snapshot.dailySpend.reduce((s, d) => s + d.spend, 0);
    expect(snapshot.rollups.last30d.spend).toBeGreaterThanOrEqual(0);
    if (dailySpendTotal > 0) {
      expect(snapshot.rollups.last30d.spend).toBeCloseTo(dailySpendTotal, 0);
    }

    const adSpendSnapshot = buildAdSpendSnapshot({ googleRollups: snapshot.rollups });
    const googlePlatform = adSpendSnapshot.platforms.find((p) => p.platform === "google_ads");
    expect(googlePlatform).toBeDefined();
    expect(googlePlatform?.spendScaled).toBe(false);
    expect(googlePlatform?.rollups.last30d.spend).toBe(snapshot.rollups.last30d.spend);
  });

  it("feeds live Google spend into Blended ROAS dashboard", async () => {
    const googleSnapshot = await fetchGoogleAdSnapshot(accessToken!, customerId!);
    const adSpendSnapshot = buildAdSpendSnapshot({ googleRollups: googleSnapshot.rollups });

    const storeSnapshot: StoreSnapshot = {
      ...DEMO_STORE_SNAPSHOT,
      source: "demo",
      googleAdsSnapshot: googleSnapshot,
      adSpendSnapshot,
      connectorStates: {
        ...DEMO_STORE_SNAPSHOT.connectorStates,
        google_ads: "connected",
      },
      dailyMetrics: googleSnapshot.dailySpend.map((d) => ({
        date: d.date,
        revenue: DEMO_STORE_SNAPSHOT.profitRollups!.last30d.revenue / 30,
        adSpend: d.spend,
        orders: 0,
      })),
    };

    const dashboard = computeBlendedRoasDashboard(storeSnapshot);
    expect(dashboard).not.toBeNull();

    const googleChannel = dashboard!.channels.find((c) => c.channelId === "google_ads");
    expect(googleChannel?.connected).toBe(true);
    expect(googleChannel?.spend).toBe(googleSnapshot.rollups.last30d.spend);

    const period30d = dashboard!.periods.find((p) => p.window === "last30d");
    expect(period30d?.adSpend).toBeGreaterThanOrEqual(googleSnapshot.rollups.last30d.spend);
    if (period30d && period30d.adSpend > 0) {
      expect(period30d.roas).toBeCloseTo(period30d.revenue / period30d.adSpend, 1);
    }
  });
});

describe("Google Ads live API prerequisites", () => {
  it("documents required env vars when live credentials are missing", () => {
    if (hasLiveCredentials) return;
    expect(developerToken).toBeTruthy();
    console.info(
      "[verify:google] Skipping live API tests — set GOOGLE_ADS_ACCESS_TOKEN and GOOGLE_ADS_CUSTOMER_ID in .env (connect via /connections OAuth or dev override).",
    );
  });
});
