import type { StoreSnapshot } from "@/lib/connectors/types";
import type { ProfitDashboard } from "@/lib/profit/types";
import type { DataSourceStatus, Opportunity, Recommendation } from "@/lib/types";
import { buildIntegrationHealth } from "@/lib/integrations/health";
import { buildCommerceDailyBrief } from "@/lib/insights/daily-brief";
import {
  buildCommerceOpportunities,
  commerceOpportunityToStoreInsight,
} from "@/lib/insights/engine";
import { buildExecutiveSummary } from "@/lib/insights/executive-summary";
import { buildPriorityQueue, generateDailyQuestion } from "@/lib/insights/priority";
import { buildTrendAnalysis } from "@/lib/insights/trends";
import type { StoreManagerDashboard } from "@/lib/insights/types";

export async function buildStoreManagerDashboard(input: {
  snapshot: StoreSnapshot;
  profitDashboard?: ProfitDashboard | null;
  dataSources: DataSourceStatus[];
  storeId: string;
  storeHealthScore?: number;
  topOpportunities: Opportunity[];
  criticalAlerts: Recommendation[];
}): Promise<StoreManagerDashboard> {
  const integrationHealth = await buildIntegrationHealth(
    input.snapshot,
    input.dataSources,
    input.storeId,
  );
  const trends = buildTrendAnalysis(input.snapshot, input.profitDashboard);
  const opportunityFeed = buildCommerceOpportunities(
    input.snapshot,
    input.profitDashboard,
    input.topOpportunities,
  );
  const insights = opportunityFeed.map(commerceOpportunityToStoreInsight);
  const priorityQueue = buildPriorityQueue(
    opportunityFeed,
    input.topOpportunities,
    input.criticalAlerts,
  );
  const executiveSummary = buildExecutiveSummary({
    snapshot: input.snapshot,
    profitDashboard: input.profitDashboard,
    opportunities: opportunityFeed,
    storeHealthScore: input.storeHealthScore,
    dataSources: input.dataSources,
    trends,
  });
  const dailyBrief = buildCommerceDailyBrief({ trends, opportunities: opportunityFeed, snapshot: input.snapshot });

  return {
    dailyQuestion: generateDailyQuestion(priorityQueue, opportunityFeed, {
      snapshot: input.snapshot,
      profitDashboard: input.profitDashboard,
      trends,
    }),
    integrationHealth,
    trends,
    opportunityFeed,
    insights,
    executiveSummary,
    dailyBrief,
    priorityQueue,
    generatedAt: input.snapshot.syncedAt,
  };
}
