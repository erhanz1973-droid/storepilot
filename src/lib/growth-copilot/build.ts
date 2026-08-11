import type { StoreSnapshot } from "@/lib/connectors/types";
import type { ProfitDashboard } from "@/lib/profit/types";
import type { Recommendation } from "@/lib/types";
import { buildGrowthChecklist } from "./checklist";
import { classifyMerchantStage } from "./maturity";
import {
  filterHonestEngineRecommendations,
  selectNextBestAction,
} from "./next-best-action";
import { formatUsd, ga4Linked, googleAdsLinked, metaAdsLinked, orderCount, revenueAmount } from "./snapshot-facts";
import { PROFITABILITY_MIN_ORDERS } from "./thresholds";
import type { GrowthCopilotView, KnownFact, MerchantStage } from "./types";

export type BuildGrowthCopilotInput = {
  storeId: string;
  snapshot: StoreSnapshot;
  profitDashboard?: ProfitDashboard | null;
  hasProductCosts?: boolean;
  recommendations?: Recommendation[];
};

function knownFacts(snapshot: StoreSnapshot): KnownFact[] {
  return [
    { label: "Products", value: String(snapshot.products.length) },
    { label: "Orders", value: String(orderCount(snapshot)) },
    { label: "Revenue", value: formatUsd(revenueAmount(snapshot)) },
  ];
}

function unknownFacts(snapshot: StoreSnapshot, showProfit: boolean): KnownFact[] {
  const unknown: KnownFact[] = [];
  if (!metaAdsLinked(snapshot) && !googleAdsLinked(snapshot)) {
    unknown.push(
      { label: "Advertising profitability", value: "Not available yet" },
      { label: "ROAS", value: "Not available yet" },
      { label: "Customer acquisition cost", value: "Not available yet" },
    );
  } else if (!showProfit) {
    unknown.push(
      { label: "Advertising profitability", value: "Need more sales and cost data" },
      { label: "ROAS", value: "Not enough data yet" },
    );
  }
  if (!ga4Linked(snapshot)) {
    unknown.push({ label: "Visitor traffic", value: "GA4 not connected" });
  }
  if (orderCount(snapshot) === 0) {
    unknown.push({ label: "Repeat customers", value: "No sales to measure yet" });
  }
  return unknown;
}

function headlineFor(stage: MerchantStage, snapshot: StoreSnapshot, setupReady: boolean): {
  headline: string;
  lede: string;
} {
  const products = snapshot.products.length;
  const orders = orderCount(snapshot);

  if (stage === "growing") {
    return {
      headline: "Let's optimize what's working.",
      lede: "Your store has enough sales data for StorePilot to prioritize growth and channel performance — not just setup.",
    };
  }
  if (stage === "established") {
    return {
      headline: "Let's improve profitability.",
      lede: "Sales, marketing, and cost signals are in place. StorePilot will focus on profit, blended ROAS, and where to put the next dollar.",
    };
  }

  if (orders === 0 && products > 0) {
    return {
      headline: "Your store is ready for its first sale.",
      lede: "There isn't enough sales data for advanced analytics yet. That's okay. I'll guide you through the most important steps.",
    };
  }

  if (setupReady && orders > 0) {
    return {
      headline: "Let's build your store.",
      lede: "Your store is new, so there isn't enough sales data for advanced analytics yet. That's okay. I'll guide you through the most important next step.",
    };
  }

  return {
    headline: "Let's build your store.",
    lede: "Your store is new, so there isn't enough sales data for advanced analytics yet. That's okay. I'll guide you through the most important steps.",
  };
}

export function buildGrowthCopilotView(input: BuildGrowthCopilotInput): GrowthCopilotView {
  const maturity = classifyMerchantStage({
    snapshot: input.snapshot,
    profitDashboard: input.profitDashboard,
    hasProductCosts: input.hasProductCosts,
  });
  const checklist = buildGrowthChecklist({
    snapshot: input.snapshot,
    maturity,
    profitDashboard: input.profitDashboard,
    hasProductCosts: input.hasProductCosts,
  });
  const known = knownFacts(input.snapshot);
  const nextBestAction = selectNextBestAction({
    snapshot: input.snapshot,
    maturity,
    checklist,
    recommendations: input.recommendations,
    basedOn: known,
  });
  const complete = checklist.filter((step) => step.complete).length;
  const showProfitabilityDashboard =
    maturity.stage !== "new" &&
    orderCount(input.snapshot) >= PROFITABILITY_MIN_ORDERS &&
    Boolean(checklist.find((s) => s.id === "profitability")?.complete);
  const copy = headlineFor(
    maturity.stage,
    input.snapshot,
    Boolean(checklist.find((s) => s.id === "store_setup")?.complete),
  );

  return {
    storeId: input.storeId,
    maturity,
    headline: copy.headline,
    lede: copy.lede,
    nextBestAction,
    checklist,
    progress: {
      complete,
      total: checklist.length,
      label: `${complete} / ${checklist.length} steps complete`,
    },
    known,
    unknown: unknownFacts(input.snapshot, showProfitabilityDashboard),
    basedOn: `Based on: ${input.snapshot.products.length} products · ${orderCount(input.snapshot)} orders · ${formatUsd(revenueAmount(input.snapshot))}`,
    engineRecommendations: filterHonestEngineRecommendations(
      input.recommendations ?? [],
      maturity,
    ).slice(0, 3),
    showProfitabilityDashboard,
  };
}

export function shouldLandOnGrowthCopilot(stage: MerchantStage): boolean {
  return stage === "new";
}
