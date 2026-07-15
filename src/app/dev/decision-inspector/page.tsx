import { notFound } from "next/navigation";
import Link from "next/link";
import { isDevValidationEnabled } from "@/lib/validation/dev-gate";
import { DecisionInspectorClient } from "./DecisionInspectorClient";

export const dynamic = "force-dynamic";

export default function DecisionInspectorPage() {
  if (!isDevValidationEnabled()) {
    notFound();
  }

  return (
    <>
      <div className="page-header">
        <h2>Decision Inspector</h2>
        <p>
          Developer tool — Raw Facts → KPIs → Recommendation → DecisionImpact → Presentation.
          Every formula and intermediate value is visible.{" "}
          <Link href="/dev/decision-engine">Decision Engine QA</Link>
          {" · "}
          <Link href="/dev/simulation">Simulation Lab</Link>
        </p>
      </div>
      <DecisionInspectorClient />
    </>
  );
}
