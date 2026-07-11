/** How a metric channel is resolved in the hybrid pipeline. */
export type ChannelMode = "live" | "simulation" | "hidden";

export type HybridChannelSource = {
  mode: ChannelMode;
  /** Display label, e.g. "Live Shopify", "Meta Simulation" */
  label: string;
};

export type HybridDataSources = {
  shopify: HybridChannelSource;
  meta: HybridChannelSource;
  google: HybridChannelSource;
  ga4: HybridChannelSource;
  /** Metric id → human-readable source label for UI sublabels */
  metricLabels: Record<string, string>;
  /** True when any advertising channel uses simulation data */
  adsSimulated: boolean;
};

export const LIVE_SHOPIFY_LABEL = "Live Shopify";
export const LIVE_META_LABEL = "Live Meta";
export const META_SIMULATION_LABEL = "Meta Simulation";
export const LIVE_GOOGLE_LABEL = "Live Google";
export const GOOGLE_SIMULATION_LABEL = "Google Simulation";
export const LIVE_GA4_LABEL = "Live GA4";
export const GA4_SIMULATION_LABEL = "GA4 Simulation";

export function formatMetricSource(label: string): string {
  return `Source: ${label}`;
}

export function buildMetricLabels(sources: HybridDataSources): Record<string, string> {
  const adsLabel =
    sources.meta.mode === "live" && sources.google.mode === "live"
      ? "Live Meta + Google"
      : sources.meta.mode === "live"
        ? LIVE_META_LABEL
        : sources.google.mode === "live"
          ? LIVE_GOOGLE_LABEL
          : sources.meta.mode === "simulation" && sources.google.mode === "simulation"
            ? "Meta + Google Simulation"
            : sources.meta.mode === "simulation"
              ? META_SIMULATION_LABEL
              : sources.google.mode === "simulation"
                ? GOOGLE_SIMULATION_LABEL
                : "No ad data";

  const ga4Label =
    sources.ga4.mode === "live"
      ? LIVE_GA4_LABEL
      : sources.ga4.mode === "simulation"
        ? GA4_SIMULATION_LABEL
        : null;

  return {
    profit: LIVE_SHOPIFY_LABEL,
    revenue: LIVE_SHOPIFY_LABEL,
    orders: LIVE_SHOPIFY_LABEL,
    aov: LIVE_SHOPIFY_LABEL,
    inventory: LIVE_SHOPIFY_LABEL,
    roas: adsLabel,
    "break-even-roas": LIVE_SHOPIFY_LABEL,
    "cash-flow": LIVE_SHOPIFY_LABEL,
    "ad-spend": adsLabel,
    cvr: ga4Label ?? "Unavailable",
    sessions: ga4Label ?? "Unavailable",
    returning: ga4Label ?? "Unavailable",
    "engagement-rate": ga4Label ?? "Unavailable",
    "avg-session-duration": ga4Label ?? "Unavailable",
  };
}
