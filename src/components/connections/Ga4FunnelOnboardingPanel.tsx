import type { Ga4FunnelOnboardingStep } from "@/lib/ga4/onboarding";
import { TopLevelOAuthLink } from "@/components/connections/TopLevelOAuthLink";

export function Ga4FunnelOnboardingPanel({
  steps,
  compact = false,
}: {
  steps: Ga4FunnelOnboardingStep[];
  compact?: boolean;
}) {
  const completeCount = steps.filter((s) => s.complete).length;
  const allComplete = completeCount === steps.length;

  return (
    <div className={`ga4-funnel-onboarding ${compact ? "is-compact" : ""}`}>
      <div className="ga4-funnel-onboarding-header">
        <div>
          <h4 style={{ margin: 0 }}>Funnel event setup</h4>
          <p className="muted" style={{ margin: "4px 0 0", fontSize: "0.85rem" }}>
            {allComplete
              ? "Step-level funnel analytics are active."
              : `${completeCount} of ${steps.length} steps complete · ~5 min setup`}
          </p>
        </div>
        {!allComplete && (
          <TopLevelOAuthLink href="/api/ga4/auth" className="btn btn-secondary btn-sm">
            Continue setup
          </TopLevelOAuthLink>
        )}
      </div>
      <div className="funnel-wizard-steps">
        {steps.map((s) => (
          <div
            key={s.step}
            className={`funnel-wizard-step ${s.complete ? "complete" : ""}`}
          >
            <div className="funnel-wizard-step-num">{s.complete ? "✓" : s.step}</div>
            <div>
              <strong>{s.label}</strong>
              <p className="muted" style={{ margin: "2px 0 0", fontSize: "0.85rem" }}>
                {s.description}
              </p>
            </div>
          </div>
        ))}
      </div>
      {!allComplete && (
        <p className="muted" style={{ margin: "12px 0 0", fontSize: "0.8rem" }}>
          Required events: <code>view_item</code>, <code>add_to_cart</code>,{" "}
          <code>begin_checkout</code>, <code>purchase</code>
        </p>
      )}
    </div>
  );
}
