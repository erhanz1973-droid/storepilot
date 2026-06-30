import type { AiDailyBrief, Opportunity, Recommendation } from "@/lib/types";

function parseRevenueEstimate(text: string): number {
  const match = text.match(/\$[\d,]+/);
  if (!match) return 0;
  return Number(match[0].replace(/[$,]/g, "")) || 0;
}

export function generateAiBrief(
  storeHealth: number,
  activeRecs: Recommendation[],
  criticalAlerts: Recommendation[],
  revenueOpportunities: Recommendation[],
  topOpportunities: Opportunity[] = [],
): AiDailyBrief {
  const priorities =
    topOpportunities.length > 0
      ? topOpportunities.slice(0, 3).map((opp, i) => ({
          rank: i + 1,
          title: opp.title,
          detail: `Est. ${opp.estimatedMonthlyNetProfitImpact.toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 })}/month net profit · ${opp.implementationEffort} effort`,
        }))
      : (() => {
          const sorted = [...activeRecs].sort((a, b) => {
            const sev = { critical: 0, high: 1, medium: 2, low: 3 };
            const diff = sev[a.severity] - sev[b.severity];
            return diff !== 0 ? diff : b.confidenceScore - a.confidenceScore;
          });
          return sorted.slice(0, 3).map((rec, i) => {
            let detail = rec.expectedImpact;
            if (rec.category === "campaign_review") {
              const roas = rec.supportingMetrics.find((m) => m.label.includes("ROAS"));
              detail = roas ? `ROAS below target (${roas.value}).` : rec.reason;
            }
            if (rec.category === "bundle_opportunity") {
              detail = "Estimated conversion increase: 15%";
            }
            if (rec.category === "low_inventory") {
              const weekly = parseRevenueEstimate(rec.expectedImpact);
              if (weekly > 0) detail = `+$${weekly.toLocaleString()}/week`;
            }
            return { rank: i + 1, title: rec.title.replace(/^[^:]+:\s*/, ""), detail };
          });
        })();

  const estimatedRevenueOpportunity =
    topOpportunities.length > 0
      ? topOpportunities.reduce((sum, o) => sum + o.estimatedMonthlyNetProfitImpact, 0)
      : [
          ...revenueOpportunities,
          ...criticalAlerts.filter((r) => r.category === "low_inventory"),
        ].reduce((sum, rec) => sum + parseRevenueEstimate(rec.expectedImpact), 0);

  const opportunitySummary =
    topOpportunities.length > 0
      ? `${topOpportunities.length} profit opportunities ranked by net profit impact`
      : revenueOpportunities.length > 0
        ? `${revenueOpportunities.length} profit opportunities identified`
        : "No major profit opportunities detected today";

  return {
    storeHealth,
    revenueOpportunitySummary: opportunitySummary,
    criticalAlertCount: criticalAlerts.length,
    topPriorities: priorities,
    estimatedRevenueOpportunity,
    generatedAt: new Date().toISOString(),
  };
}
