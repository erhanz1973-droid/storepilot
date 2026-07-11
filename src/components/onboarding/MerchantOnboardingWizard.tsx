import Link from "next/link";
import type { MerchantOnboardingState } from "@/lib/onboarding/merchant-setup";

function stepIcon(status: MerchantOnboardingState["steps"][0]["status"]): string {
  if (status === "complete") return "✓";
  if (status === "current") return "→";
  return "○";
}

export function MerchantOnboardingWizard({ state }: { state: MerchantOnboardingState }) {
  return (
    <div className="card merchant-onboarding-wizard">
      <div className="merchant-onboarding-header">
        <div>
          <h2 style={{ margin: "0 0 6px" }}>{state.headline}</h2>
          <p className="muted" style={{ margin: 0 }}>
            {state.subheadline}
          </p>
        </div>
        <div className="merchant-onboarding-progress-pct" aria-label={`${state.progressPct}% complete`}>
          <strong>{state.progressPct}%</strong>
          <span className="muted">complete</span>
        </div>
      </div>

      <div className="exec-recovery-progress-bar-wrap" style={{ margin: "16px 0 20px" }}>
        <div className="exec-recovery-progress-bar">
          <div
            className="exec-recovery-progress-fill"
            style={{ width: `${state.progressPct}%` }}
          />
        </div>
      </div>

      <ol className="exec-recovery-onboarding-steps">
        {state.steps.map((step) => (
          <li
            key={step.id}
            className={`exec-recovery-onboarding-step exec-recovery-step-${step.status}`}
          >
            <span className="exec-recovery-step-icon" aria-hidden>
              {stepIcon(step.status)}
            </span>
            <div className="merchant-onboarding-step-body">
              <strong>{step.label}</strong>
              <p className="muted" style={{ margin: "4px 0 0" }}>
                {step.description}
              </p>
              {step.status === "current" && (
                <Link href={step.href} className="btn btn-primary" style={{ marginTop: 10 }}>
                  Continue
                </Link>
              )}
              {step.status === "complete" && (
                <Link href={step.href} className="btn btn-secondary" style={{ marginTop: 10 }}>
                  View
                </Link>
              )}
            </div>
          </li>
        ))}
      </ol>

      {state.complete && (
        <div className="merchant-onboarding-complete" role="status">
          <p style={{ margin: 0 }}>
            Setup complete — your recommendations are based on synced merchant data.
          </p>
          <Link href="/analytics/executive" className="btn btn-primary" style={{ marginTop: 12 }}>
            Go to Executive Dashboard
          </Link>
        </div>
      )}
    </div>
  );
}
