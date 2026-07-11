import { FunnelConfidenceBadge } from "@/components/funnel/FunnelConfidenceBadge";
import type { FunnelBottleneck } from "@/lib/funnel/types";

export function FunnelBottleneckCard({ bottleneck }: { bottleneck: FunnelBottleneck }) {
  return (
    <section className="card funnel-bottleneck-card">
      <p className="funnel-workspace-eyebrow">Primary focus</p>
      <h3 style={{ margin: "4px 0 8px" }}>{bottleneck.title}</h3>
      <p className="muted" style={{ margin: "0 0 12px", lineHeight: 1.5 }}>
        {bottleneck.description}
      </p>
      <div className="funnel-bottleneck-footer">
        <strong className="funnel-bottleneck-impact">{bottleneck.impactLabel}</strong>
        <FunnelConfidenceBadge status={bottleneck.confidence} />
      </div>
    </section>
  );
}
