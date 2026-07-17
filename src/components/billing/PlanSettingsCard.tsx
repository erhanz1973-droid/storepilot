import type { StorePlanId } from "@/lib/billing/types";
import { PLAN_LABELS } from "@/lib/billing/plans";

type Props = {
  planId: StorePlanId;
};

export function PlanSettingsCard({ planId }: Props) {
  return (
    <section id="plan" className="card" style={{ marginTop: 16 }}>
      <h3 style={{ marginTop: 0 }}>Plan</h3>
      <p style={{ margin: "0 0 8px" }}>
        Current plan: <strong>{PLAN_LABELS[planId]}</strong>
      </p>
      <p className="muted" style={{ margin: "0 0 12px", fontSize: "0.9rem" }}>
        Every StorePilot feature is free during Early Access, with no usage-based feature locks.
      </p>
      <ul className="plan-settings-features" style={{ margin: 0, paddingLeft: 20 }}>
        <li>All integrations (Shopify, Meta, Google Ads, GA4, and supported channels)</li>
        <li>Unlimited campaign, ad set, and ad analysis</li>
        <li>All AI recommendations, simulations, and approval workflows</li>
      </ul>
    </section>
  );
}
