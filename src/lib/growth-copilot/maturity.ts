import type { StoreSnapshot } from "@/lib/connectors/types";
import type { ProfitDashboard } from "@/lib/profit/types";
import {
  countAcquisitionChannels,
  hasMeaningfulAdsData,
  hasCostOrProfitSignal,
  orderCount,
  revenueAmount,
  shopAgeDays,
} from "./snapshot-facts";
import {
  ESTABLISHED_MIN_ORDERS,
  ESTABLISHED_MIN_REVENUE,
  GROWING_MIN_ORDERS,
  GROWING_MIN_REVENUE,
  GROWING_VOLUME_ORDERS,
  NEW_STORE_MAX_ORDERS,
  NEW_STORE_MAX_REVENUE,
} from "./thresholds";
import type { MerchantExperience, MerchantMaturity, MerchantStage } from "./types";

export const MERCHANT_STAGE_LABELS: Record<MerchantStage, string> = {
  new: "New Store",
  growing: "Growing Store",
  established: "Established Store",
};

export const MERCHANT_EXPERIENCE_LABELS: Record<MerchantExperience, string> = {
  guide_me: "Guide me",
  optimize_me: "Optimize me",
  improve_profitability: "Improve profitability",
};

export function experienceForStage(stage: MerchantStage): MerchantExperience {
  if (stage === "established") return "improve_profitability";
  if (stage === "growing") return "optimize_me";
  return "guide_me";
}

export type ClassifyMerchantStageInput = {
  snapshot: StoreSnapshot;
  profitDashboard?: ProfitDashboard | null;
  hasProductCosts?: boolean;
  now?: Date;
};

export function classifyMerchantStage(input: ClassifyMerchantStageInput): MerchantMaturity {
  const snapshot = input.snapshot;
  const orders = orderCount(snapshot);
  const revenue = revenueAmount(snapshot);
  const productCount = snapshot.products.length;
  const adsConnected =
    snapshot.connectorStates?.meta_ads === "connected" ||
    snapshot.connectorStates?.meta_ads === "demo" ||
    snapshot.connectorStates?.google_ads === "connected" ||
    snapshot.connectorStates?.google_ads === "demo" ||
    (snapshot.campaigns?.length ?? 0) > 0 ||
    Boolean(snapshot.googleAdsSnapshot);
  const meaningfulAdsData = hasMeaningfulAdsData(snapshot);
  const acquisitionChannelCount = countAcquisitionChannels(snapshot);
  const ageDays = shopAgeDays(snapshot, input.now);
  const profitSignal = hasCostOrProfitSignal(
    snapshot,
    input.profitDashboard,
    input.hasProductCosts,
  );

  let stage: MerchantStage = "new";
  let reason: string;

  const established =
    orders >= ESTABLISHED_MIN_ORDERS &&
    revenue >= ESTABLISHED_MIN_REVENUE &&
    (meaningfulAdsData || profitSignal);

  if (established) {
    stage = "established";
    reason = `${orders} orders and ${formatReasonRevenue(revenue)} in 30 days, with ${
      meaningfulAdsData ? "advertising" : "profit"
    } data — enough to optimize profitability.`;
  } else if (orders >= GROWING_VOLUME_ORDERS) {
    stage = "growing";
    reason = `${orders} orders in 30 days is enough sales history to optimize, not just set up.`;
  } else if (orders >= GROWING_MIN_ORDERS && revenue >= GROWING_MIN_REVENUE) {
    stage = "growing";
    reason = `${orders} orders and ${formatReasonRevenue(revenue)} in 30 days — enough signal to optimize.`;
  } else if (orders >= GROWING_MIN_ORDERS && meaningfulAdsData && acquisitionChannelCount >= 2) {
    stage = "growing";
    reason = `${orders} orders plus active advertising across ${acquisitionChannelCount} channels.`;
  } else {
    stage = "new";
    const parts = [`${orders} order${orders === 1 ? "" : "s"}`, formatReasonRevenue(revenue)];
    if (!meaningfulAdsData) parts.push("little or no advertising data");
    if (orders <= NEW_STORE_MAX_ORDERS || revenue < NEW_STORE_MAX_REVENUE) {
      reason = `This store is early (${parts.join(", ")}). StorePilot will guide setup before advanced analytics.`;
    } else {
      reason = `Sales history is still thin (${parts.join(", ")}). StorePilot will guide the next setup steps.`;
    }
  }

  const experience = experienceForStage(stage);
  return {
    stage,
    experience,
    label: MERCHANT_STAGE_LABELS[stage],
    reason,
    orders30d: orders,
    revenue30d: revenue,
    productCount,
    adsConnected,
    meaningfulAdsData,
    acquisitionChannelCount,
    shopAgeDays: ageDays,
  };
}

function formatReasonRevenue(amount: number): string {
  return amount.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: amount >= 100 ? 0 : 2,
  });
}
