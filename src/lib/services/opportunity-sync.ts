import type { Opportunity } from "@/lib/types";
import type { CommerceOpportunity } from "@/lib/insights/opportunity-schema";
import {
  expireStaleOpportunities,
  listOpportunityHistory,
  upsertOpportunityDetection,
} from "@/lib/db/opportunity-history";
import { summarizeOpportunityHistory } from "@/lib/opportunities/history";

export async function syncOpportunityHistory(
  storeId: string,
  opportunities: Opportunity[],
  commerceOpportunities: CommerceOpportunity[] = [],
): Promise<ReturnType<typeof summarizeOpportunityHistory>> {
  for (const opp of opportunities) {
    await upsertOpportunityDetection({
      storeId,
      opportunityKey: opp.id,
      title: opp.title,
      category: opp.category,
      estimatedMonthlyRevenue: opp.estimatedMonthlyRevenueImpact,
      estimatedMonthlyProfit: opp.estimatedMonthlyNetProfitImpact,
      confidencePct: Math.round(opp.confidenceScore * 100),
    });
  }

  for (const opp of commerceOpportunities) {
    await upsertOpportunityDetection({
      storeId,
      opportunityKey: opp.id,
      title: opp.title,
      category: opp.category,
      estimatedMonthlyRevenue: opp.expectedImpact.revenueMonthly,
      estimatedMonthlyProfit: opp.expectedImpact.profitMonthly,
      confidencePct: opp.confidence,
    });
  }

  await expireStaleOpportunities(storeId);
  const records = await listOpportunityHistory(storeId);
  return summarizeOpportunityHistory(records);
}
