/**
 * Demo Data Provider — single entry point for Demo Mode vs Production Mode.
 *
 * Production Mode: live Shopify / Meta / Google / GA4 connectors only.
 * Demo Mode: Alpine Outfitters deterministic showcase data (never touches live stores).
 *
 * Flag: STOREPILOT_ALLOW_DEMO
 *   - unset in development → demo allowed
 *   - "true" → demo allowed (including production if explicitly set)
 *   - "false" → demo disabled
 *
 * When Demo Mode is active for Alpine Outfitters, ALL user-visible business metrics
 * must come from this provider (via getUiMetrics / showcase overrides) — screens
 * must not recalculate independent demo figures.
 */

import { allowDemoData } from "@/lib/env/runtime";
import { DEMO_STORE_ID } from "@/lib/types";
import type { StoreSnapshot } from "@/lib/connectors/types";
import type { AnalyzerOutput, Recommendation } from "@/lib/types";
import type { GA4Snapshot, GoogleAdsSnapshot } from "@/lib/integrations/types";
import type { DailyMetricPoint } from "@/lib/ads/types";
import type { DecisionImpactPresentation } from "@/lib/calculations/impact/engine";
import {
  ALPINE_OUTFITTERS,
  ALPINE_CURATED_RECOMMENDATIONS,
  alpineOutfittersDailyMetrics,
  alpineOutfittersGA4Snapshot,
  alpineOutfittersGoogleAdsSnapshot,
  getAlpineOutfittersSnapshot,
  isAlpineOutfittersSnapshot,
} from "@/lib/demo/alpine-outfitters";
import {
  ALPINE_UI_METRICS,
  type AlpineUiMetrics,
  getAlpineHeroRecommendation,
} from "@/lib/demo/alpine-outfitters/ui-metrics";
import { buildDemoSnapshot, resolveDemoScenarioId } from "@/lib/demo/get-demo-snapshot";
import type { DemoScenarioId } from "@/lib/demo/scenarios/types";
import {
  getAlpineRecoverableProfitPresentation,
  getAlpineShowcaseRecommendations,
} from "@/lib/demo/showcase-overrides";

export type AppDataMode = "production" | "demo";

export type DemoDataProvider = {
  mode: "demo";
  storeId: string;
  storeName: string;
  industry: string;
  /** Store profile constants */
  kpis: typeof ALPINE_OUTFITTERS;
  /** Every user-visible UI metric (single source of truth) */
  getUiMetrics: () => AlpineUiMetrics;
  getSnapshot: (scenarioId?: DemoScenarioId) => StoreSnapshot;
  getGa4: () => GA4Snapshot;
  getGoogleAds: () => GoogleAdsSnapshot;
  getDailyMetrics: () => DailyMetricPoint[];
  getRecommendations: () => AnalyzerOutput[];
  getRecommendationRecords: () => Recommendation[];
  getRecoverableProfitPresentation: () => DecisionImpactPresentation;
  getHeroRecommendation: () => AnalyzerOutput;
};

/** Single configuration switch: Demo Mode vs Production Mode. */
export function getAppDataMode(): AppDataMode {
  return allowDemoData() ? "demo" : "production";
}

export function isDemoModeEnabled(): boolean {
  return getAppDataMode() === "demo";
}

export function isProductionModeEnabled(): boolean {
  return getAppDataMode() === "production";
}

/**
 * Dedicated Demo Data Provider for App Store review, website, and product demos.
 * Returns null when Demo Mode is disabled — callers must use live connectors.
 */
export function getDemoDataProvider(): DemoDataProvider | null {
  if (!isDemoModeEnabled()) return null;

  return {
    mode: "demo",
    storeId: DEMO_STORE_ID,
    storeName: ALPINE_OUTFITTERS.name,
    industry: ALPINE_OUTFITTERS.industry,
    kpis: ALPINE_OUTFITTERS,
    getUiMetrics: () => ALPINE_UI_METRICS,
    getSnapshot(scenarioId) {
      const id = resolveDemoScenarioId(scenarioId);
      if (id === "healthy_growth") {
        return getAlpineOutfittersSnapshot();
      }
      return buildDemoSnapshot(id);
    },
    getGa4: () => alpineOutfittersGA4Snapshot(),
    getGoogleAds: () => alpineOutfittersGoogleAdsSnapshot(),
    getDailyMetrics: () => alpineOutfittersDailyMetrics(),
    getRecommendations: () => ALPINE_CURATED_RECOMMENDATIONS,
    getRecommendationRecords: () => getAlpineShowcaseRecommendations(),
    getRecoverableProfitPresentation: () => getAlpineRecoverableProfitPresentation(),
    getHeroRecommendation: () => getAlpineHeroRecommendation(),
  };
}

/** Convenience: Alpine curated recommendations when snapshot is the showcase store. */
export function getDemoRecommendationsForSnapshot(
  snapshot: StoreSnapshot,
): AnalyzerOutput[] {
  if (!isDemoModeEnabled()) return [];
  if (!isAlpineOutfittersSnapshot(snapshot)) return [];
  return ALPINE_CURATED_RECOMMENDATIONS;
}

/** True when Demo Mode + Alpine Outfitters showcase should own all UI metrics. */
export function shouldUseDemoProviderMetrics(snapshot: StoreSnapshot): boolean {
  return isDemoModeEnabled() && isAlpineOutfittersSnapshot(snapshot);
}

export { ALPINE_OUTFITTERS, isAlpineOutfittersSnapshot, ALPINE_UI_METRICS };
export type { AlpineUiMetrics };
