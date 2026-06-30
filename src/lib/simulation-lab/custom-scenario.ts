import type { BusinessModel } from "@/lib/business-model/types";
import type { CustomScenarioInput, ScenarioParams } from "./types";

export function buildCustomScenarioParams(input: CustomScenarioInput): ScenarioParams {
  const orders30d = Math.max(1, input.orders30d);
  const revenue30d = input.revenue30d;
  const aov = revenue30d / orders30d;
  const totalSpend = input.metaSpend + input.googleSpend;
  const totalRevenueFromRoas = totalSpend * input.roas;
  const metaShare = input.metaSpend / Math.max(totalSpend, 1);
  const sessions30d = Math.round(
    (orders30d / Math.max(input.conversionRate30d ?? 2, 0.5)) * 100,
  );

  const productTitle =
    input.businessModel === "digital_products"
      ? "Digital Product"
      : input.businessModel === "subscription"
        ? "Subscription Box"
        : "Simulation Hero SKU";

  return {
    revenue30d,
    orders30d,
    conversionRate30d: input.conversionRate30d ?? 2,
    metaSpend7d: input.metaSpend,
    metaRevenue7d: Math.round(totalRevenueFromRoas * metaShare * 100) / 100,
    googleSpend7d: input.googleSpend,
    googleRevenue7d:
      Math.round(totalRevenueFromRoas * (1 - metaShare) * 100) / 100,
    sessions30d,
    refundRatePct: 2,
    creativeFatigue: input.creativeFatigue,
    products: [
      {
        id: "sim-custom-1",
        title: productTitle,
        price: Math.round(aov * 100) / 100,
        unitCost: Math.round(aov * 0.32 * 100) / 100,
        inventory: input.inventory,
        unitsSold30d: orders30d,
        tags:
          input.businessModel === "digital_products"
            ? ["digital"]
            : input.businessModel === "subscription"
              ? ["subscription"]
              : [],
      },
    ],
  };
}

export function customInputFromPartial(
  partial: Partial<CustomScenarioInput> & { businessModel: BusinessModel },
): CustomScenarioInput {
  return {
    businessModel: partial.businessModel,
    revenue30d: partial.revenue30d ?? 15000,
    orders30d: partial.orders30d ?? 120,
    metaSpend: partial.metaSpend ?? 2800,
    googleSpend: partial.googleSpend ?? 1400,
    roas: partial.roas ?? 3.2,
    ctr: partial.ctr ?? 2.1,
    creativeFatigue: partial.creativeFatigue ?? "low",
    inventory: partial.inventory ?? 0,
    conversionRate30d: partial.conversionRate30d ?? 2.1,
  };
}
