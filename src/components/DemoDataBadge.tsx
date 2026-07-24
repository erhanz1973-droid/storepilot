import { tryResolveActiveStoreId } from "@/lib/store/context";
import { getActiveDemoScenarioId } from "@/lib/demo/scenario-context";
import { DEMO_SCENARIOS } from "@/lib/demo/scenarios/registry";
import { DemoScenarioSwitcher } from "@/components/demo/DemoScenarioSwitcher";
import { isSimulationStoreId } from "@/lib/simulation-lab/store-ids";
import { DEMO_STORE_ID } from "@/lib/types";
import { allowDemoData } from "@/lib/env/runtime";

/** Persistent banner when viewing fictional demo or simulation data — never shown in production. */
export async function DemoDataBadge() {
  if (!allowDemoData()) return null;

  const storeId = await tryResolveActiveStoreId();
  if (!storeId) return null;
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
