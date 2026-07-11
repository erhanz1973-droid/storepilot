import { notFound } from "next/navigation";
import Link from "next/link";
import { DemoGeneratorClient } from "./DemoGeneratorClient";
import { isDevValidationEnabled } from "@/lib/validation/dev-gate";

export const dynamic = "force-dynamic";

export default function DemoGeneratorPage() {
  if (!isDevValidationEnabled()) {
    notFound();
  }

  return (
    <>
      <div className="page-header">
        <h2>Demo Data Generator</h2>
        <p>
          Populate Supabase Shopify sync tables with demo customers, orders, refunds, and inventory
          changes for the active store. Data is tagged with <code>gid://storepilot-demo/</code> and
          can be cleared safely.{" "}
          <Link href="/dev/simulation">Simulation Lab</Link>
          {" · "}
          <Link href="/analytics/executive">Executive Dashboard</Link>
        </p>
      </div>
      <DemoGeneratorClient />
    </>
  );
}
