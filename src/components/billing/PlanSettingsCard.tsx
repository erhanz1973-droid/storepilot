import Link from "next/link";
import type { StorePlanId } from "@/lib/billing/types";
import { PLAN_LABELS, PLAN_LIMITS } from "@/lib/billing/plans";

type Props = {
  planId: StorePlanId;
};

export function PlanSettingsCard({ planId }: Props) {
  const limits = PLAN_LIMITS[planId];
  const isFree = planId === "free";

  return (
    <section id="plan" className="card" style={{ marginTop: 16 }}>
      <h3 style={{ marginTop: 0 }}>Plan</h3>
      <p style={{ margin: "0 0 8px" }}>
        Current plan: <strong>{PLAN_LABELS[planId]}</strong>
      </p>
      {isFree ? (
        <>
          <p className="muted" style={{ margin: "0 0 12px", fontSize: "0.9rem" }}>
            Free includes every integration and the full AI workflow on{" "}
            <strong>{limits.maxAnalyzedCampaigns} campaign</strong>. Upgrade when you want the
            same intelligence across all campaigns.
          </p>
          <ul className="plan-settings-features" style={{ margin: "0 0 16px", paddingLeft: 20 }}>
            <li>All integrations (Shopify, Meta, Google, GA4, TikTok)</li>
            <li>Full campaign analysis for 1 campaign</li>
            <li>Approval workflow for unlocked campaign</li>
          </ul>
          <button type="button" className="btn btn-primary" disabled title="Billing coming soon">
            Upgrade to Starter
          </button>
          <p className="muted" style={{ margin: "8px 0 0", fontSize: "0.8rem" }}>
            Billing integration coming soon. Set <code>STOREPILOT_PLAN=starter</code> in dev to
            preview unlimited analysis.
          </p>
        </>
      ) : (
        <p className="muted" style={{ margin: 0, fontSize: "0.9rem" }}>
          Unlimited campaigns, ad sets, ads, AI recommendations, and approval workflows.
        </p>
      )}
    </section>
  );
}
