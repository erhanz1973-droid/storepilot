import type { ReactNode } from "react";

export const EXEC_METRIC_ICONS = {
  profit: "💰",
  recovery: "🚀",
  threat: "🔴",
  opportunity: "🟢",
  confidence: "🧠",
  success: "📈",
  time: "⏱",
  difficulty: "⚙️",
  riskLow: "🟢",
  riskMedium: "🟡",
  riskHigh: "🔴",
  ai: "✨",
} as const;

export function MetricLabel({
  icon,
  children,
  className = "",
}: {
  icon?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span className={`exec-metric-label ${className}`.trim()}>
      {icon && (
        <span className="exec-metric-icon" aria-hidden>
          {icon}
        </span>
      )}
      {children}
    </span>
  );
}
