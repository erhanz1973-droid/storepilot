import type { ProfitConfidence, ProfitInputAvailability } from "@/lib/profit/types";
import Link from "next/link";

type SetupStep = {
  id: string;
  title: string;
  description: string;
  href: string;
  complete: boolean;
  skippable: boolean;
};

function buildSteps(confidence: ProfitConfidence): SetupStep[] {
  const inputMap = new Map(confidence.inputs.map((i) => [i.id, i]));

  const isComplete = (id: ProfitInputAvailability["id"], allowEstimated = false) => {
    const row = inputMap.get(id);
    if (!row) return false;
    return row.available && (allowEstimated || !row.estimated);
  };

  return [
    {
      id: "shopify",
      title: "Connect Shopify",
      description: "Sync orders and revenue automatically.",
      href: "/connections?tab=commerce",
      complete: isComplete("revenue"),
      skippable: false,
    },
    {
      id: "ads",
      title: "Connect Advertising Platforms",
      description: "Meta, Google, or TikTok for ad spend in profit calculations.",
      href: "/connections?tab=ads",
      complete: isComplete("advertising"),
      skippable: true,
    },
    {
      id: "cogs",
      title: "Configure Product Costs",
      description: "Add COGS from Shopify, CSV upload, or manual entry.",
      href: "/analytics/profit#product-costs",
      complete: isComplete("product_costs"),
      skippable: false,
    },
    {
      id: "shipping",
      title: "Configure Shipping Costs",
      description: "Carrier integration or manual shipping settings.",
      href: "/connections?tab=operations",
      complete: isComplete("shipping_costs", true),
      skippable: true,
    },
    {
      id: "review",
      title: "Review Profit Settings",
      description: "Confirm fees, packaging, and profit assumptions.",
      href: "/analytics/profit",
      complete: confidence.status === "verified",
      skippable: false,
    },
  ];
}

export function ProfitSetupWizard({
  confidence,
}: {
  confidence: ProfitConfidence;
}) {
  const steps = buildSteps(confidence);
  const nextStep = steps.find((s) => !s.complete && !s.skippable) ?? steps.find((s) => !s.complete);

  return (
    <div className="card profit-setup-wizard">
      <h3>Profit Setup</h3>
      <p className="muted" style={{ marginTop: 0 }}>
        Complete the steps below to unlock verified profitability analytics. We only ask for
        data that cannot be retrieved automatically.
      </p>

      <ol className="profit-setup-steps">
        {steps.map((step, index) => (
          <li
            key={step.id}
            className={`profit-setup-step ${step.complete ? "complete" : ""} ${nextStep?.id === step.id ? "active" : ""}`}
          >
            <div className="profit-setup-step-marker">{step.complete ? "✓" : index + 1}</div>
            <div className="profit-setup-step-body">
              <strong>{step.title}</strong>
              <p className="muted" style={{ margin: "4px 0 8px", fontSize: "0.875rem" }}>
                {step.description}
              </p>
              {!step.complete && (
                <Link href={step.href} className="btn btn-secondary btn-sm">
                  {step.skippable ? "Configure" : "Complete step"}
                </Link>
              )}
            </div>
          </li>
        ))}
      </ol>

      {nextStep && (
        <div style={{ marginTop: 16 }}>
          <Link href={nextStep.href} className="btn btn-primary">
            Continue: {nextStep.title}
          </Link>
        </div>
      )}
    </div>
  );
}
