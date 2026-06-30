import type { BusinessModel } from "@/lib/business-model/types";
import type { ScenarioParams } from "@/lib/simulation-lab/types";
import { generateSimulationSnapshot } from "@/lib/simulation-lab/generator";
import { simulationStoreIdForModel } from "@/lib/simulation-lab/store-ids";

const BUSINESS_MODELS: BusinessModel[] = [
  "own_inventory",
  "dropshipping",
  "subscription",
  "print_on_demand",
  "digital_products",
  "private_label",
  "hybrid",
];

function rand(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

function randInt(min: number, max: number): number {
  return Math.floor(rand(min, max + 1));
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

export type RandomStoreSpec = {
  id: string;
  businessModel: BusinessModel;
  params: ScenarioParams;
  storeId: string;
};

export function generateRandomStoreParams(seed?: number): ScenarioParams {
  if (seed != null) {
    // Simple seeded shuffle for reproducibility in tests
    let s = seed;
    const next = () => {
      s = (s * 1103515245 + 12345) & 0x7fffffff;
      return s / 0x7fffffff;
    };
    const r = (a: number, b: number) => a + next() * (b - a);
    const orders30d = Math.round(r(20, 400));
    const aov = r(22, 95);
    const revenue30d = Math.round(orders30d * aov);
    const metaSpend7d = Math.round(r(400, 6000));
    const roas = r(0.8, 5.5);
    const metaRevenue7d = Math.round(metaSpend7d * roas);
    const googleSpend7d = Math.round(r(200, 3000));
    const googleRevenue7d = Math.round(googleSpend7d * r(0.7, 4.5));
    return {
      revenue30d,
      orders30d,
      conversionRate30d: Math.round(r(0.6, 4.5) * 10) / 10,
      metaSpend7d,
      metaRevenue7d,
      googleSpend7d,
      googleRevenue7d,
      sessions30d: Math.round(orders30d / (r(0.6, 4) / 100)),
      refundRatePct: Math.round(r(1, 10) * 10) / 10,
      creativeFatigue: pick(["low", "medium", "high"] as const),
      products: [
        {
          id: `mc-${seed}`,
          title: `Random SKU ${seed}`,
          price: Math.round(aov),
          unitCost: Math.round(aov * r(0.25, 0.45)),
          inventory: Math.round(r(0, 200)),
          unitsSold30d: orders30d,
        },
      ],
    };
  }

  const orders30d = randInt(25, 350);
  const aov = rand(24, 88);
  const revenue30d = Math.round(orders30d * aov);
  const metaSpend7d = Math.round(rand(500, 5500));
  const metaRevenue7d = Math.round(metaSpend7d * rand(0.9, 5.2));
  const googleSpend7d = Math.round(rand(250, 2800));
  const googleRevenue7d = Math.round(googleSpend7d * rand(0.8, 4.8));

  return {
    revenue30d,
    orders30d,
    conversionRate30d: Math.round(rand(0.7, 4.2) * 10) / 10,
    metaSpend7d,
    metaRevenue7d,
    googleSpend7d,
    googleRevenue7d,
    sessions30d: Math.round(orders30d / (rand(0.8, 3.8) / 100)),
    refundRatePct: Math.round(rand(1.5, 9) * 10) / 10,
    creativeFatigue: pick(["low", "medium", "high"] as const),
    products: [
      {
        id: `mc-${crypto.randomUUID().slice(0, 8)}`,
        title: "Monte Carlo SKU",
        price: Math.round(aov),
        unitCost: Math.round(aov * rand(0.28, 0.42)),
        inventory: randInt(0, 180),
        unitsSold30d: orders30d,
      },
    ],
  };
}

export function generateRandomStores(count: number, options?: { seedBase?: number }): RandomStoreSpec[] {
  const stores: RandomStoreSpec[] = [];
  for (let i = 0; i < count; i++) {
    const businessModel = pick(BUSINESS_MODELS);
    const params = generateRandomStoreParams(
      options?.seedBase != null ? options.seedBase + i : undefined,
    );
    const storeId = simulationStoreIdForModel(businessModel);
    stores.push({
      id: `random-${i}`,
      businessModel,
      params,
      storeId,
    });
    // Validate consistency
    generateSimulationSnapshot(storeId, params);
  }
  return stores;
}
