import type { ScenarioParams } from "@/lib/simulation-lab/types";
import { getSimulationStoreById, updateSimulationStoreMeta } from "./db";
import { regenerateSimulationStore } from "./regenerate";
import type { TimeTravelResult } from "./types";

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

/** Advance simulated time — adjusts metrics and regenerates persisted data. */
export async function advanceSimulationTime(
  storeId: string,
  days: number,
): Promise<TimeTravelResult> {
  if (days <= 0) throw new Error("days must be positive");

  const store = await getSimulationStoreById(storeId);
  if (!store) throw new Error("Simulation store not found");

  const scenario = store.scenarioId;
  const baseParams = store.seedParams as Partial<ScenarioParams>;
  const totalDays = (store.meta.simulatedDays ?? 0) + days;

  const dayFactor = 1 + days / 30;
  const inventoryDecay = Math.max(0.55, 1 - days / 120);
  const spendDrift = 1 + (days / 90) * 0.08;
  const revenueDrift =
    scenario === "scaling_opportunity" || scenario === "winning_product"
      ? 1 + days / 45
      : scenario === "roas_collapse" || scenario === "cash_flow_crisis"
        ? 1 - days / 180
        : 1 + days / 120;

  const products = (baseParams.products ?? []).map((p) => {
    const sold = Math.round(p.unitsSold30d * dayFactor);
    const inv = p.inventory > 0 ? Math.max(0, Math.round(p.inventory - sold * (days / 30))) : p.inventory;
    return {
      ...p,
      unitsSold30d: sold,
      inventory: inv,
    };
  });

  const revenue30d = Math.round((baseParams.revenue30d ?? 15000) * revenueDrift * inventoryDecay);
  const orders30d = Math.max(
    1,
    Math.round((baseParams.orders30d ?? 120) * revenueDrift * inventoryDecay),
  );

  const metaSpend7d = Math.round((baseParams.metaSpend7d ?? 2800) * spendDrift);
  const metaRevenue7d = Math.round(
    (baseParams.metaRevenue7d ?? 6200) * revenueDrift * (scenario === "roas_collapse" ? 0.92 : 1),
  );
  const googleSpend7d = Math.round((baseParams.googleSpend7d ?? 1400) * spendDrift);
  const googleRevenue7d = Math.round((baseParams.googleRevenue7d ?? 3800) * revenueDrift);

  const adjusted: Partial<ScenarioParams> = {
    ...baseParams,
    revenue30d,
    orders30d,
    metaSpend7d,
    metaRevenue7d,
    googleSpend7d,
    googleRevenue7d,
    sessions30d: Math.round((baseParams.sessions30d ?? 5200) * clamp(revenueDrift, 0.7, 1.4)),
    refundRatePct: clamp(
      (baseParams.refundRatePct ?? 2) + (scenario === "high_refund_rate" ? days / 30 : 0),
      0,
      25,
    ),
    products,
    creativeFatigue:
      days >= 60 && baseParams.creativeFatigue !== "high"
        ? "medium"
        : days >= 90
          ? "high"
          : baseParams.creativeFatigue,
  };

  await updateSimulationStoreMeta(storeId, {
    simulatedDays: totalDays,
    lastTimeTravelAt: new Date().toISOString(),
    seedParams: adjusted,
  });

  const result = await regenerateSimulationStore({
    storeId,
    scenarioId: store.scenarioId,
    businessModel: store.businessModel,
    customParams: adjusted,
    clearExisting: false,
  });

  return {
    ...result,
    daysAdvanced: days,
    totalSimulatedDays: totalDays,
  };
}
