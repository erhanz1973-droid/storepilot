import type { StoreSnapshot } from "@/lib/connectors/types";
import type { ProfitDashboard } from "@/lib/profit/types";
import type { DataQualityIssue } from "./types";

export function runDataQualityChecks(
  snapshot: StoreSnapshot,
  profitDashboard: ProfitDashboard | null,
): DataQualityIssue[] {
  const issues: DataQualityIssue[] = [];

  if (snapshot.storeMetrics.revenue30d < 0) {
    issues.push({
      id: "revenue-negative",
      severity: "critical",
      message: "Revenue cannot be negative — check order sync and refunds.",
      source: "shopify",
    });
  }

  const spend =
    snapshot.adSpendSnapshot?.totalRollups.last30d.spend ??
    snapshot.googleAdsSnapshot?.rollups.last30d.spend ??
    0;
  const attributed =
    snapshot.adSpendSnapshot?.totalRollups.last30d.attributedRevenue ??
    snapshot.googleAdsSnapshot?.rollups.last30d.attributedRevenue ??
    0;
  if (spend > 0 && attributed > 0) {
    const impliedRoas = attributed / spend;
    const reported = profitDashboard?.blendedRoas?.blendedRoas30d;
    if (reported != null && Math.abs(impliedRoas - reported) / reported > 0.35) {
      issues.push({
        id: "roas-mismatch",
        severity: "warning",
        message: "Blended ROAS differs from spend ÷ attributed revenue by more than 35%.",
        source: "attribution",
      });
    }
  }

  const negativeInventory = snapshot.products.filter((p) => p.inventoryQuantity < 0);
  if (negativeInventory.length > 0) {
    issues.push({
      id: "inventory-negative",
      severity: "critical",
      message: `${negativeInventory.length} product(s) report inventory below zero.`,
      source: "shopify",
    });
  }

  if (snapshot.customerSnapshot?.dataTier === "aggregated_only") {
    const hasIds = snapshot.customerSnapshot.customers.some((c) => c.id);
    if (!hasIds && snapshot.customerSnapshot.customers.length > 0) {
      issues.push({
        id: "customer-ids-missing",
        severity: "warning",
        message: "Customer records lack stable IDs — LTV and cohort features may be limited.",
        source: "shopify",
      });
    }
  }

  const ga4 = snapshot.ga4Snapshot;
  if (ga4 && ga4.sessions30d > 0 && ga4.ecommerceConversionRatePct == null) {
    issues.push({
      id: "ga4-ecommerce-missing",
      severity: "warning",
      message: "GA4 sessions exist but ecommerce conversion rate is unavailable.",
      source: "ga4",
    });
  }

  if (issues.length === 0) {
    issues.push({
      id: "quality-ok",
      severity: "info",
      message: "No critical data quality issues detected in synced snapshot.",
      source: "system",
    });
  }

  return issues;
}

export function dataQualityScore(issues: DataQualityIssue[]): number {
  const critical = issues.filter((i) => i.severity === "critical").length;
  const warning = issues.filter((i) => i.severity === "warning").length;
  if (critical > 0) return Math.max(0, 60 - critical * 20);
  if (warning > 0) return Math.max(70, 98 - warning * 8);
  return 98;
}
