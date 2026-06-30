import type { RecommendationSeverity } from "@/lib/types";

const LABELS: Record<RecommendationSeverity, string> = {
  critical: "Critical",
  high: "High",
  medium: "Medium",
  low: "Low",
};

export function SeverityBadge({ severity }: { severity: RecommendationSeverity }) {
  return (
    <span className={`badge badge-${severity}`}>{LABELS[severity]}</span>
  );
}
