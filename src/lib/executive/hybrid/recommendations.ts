import type { AnalyzerOutput } from "@/lib/types";
import type { CommerceOpportunity } from "@/lib/insights/opportunity-schema";
import { formatMetricSource, type HybridDataSources } from "./types";

const SIMULATED_AD_NOTE =
  "Advertising assumptions use simulated Meta/Google data — connect live ad accounts for real campaign metrics.";

export function tagSimulatedAdOpportunities(
  opportunities: CommerceOpportunity[],
  sources: HybridDataSources,
): CommerceOpportunity[] {
  if (!sources.adsSimulated) return opportunities;

  return opportunities.map((opp) => {
    if (opp.source !== "meta_ads" && opp.source !== "google_ads") return opp;

    const channelLabel =
      opp.source === "meta_ads" ? sources.meta.label : sources.google.label;

    return {
      ...opp,
      description: opp.description.includes("simulated")
        ? opp.description
        : `${opp.description} (${channelLabel} data — not from a live ad connector.)`,
      supportingMetrics: [
        { label: "Advertising data", value: formatMetricSource(channelLabel) },
        ...opp.supportingMetrics,
      ],
      why: [
        { label: "Advertising data", value: formatMetricSource(channelLabel) },
        ...(opp.why ?? []),
      ],
    };
  });
}

export function annotateSimulatedAdRecommendations(
  outputs: AnalyzerOutput[],
  sources: HybridDataSources,
): AnalyzerOutput[] {
  if (!sources.adsSimulated) return outputs;

  return outputs.map((output) => {
    const isAdCategory =
      output.category === "campaign_review" ||
      output.entityType === "campaign" ||
      /meta|google|campaign|roas|prospect|retarget/i.test(output.title);

    if (!isAdCategory) return output;

    return {
      ...output,
      description: output.description.includes("simulated")
        ? output.description
        : `${output.description} ${SIMULATED_AD_NOTE}`,
      evidence: [
        {
          label: "Advertising data",
          value: formatMetricSource(
            sources.meta.mode === "simulation"
              ? sources.meta.label
              : sources.google.label,
          ),
        },
        ...output.evidence,
      ],
    };
  });
}

export function simulatedAdsDisclaimer(sources: HybridDataSources): string | null {
  if (!sources.adsSimulated) return null;
  const parts: string[] = [];
  if (sources.meta.mode === "simulation") parts.push(sources.meta.label);
  if (sources.google.mode === "simulation") parts.push(sources.google.label);
  return parts.length > 0
    ? `Advertising recommendations may use ${parts.join(" and ")} data until live connectors are linked.`
    : SIMULATED_AD_NOTE;
}
