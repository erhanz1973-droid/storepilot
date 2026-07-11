import { resolveActiveStoreId } from "@/lib/store/context";
import { getActiveDemoScenarioId } from "@/lib/demo/scenario-context";
import { DEMO_SCENARIOS } from "@/lib/demo/scenarios/registry";
import { DemoScenarioSwitcher } from "@/components/demo/DemoScenarioSwitcher";
import { isSimulationStoreId } from "@/lib/simulation-lab/store-ids";
import { DEMO_STORE_ID } from "@/lib/types";

/** Persistent banner when viewing fictional demo or simulation data — keyed to active store, not account-wide Shopify links. */
export async function DemoDataBadge() {
  const storeId = await resolveActiveStoreId();
  const isLiveActiveStore = storeId !== DEMO_STORE_ID && !isSimulationStoreId(storeId);
  if (isLiveActiveStore) return null;

  const activeScenarioId = await getActiveDemoScenarioId();
  const scenario = DEMO_SCENARIOS[activeScenarioId];

  return (
    <div className="demo-data-banner" role="status">
      <div className="demo-data-banner-main">
        <span className="demo-data-badge">Demo Mode</span>
        <span>
          <strong>{scenario.storeDisplayName}</strong> — {scenario.description}
        </span>
      </div>
      <DemoScenarioSwitcher activeScenarioId={activeScenarioId} />
    </div>
  );
}
