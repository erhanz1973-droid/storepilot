import { notFound } from "next/navigation";
import Link from "next/link";
import { isDevValidationEnabled } from "@/lib/validation/dev-gate";
import { DecisionQualityLabClient } from "./DecisionQualityLabClient";

export const dynamic = "force-dynamic";

export default function DecisionQualityLabPage() {
  if (!isDevValidationEnabled()) {
    notFound();
  }

  return (
    <>
      <div className="page-header">
        <h2>Decision Quality Lab</h2>
        <p>
          Measure decision quality — semantic intent evaluation, self-assessment, regression,
          drift detection, and release gates.{" "}
          <Link href="/dev/simulation">Simulation Lab</Link>
          {" · "}
          <Link href="/dev/decision-engine">Decision Engine QA</Link>
          {" · "}
          <Link href="/integration-health">Integration Health</Link>
        </p>
      </div>
      <DecisionQualityLabClient />
    </>
  );
}
