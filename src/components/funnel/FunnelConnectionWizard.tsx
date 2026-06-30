import type { FunnelWizardStep } from "@/lib/funnel/types";

export function FunnelConnectionWizard({
  steps,
  setupTimeMinutes,
}: {
  steps: FunnelWizardStep[];
  setupTimeMinutes: number;
}) {
  return (
    <div className="card funnel-connection-wizard">
      <h3 style={{ margin: "0 0 4px" }}>Connection Wizard</h3>
      <p className="muted" style={{ margin: "0 0 16px", fontSize: "0.875rem" }}>
        Estimated setup time: approximately {setupTimeMinutes} minutes
      </p>
      <div className="funnel-wizard-steps">
        {steps.map((s) => (
          <div
            key={s.step}
            className={`funnel-wizard-step ${s.complete ? "complete" : ""}`}
          >
            <div className="funnel-wizard-step-num">
              {s.complete ? "✓" : s.step}
            </div>
            <div>
              <strong>{s.label}</strong>
              <p className="muted" style={{ margin: "2px 0 0", fontSize: "0.85rem" }}>
                {s.description}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
