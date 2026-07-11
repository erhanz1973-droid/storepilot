import { cache } from "react";
import { computeProfitDashboard } from "@/lib/profit/engine";
import type { ProfitDashboard } from "@/lib/profit/types";
import type { StoreSnapshot } from "@/lib/connectors/types";
import type { CommerceOpportunity } from "@/lib/insights/opportunity-schema";
import type { Opportunity } from "@/lib/types";
import type { AnalyzerOutput } from "@/lib/types";
import { listProductCosts } from "@/lib/db/product-costs";
import { buildLiveAiRecommendation, buildLiveInsights } from "./insights";
import {
  liveAiRecommendationToAnalyzerOutput,
  liveInsightsToCommerceOpportunities,
  liveInsightsToOpportunities,
} from "./opportunities";
import { resolveLinkedShopForExecutive } from "./resolve-linked-shop";
import { buildLiveStoreSnapshot } from "./snapshot";
import type { HybridDataSources } from "@/lib/executive/hybrid";
import {
  annotateSimulatedAdRecommendations,
  tagSimulatedAdOpportunities,
} from "@/lib/executive/hybrid";
import { buildCommerceOpportunities } from "@/lib/insights/engine";

export type LiveExecutiveBundle = {
  storeId: string;
  shopDomain: string;
  snapshot: StoreSnapshot;
  profitDashboard: ProfitDashboard | null;
  liveOpportunities: CommerceOpportunity[];
  liveTopOpportunities: Opportunity[];
  liveAnalyzerOutputs: AnalyzerOutput[];
  dataSources: HybridDataSources;
};

export const getLiveExecutiveBundle = cache(
  async (): Promise<LiveExecutiveBundle | null> => {
    const linked = await resolveLinkedShopForExecutive();
    if (!linked) return null;

    const { snapshot, metrics, dataSources } = await buildLiveStoreSnapshot(linked);
    const costRecords = await listProductCosts(linked.storeId);
    const profitDashboard = computeProfitDashboard(snapshot, costRecords);

    const { criticalIssues, opportunities } = buildLiveInsights(metrics);
    const allInsightItems = [...criticalIssues, ...opportunities];
    let liveOpportunities = liveInsightsToCommerceOpportunities(
      metrics,
      allInsightItems,
    );

    const snapshotOpportunities = buildCommerceOpportunities(snapshot, profitDashboard);
    liveOpportunities = tagSimulatedAdOpportunities(
      [...liveOpportunities, ...snapshotOpportunities],
      dataSources,
    );

    const liveTopOpportunities = liveInsightsToOpportunities(metrics, allInsightItems);

    const liveAnalyzerOutputs: AnalyzerOutput[] = [];
    const aiRec = buildLiveAiRecommendation(metrics);
    if (aiRec) {
      liveAnalyzerOutputs.push(liveAiRecommendationToAnalyzerOutput(aiRec));
    }

    const annotatedOutputs = annotateSimulatedAdRecommendations(
      liveAnalyzerOutputs,
      dataSources,
    );

    return {
      storeId: linked.storeId,
      shopDomain: linked.shopDomain,
      snapshot,
      profitDashboard,
      liveOpportunities,
      liveTopOpportunities,
      liveAnalyzerOutputs: annotatedOutputs,
      dataSources,
    };
  },
);
