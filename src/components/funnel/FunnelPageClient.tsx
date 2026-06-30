"use client";

import { FunnelAvailableMetrics } from "@/components/funnel/FunnelAvailableMetrics";
import { FunnelConfidenceCard } from "@/components/funnel/FunnelConfidenceCard";
import { FunnelConnectionWizard } from "@/components/funnel/FunnelConnectionWizard";
import { FunnelFullVisualization } from "@/components/funnel/FunnelFullVisualization";
import { FunnelInsightsPanel } from "@/components/funnel/FunnelInsightsPanel";
import { FunnelLimitationInsight } from "@/components/funnel/FunnelLimitationInsight";
import { FunnelPreviewSection } from "@/components/funnel/FunnelPreviewSection";
import { FunnelStatusCard } from "@/components/funnel/FunnelStatusCard";
import { FunnelWhySection } from "@/components/funnel/FunnelWhySection";
import type { FunnelPageView } from "@/lib/funnel/types";

export function FunnelPageClient({ view }: { view: FunnelPageView }) {
  if (view.mode === "full") {
    return (
      <div className="funnel-page">
        <FunnelStatusCard
          status={view.ga4Status}
          label={view.ga4StatusLabel}
          notice={view.ga4StatusNotice}
        />
        <FunnelConfidenceCard
          confidence={view.confidence}
          score={view.confidenceScore}
          notice={view.confidenceNotice}
        />
        <FunnelFullVisualization steps={view.funnelSteps} />
        <FunnelInsightsPanel insights={view.aiInsights} />
        <FunnelAvailableMetrics
          metrics={view.availableMetrics}
          trafficSources={view.trafficSources}
        />
      </div>
    );
  }

  return (
    <div className="funnel-page">
      <FunnelStatusCard
        status={view.ga4Status}
        label={view.ga4StatusLabel}
        notice={view.ga4StatusNotice}
      />
      <FunnelWhySection />
      <FunnelAvailableMetrics
        metrics={view.availableMetrics}
        trafficSources={view.trafficSources}
      />
      <FunnelPreviewSection stepLabels={view.previewStepLabels} />
      <FunnelLimitationInsight
        message={view.limitationMessage}
        unlockCapabilities={view.unlockCapabilities}
      />
      <FunnelConnectionWizard
        steps={view.wizardSteps}
        setupTimeMinutes={view.setupTimeMinutes}
      />
      <FunnelConfidenceCard
        confidence={view.confidence}
        score={view.confidenceScore}
        notice={view.confidenceNotice}
      />
    </div>
  );
}
