import Link from "next/link";
import { resolveActiveStoreId } from "@/lib/store/context";
import { isSimulationStoreId } from "@/lib/simulation-lab/store-ids";
import { listSimulationStores } from "@/lib/simulation-stores/db";
import { getScenarioNarrative } from "@/lib/simulation-stores/scenario-narratives";
import { SimulationBadge } from "./SimulationBadge";

export async function SimulationStoreBanner() {
  const storeId = await resolveActiveStoreId();
  if (!isSimulationStoreId(storeId)) return null;

  const stores = await listSimulationStores();
  const store = stores.find((s) => s.storeId === storeId);
  const narrative = getScenarioNarrative(store?.scenarioId ?? "healthy_store", store?.label);

  return (
    <div className="sim-store-banner" role="alert">
      <div className="sim-store-banner-main">
        <SimulationBadge variant="compact" subtitle={false} />
        <div>
          <strong>You are viewing simulated data — not a live store.</strong>
          <p className="muted" style={{ margin: "4px 0 0", fontSize: "0.9rem" }}>
            {narrative.title}: {narrative.paragraphs.slice(0, 2).join(" ")}
          </p>
        </div>
      </div>
      <Link href="/dev/simulation-stores" className="btn sim-store-banner-link">
        Back to Simulation Lab
      </Link>
    </div>
  );
}
