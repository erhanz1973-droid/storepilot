"use client";

import type { FirstRunStage } from "@/lib/first-run/types";

export function FirstRunProgress({ stages }: { stages: FirstRunStage[] }) {
  return (
    <ol className="first-run-progress" aria-label="Analysis progress">
      {stages.map((stage) => (
        <li
          key={stage.id}
          className={`first-run-progress-item first-run-progress-${stage.status}`}
        >
          <span className="first-run-progress-icon" aria-hidden>
            {stage.status === "done" ? "✓" : stage.status === "active" ? "●" : "○"}
          </span>
          <div>
            <strong>{stage.label}</strong>
            {stage.detail ? <p className="muted">{stage.detail}</p> : null}
          </div>
        </li>
      ))}
    </ol>
  );
}
