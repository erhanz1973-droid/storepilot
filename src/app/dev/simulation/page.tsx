import { notFound } from "next/navigation";
import Link from "next/link";
import { SimulationLabClient } from "./SimulationLabClient";
import { isDevValidationEnabled } from "@/lib/validation/dev-gate";

export const dynamic = "force-dynamic";

export default function SimulationLabPage() {
  if (!isDevValidationEnabled()) {
    notFound();
  }

  return (
    <>
      <div className="page-header">
        <h2>Simulation Lab</h2>
        <p>
          Internal AI regression testing — generate isolated stores, run the full Decision Engine
          pipeline, and compare expected vs actual decisions.{" "}
          <Link href="/dev/decision-engine">Decision Engine QA</Link>
          {" · "}
          <Link href="/dev/decision-quality">Decision Quality Lab</Link>
          {" · "}
          <Link href="/integration-health">Integration Health</Link>
          {" · "}
          <Link href="/dev/simulation-stores">Simulation Stores</Link>
        </p>
      </div>
      <SimulationLabClient />
    </>
  );
}
