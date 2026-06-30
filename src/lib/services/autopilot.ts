import { aggregateStoreSnapshot } from "@/lib/connectors/registry";
import { listProductCosts } from "@/lib/db/product-costs";
import { listStoredRecommendations } from "@/lib/db/recommendations";
import { computeProfitDashboard } from "@/lib/profit/engine";
import { buildProductIntelligence } from "@/lib/products/engine";
import { buildAttributionDashboard } from "@/lib/attribution/engine";
import { evaluateOpportunities } from "@/lib/opportunities/engine";
import { computeInventorySummary } from "@/lib/inventory/summary";
import { computeHealthScore } from "@/lib/recommendations/registry";
import { buildAutopilotDashboard } from "@/lib/autopilot/engine";
import type { AutopilotDashboard } from "@/lib/autopilot/types";
import type { Recommendation } from "@/lib/types";
import { resolveActiveStoreId } from "@/lib/store/context";
import { recommendationHasMeasurableImpact } from "@/lib/recommendations/impact";

function isActive(rec: Recommendation): boolean {
  const status = rec.status ?? "pending";
  if (!recommendationHasMeasurableImpact(rec)) return false;
  if (["ignored", "approved", "completed", "implemented", "measured"].includes(status)) return false;
  if (status === "snoozed" && rec.snoozedUntil) {
    return new Date(rec.snoozedUntil) <= new Date();
  }
  return true;
}

export async function buildAutopilotIntelligenceDashboard(): Promise<AutopilotDashboard | null> {
  const storeId = await resolveActiveStoreId();
  const snapshot = await aggregateStoreSnapshot(storeId);
  const costRecords = await listProductCosts(storeId);
  const profitDashboard = computeProfitDashboard(snapshot, costRecords);
  const productIntelligence = buildProductIntelligence(snapshot, costRecords, profitDashboard);
  const attributionDashboard = buildAttributionDashboard(snapshot, profitDashboard);
  const netMarginPct = profitDashboard?.primary.profitMarginPct ?? undefined;
  const topOpportunities = evaluateOpportunities(snapshot, {
    limit: 12,
    netMarginPct,
    extra: [
      ...(productIntelligence?.productOpportunities ?? []),
      ...(attributionDashboard?.attributionOpportunities ?? []),
    ],
  });

  const allRecs = await listStoredRecommendations(storeId);
  const activeRecommendations = allRecs.filter(isActive);
  const criticalAlerts = activeRecommendations.filter((r) => r.severity === "critical");
  const inventorySummary = computeInventorySummary(snapshot.products);
  const { score } = computeHealthScore(allRecs, inventorySummary);

  if (!profitDashboard && snapshot.storeMetrics.orders30d === 0) return null;

  return buildAutopilotDashboard(
    {
      snapshot,
      profitDashboard,
      productIntelligence,
      attributionDashboard,
      topOpportunities,
      activeRecommendations,
      criticalAlerts,
      storeHealthScore: score,
    },
    allRecs,
  );
}
