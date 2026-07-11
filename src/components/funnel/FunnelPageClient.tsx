"use client";

import { FunnelBottleneckCard } from "@/components/funnel/FunnelBottleneckCard";
import { FunnelConversionSnapshot } from "@/components/funnel/FunnelConversionSnapshot";
import { FunnelDataQualityBar } from "@/components/funnel/FunnelDataQualityBar";
import { FunnelFullVisualization } from "@/components/funnel/FunnelFullVisualization";
import { FunnelInsightsPanel } from "@/components/funnel/FunnelInsightsPanel";
import { FunnelOptimizationPanel } from "@/components/funnel/FunnelOptimizationPanel";
import type { FunnelPageView } from "@/lib/funnel/types";

export function FunnelPageClient({ view }: { view: FunnelPageView }) {
  return (
    <div className="funnel-page funnel-workspace">
      {view.bottleneck && <FunnelBottleneckCard bottleneck={view.bottleneck} />}

      <FunnelConversionSnapshot
        metrics={view.availableMetrics}
        trafficSources={view.trafficSources}
        dataTierLabel={view.dataTierLabel}
      />

      {view.funnelSteps.length > 0 && (
        <FunnelFullVisualization
          steps={view.funnelSteps}
          title={view.dataTier === "step_level" ? "Conversion Funnel" : "Session Conversion"}
          subtitle={
            view.dataTier === "session_level"
              ? "Verified session and order counts — connect GA4 ecommerce events in Connections for step-level drop-offs."
              : undefined
          }
        />
      )}

      <FunnelOptimizationPanel actions={view.optimizationActions} />
      <FunnelInsightsPanel insights={view.aiInsights} />

      <FunnelDataQualityBar
        dataTier={view.dataTier}
        confidence={view.confidence}
        confidenceScore={view.confidenceScore}
        notice={view.confidenceNotice}
      />
    </div>
  );
}
