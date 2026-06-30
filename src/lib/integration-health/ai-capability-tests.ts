import { breakEvenFromProfitPeriod } from "@/lib/attribution/break-even-roas";
import type { StoreSnapshot } from "@/lib/connectors/types";
import type { ProfitDashboard } from "@/lib/profit/types";
import { buildCommerceOpportunities } from "@/lib/insights/engine";
import type { AiCapabilityTest } from "./types";

export function runAiCapabilityTests(input: {
  snapshot: StoreSnapshot;
  profitDashboard: ProfitDashboard | null;
  canGenerateRecommendations: boolean;
}): AiCapabilityTest[] {
  const { snapshot, profitDashboard, canGenerateRecommendations } = input;
  const primary = profitDashboard?.primary;
  const be = primary ? breakEvenFromProfitPeriod(primary) : null;

  return [
    {
      id: "break-even-roas",
      label: "Can Break-even ROAS be calculated?",
      passed: be != null && be.breakEvenRoas > 0,
      detail: be ? `Break-even ROAS ${be.breakEvenRoas.toFixed(2)}` : "Profit setup or revenue missing",
    },
    {
      id: "net-profit",
      label: "Can Net Profit be calculated?",
      passed:
        profitDashboard?.primaryProfit.status !== "unavailable" &&
        primary?.netProfit != null,
      detail:
        primary?.netProfit != null
          ? `Net profit ${primary.netProfit.toLocaleString()}`
          : "Complete profit configuration",
    },
    {
      id: "contribution-margin",
      label: "Can Contribution Margin be calculated?",
      passed: primary != null && primary.revenue > 0 && primary.grossProfit != null,
      detail:
        primary && primary.revenue > 0
          ? `Gross margin ${((primary.grossProfit / primary.revenue) * 100).toFixed(1)}%`
          : "Revenue or COGS unavailable",
    },
    {
      id: "ltv",
      label: "Can Customer Lifetime Value be calculated?",
      passed:
        Boolean(snapshot.customerSnapshot?.customers.length) ||
        snapshot.customerSnapshot?.dataTier === "aggregated_only",
      detail: snapshot.customerSnapshot?.customers.length
        ? `${snapshot.customerSnapshot.customers.length} customer records`
        : "Sync Shopify customers",
    },
    {
      id: "recommendations",
      label: "Can AI generate recommendations?",
      passed: canGenerateRecommendations,
      detail: canGenerateRecommendations
        ? "Validation gate allows recommendations"
        : "Blocked by data validation",
    },
    {
      id: "executive-summary",
      label: "Can AI produce Executive Summary?",
      passed: snapshot.storeMetrics.revenue30d > 0,
      detail:
        snapshot.storeMetrics.revenue30d > 0
          ? "Revenue baseline available"
          : "Revenue data missing",
    },
    {
      id: "opportunities",
      label: "Can opportunity engine run?",
      passed: buildCommerceOpportunities(snapshot, profitDashboard, []).length >= 0,
      detail: "Commerce opportunity detectors executed",
    },
  ];
}
