"use client";

import { useEffect, useState } from "react";
import type { ExecutiveAiLiveStatus } from "@/lib/analytics/executive-ai-behavior";

export function ExecutiveAiStatusIndicator({
  status,
  compact = false,
}: {
  status: ExecutiveAiLiveStatus;
  compact?: boolean;
}) {
  const [stepIndex, setStepIndex] = useState(0);
  const [showSteps, setShowSteps] = useState(status.state === "analyzing");

  useEffect(() => {
    if (status.state !== "analyzing") {
      setShowSteps(false);
      return;
    }
    setShowSteps(true);
    const timer = setInterval(() => {
      setStepIndex((i) => (i + 1) % status.analysisSteps.length);
    }, 2200);
    const hide = setTimeout(() => setShowSteps(false), status.analysisSteps.length * 2200 + 500);
    return () => {
      clearInterval(timer);
      clearTimeout(hide);
    };
  }, [status.state, status.analysisSteps.length]);

  if (compact) {
    return (
      <div className="exec-ai-status exec-ai-status-compact" role="status">
        <span className={`exec-ai-status-dot ${status.state}`} aria-hidden>
          {status.state === "analyzing" ? "●" : "●"}
        </span>
        <strong className="exec-ai-status-label">{status.statusLabel}</strong>
        {status.domains.slice(0, 4).map((domain) => (
          <span
            key={domain.id}
            className={`exec-ai-compact-chip ${domain.status}`}
            title={domain.statusLabel}
          >
            {domain.label}
          </span>
        ))}
      </div>
    );
  }

  return (
    <div className="exec-ai-status" role="status">
      <div className="exec-ai-status-main">
        <span className={`exec-ai-status-dot ${status.state}`} aria-hidden>
          {status.state === "analyzing" ? "🔄" : "🟢"}
        </span>
        <div>
          <strong className="exec-ai-status-label">{status.statusLabel}</strong>
          {showSteps && status.analysisSteps[stepIndex] && (
            <p className="exec-ai-status-step">{status.analysisSteps[stepIndex]}</p>
          )}
        </div>
      </div>

      {status.domains.length > 0 && (
        <div className="exec-ai-monitoring-grid">
          <span className="exec-ai-monitoring-title">Monitoring</span>
          {status.domains.map((domain) => (
            <div key={domain.id} className={`exec-ai-monitoring-item ${domain.status}`}>
              <span>{domain.label}</span>
              <strong>{domain.statusLabel}</strong>
            </div>
          ))}
        </div>
      )}

      <div className="exec-ai-status-times">
        <span>
          <span className="muted">Last analysis</span>
          <strong>{status.lastAnalysisLabel}</strong>
        </span>
        <span>
          <span className="muted">Next analysis</span>
          <strong>{status.nextAnalysisLabel}</strong>
        </span>
      </div>
    </div>
  );
}
