import type { Opportunity, Recommendation } from "@/lib/types";
import type { AutopilotAction, AutopilotPriority } from "./types";
import { implementationEffortMinutes } from "./effort";

function priorityFromSeverity(severity: Recommendation["severity"]): AutopilotPriority {
  const map: Record<Recommendation["severity"], AutopilotPriority> = {
    critical: "Critical",
    high: "High",
    medium: "Medium",
    low: "Low",
  };
  return map[severity];
}

function parseImpact(text: string): number {
  const m = text.match(/\$[\d,]+/);
  return m ? Number(m[0].replace(/[$,]/g, "")) : 0;
}

export function buildActionQueue(
  topOpportunities: Opportunity[],
  activeRecommendations: Recommendation[],
  criticalAlerts: Recommendation[],
  budgetRecs: import("./types").BudgetRecommendation[],
  pricingRecs: import("./types").PricingRecommendation[],
  inventoryForecasts: import("./types").InventoryForecastRow[],
): AutopilotAction[] {
  const actions: AutopilotAction[] = [];

  for (const opp of topOpportunities) {
    actions.push({
      id: `action-opp-${opp.id}`,
      source: "opportunity",
      priority:
        opp.confidenceScore >= 0.85
          ? "High"
          : opp.confidenceScore >= 0.7
            ? "Medium"
            : "Low",
      title: opp.title,
      description: opp.description,
      expectedNetProfitGain: opp.estimatedMonthlyNetProfitImpact,
      confidenceScore: opp.confidenceScore,
      estimatedMinutes: implementationEffortMinutes(opp.implementationEffort),
      businessImpact: `Est. ${opp.estimatedMonthlyNetProfitImpact.toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 })}/month net profit`,
      actionLabel: "Review opportunity",
      category: opp.category,
    });
  }

  for (const rec of criticalAlerts) {
    actions.push({
      id: `action-alert-${rec.id}`,
      source: "alert",
      priority: "Critical",
      title: rec.title.replace(/^[^:]+:\s*/, ""),
      description: rec.reason,
      expectedNetProfitGain: parseImpact(rec.expectedImpact) * 4,
      confidenceScore: rec.confidenceScore,
      estimatedMinutes: 15,
      businessImpact: rec.expectedImpact,
      actionLabel: rec.actionLabel,
      category: rec.category,
    });
  }

  for (const rec of activeRecommendations.filter((r) => r.severity === "high").slice(0, 4)) {
    if (criticalAlerts.some((c) => c.id === rec.id)) continue;
    actions.push({
      id: `action-rec-${rec.id}`,
      source: "recommendation",
      priority: priorityFromSeverity(rec.severity),
      title: rec.title.replace(/^[^:]+:\s*/, ""),
      description: rec.reason,
      expectedNetProfitGain: parseImpact(rec.expectedImpact) * 4,
      confidenceScore: rec.confidenceScore,
      estimatedMinutes: 20,
      businessImpact: rec.expectedImpact,
      actionLabel: rec.actionLabel,
      category: rec.category,
    });
  }

  for (const b of budgetRecs) {
    actions.push({
      id: `action-budget-${b.id}`,
      source: "budget",
      priority: b.confidenceScore >= 0.8 ? "High" : "Medium",
      title: b.target,
      description: b.reasoning,
      expectedNetProfitGain: b.expectedNetProfitGain,
      confidenceScore: b.confidenceScore,
      estimatedMinutes: 10,
      businessImpact: `Budget optimization · ${b.action.replace(/_/g, " ")}`,
      actionLabel: "Apply in Ads Manager",
    });
  }

  for (const p of pricingRecs.slice(0, 3)) {
    actions.push({
      id: `action-price-${p.productId}`,
      source: "pricing",
      priority: p.expectedProfitChange > 100 ? "High" : "Medium",
      title: `${p.action.replace(/_/g, " ")} — ${p.title}`,
      description: p.suggestedChange,
      expectedNetProfitGain: Math.round(p.expectedProfitChange * 4.33),
      confidenceScore: p.confidenceScore,
      estimatedMinutes: 25,
      businessImpact: `Est. $${Math.round(p.expectedProfitChange)}/week profit change`,
      actionLabel: "Update in Shopify",
    });
  }

  for (const inv of inventoryForecasts.filter((i) => i.risk === "stockout").slice(0, 2)) {
    actions.push({
      id: `action-inv-${inv.productId}`,
      source: "inventory",
      priority: inv.daysRemaining != null && inv.daysRemaining <= 7 ? "Critical" : "High",
      title: `Restock — ${inv.title}`,
      description: `${inv.daysRemaining ?? "?"} days of inventory remaining.`,
      expectedNetProfitGain: inv.lostProfitRisk * 4,
      confidenceScore: 0.88,
      estimatedMinutes: 30,
      businessImpact: `$${inv.lostRevenueRisk.toLocaleString()} revenue at risk`,
      actionLabel: "Place replenishment order",
    });
  }

  const priorityOrder: Record<AutopilotPriority, number> = {
    Critical: 0,
    High: 1,
    Medium: 2,
    Low: 3,
  };

  return actions
    .sort(
      (a, b) =>
        priorityOrder[a.priority] - priorityOrder[b.priority] ||
        b.expectedNetProfitGain - a.expectedNetProfitGain ||
        b.confidenceScore - a.confidenceScore,
    )
    .slice(0, 12);
}
