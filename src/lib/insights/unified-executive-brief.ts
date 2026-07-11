import { analyzeInventoryContext } from "@/lib/attribution/inventory-context";
import type { CustomerIntelligenceDashboard } from "@/lib/customers/engine";
import type { CustomerOpportunity } from "@/lib/customers/types";
import type { StoreSnapshot } from "@/lib/connectors/types";
import type { ProfitRecoveryOpportunity } from "@/lib/profit/profit-recommendations";
import { buildStagedRecoveryOpportunities } from "@/lib/profit/profit-recommendations";
import type { DashboardSnapshot, Opportunity } from "@/lib/types";
import type { DecisionItem } from "@/lib/decisions/center";
import type { ExecutiveRecommendation } from "./executive-recommendations";
import { buildExecutiveInsightsView, parseImpactMonthly } from "./executive-recommendations";

export type ExecutiveModuleSource =
  | "attribution"
  | "profit"
  | "marketing"
  | "inventory"
  | "customers"
  | "products";

export type GlobalBusinessHealthStatus = "healthy" | "needs_attention" | "critical";

export type GlobalBusinessHealth = {
  status: GlobalBusinessHealthStatus;
  label: string;
  indicator: "green" | "amber" | "red";
  message: string;
};

export type UnifiedExecutiveAction = {
  id: string;
  source: ExecutiveModuleSource;
  title: string;
  reason: string;
  estimatedMonthlyImpact: number;
  confidencePct: number;
  priority: "critical" | "high" | "medium" | "low";
  priorityScore: number;
  rankExplanation?: string;
  moduleLabel: string;
  moduleHref: string;
};

export type UnifiedExecutiveBrief = {
  businessHealth: GlobalBusinessHealth;
  overallConfidencePct: number;
  highestPriority: UnifiedExecutiveAction | null;
  otherOpportunities: UnifiedExecutiveAction[];
  opportunityCount: number;
  estimatedMonthlyRecovery: number;
  byPriority: {
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
  /** Legacy shape for completed decisions */
  completed: ExecutiveRecommendation[];
  planUsage?: import("@/lib/billing/types").CampaignEntitlements;
  visibleOpportunityCount?: number;
  lockedOpportunityCount?: number;
};

const MODULE_META: Record<
  ExecutiveModuleSource,
  { label: string; href: string }
> = {
  attribution: { label: "Attribution", href: "/analytics/attribution" },
  profit: { label: "Profit", href: "/analytics/profit" },
  marketing: { label: "Advertising", href: "/advertising" },
  inventory: { label: "Inventory", href: "/analytics/inventory" },
  customers: { label: "Customers", href: "/analytics/customers" },
  products: { label: "Products", href: "/analytics/products" },
};

function normalizeTitle(title: string): string {
  return title.toLowerCase().replace(/\s+/g, " ").trim();
}

function isDuplicate(existing: UnifiedExecutiveAction[], title: string): boolean {
  const norm = normalizeTitle(title);
  return existing.some(
    (a) =>
      normalizeTitle(a.title) === norm ||
      normalizeTitle(a.title).includes(norm) ||
      norm.includes(normalizeTitle(a.title)),
  );
}

function mapPriority(
  impact: number,
  confidencePct: number,
  opts?: { isLastResort?: boolean; critical?: boolean },
): UnifiedExecutiveAction["priority"] {
  if (opts?.isLastResort || opts?.critical) return "critical";
  if (impact >= 4000 && confidencePct >= 80) return "critical";
  if (impact >= 1500 || confidencePct >= 85) return "high";
  if (impact >= 400 || confidencePct >= 70) return "medium";
  return "low";
}

function computeUnifiedPriorityScore(action: Omit<UnifiedExecutiveAction, "priorityScore">): number {
  const priorityPoints = { critical: 28, high: 20, medium: 12, low: 6 };
  const impactPoints = Math.min(40, Math.round(Math.log10(action.estimatedMonthlyImpact + 1) * 12));
  const confidencePoints = Math.round(action.confidencePct * 0.32);
  return Math.min(100, priorityPoints[action.priority] + impactPoints + confidencePoints);
}

function pushAction(
  list: UnifiedExecutiveAction[],
  candidate: Omit<UnifiedExecutiveAction, "priorityScore">,
): void {
  if (isDuplicate(list, candidate.title)) return;
  list.push({
    ...candidate,
    priorityScore: computeUnifiedPriorityScore(candidate),
  });
}

function collectFromAttribution(
  dashboard: DashboardSnapshot,
  out: UnifiedExecutiveAction[],
): void {
  const plan = dashboard.attributionDashboard?.strategyPlan;
  if (!plan) return;

  for (const action of plan.actions) {
    pushAction(out, {
      id: `attr-${action.id}`,
      source: "attribution",
      title: action.title,
      reason: action.reason,
      estimatedMonthlyImpact: action.estimatedMonthlyImprovement,
      confidencePct: action.confidencePct,
      priority: mapPriority(action.estimatedMonthlyImprovement, action.confidencePct, {
        isLastResort: action.isLastResort,
      }),
      rankExplanation: action.rankExplanation,
      moduleLabel: MODULE_META.attribution.label,
      moduleHref: MODULE_META.attribution.href,
    });
  }
}

function collectFromProfit(
  recovery: ProfitRecoveryOpportunity[],
  out: UnifiedExecutiveAction[],
): void {
  for (const opp of recovery) {
    pushAction(out, {
      id: `profit-${opp.id}`,
      source: "profit",
      title: opp.title,
      reason: opp.reason,
      estimatedMonthlyImpact: opp.estimatedMonthlyRecovery,
      confidencePct: opp.confidencePct,
      priority: mapPriority(opp.estimatedMonthlyRecovery, opp.confidencePct, {
        isLastResort: opp.isLastResort,
      }),
      moduleLabel: MODULE_META.profit.label,
      moduleHref: MODULE_META.profit.href,
    });
  }
}

function collectFromProducts(dashboard: DashboardSnapshot, out: UnifiedExecutiveAction[]): void {
  const opps = dashboard.productIntelligence?.productOpportunities ?? [];
  for (const opp of opps) {
    pushAction(out, {
      id: `product-${opp.id}`,
      source: "products",
      title: opp.title,
      reason: opp.description,
      estimatedMonthlyImpact: opp.estimatedMonthlyNetProfitImpact,
      confidencePct: Math.round(opp.confidenceScore * 100),
      priority: mapPriority(opp.estimatedMonthlyNetProfitImpact, opp.confidenceScore * 100),
      moduleLabel: MODULE_META.products.label,
      moduleHref: MODULE_META.products.href,
    });
  }
}

function collectFromTopOpportunities(dashboard: DashboardSnapshot, out: UnifiedExecutiveAction[]): void {
  for (const opp of dashboard.topOpportunities ?? []) {
    const source = mapOpportunitySource(opp);
    pushAction(out, {
      id: `opp-${opp.id}`,
      source,
      title: opp.title,
      reason: opp.description,
      estimatedMonthlyImpact: opp.estimatedMonthlyNetProfitImpact,
      confidencePct: Math.round(opp.confidenceScore * 100),
      priority: mapPriority(
        opp.estimatedMonthlyNetProfitImpact,
        opp.confidenceScore * 100,
      ),
      moduleLabel: MODULE_META[source].label,
      moduleHref: MODULE_META[source].href,
    });
  }
}

function mapOpportunitySource(opp: Opportunity): ExecutiveModuleSource {
  switch (opp.category) {
    case "marketing_attribution":
    case "advertising_efficiency":
    case "marketing":
      return "marketing";
    case "inventory":
      return "inventory";
    case "product_growth":
    case "pricing":
    case "bundle":
    case "merchandising":
      return "products";
    case "customer_retention":
      return "customers";
    default:
      return "marketing";
  }
}

function collectFromInventory(
  snapshot: StoreSnapshot,
  dashboard: DashboardSnapshot,
  out: UnifiedExecutiveAction[],
): void {
  const ctx = analyzeInventoryContext(snapshot);
  if (ctx.severity !== "critical" && ctx.severity !== "low") return;

  if (ctx.severity === "critical") {
    pushAction(out, {
      id: "inventory-critical-oos",
      source: "inventory",
      title: "Address critical out-of-stock inventory",
      reason: `${Math.round(ctx.oosPct)}% of tracked inventory is out of stock. Pause scaling ads until key SKUs are replenished.`,
      estimatedMonthlyImpact: 0,
      confidencePct: 92,
      priority: "critical",
      moduleLabel: MODULE_META.inventory.label,
      moduleHref: MODULE_META.inventory.href,
    });
  }

  const oosRatio =
    dashboard.inventorySummary.totalProducts > 0
      ? dashboard.inventorySummary.outOfStock / dashboard.inventorySummary.totalProducts
      : 0;
  if (oosRatio > 0.25 && ctx.severity === "low") {
    pushAction(out, {
      id: "inventory-stock-pressure",
      source: "inventory",
      title: "Reduce stock pressure before increasing ad spend",
      reason: `${Math.round(oosRatio * 100)}% of catalog is out of stock or low — inventory may limit conversion from paid traffic.`,
      estimatedMonthlyImpact: 0,
      confidencePct: 84,
      priority: "high",
      moduleLabel: MODULE_META.inventory.label,
      moduleHref: MODULE_META.inventory.href,
    });
  }
}

function collectFromCustomers(
  customerIntelligence: CustomerIntelligenceDashboard | null | undefined,
  out: UnifiedExecutiveAction[],
): void {
  if (!customerIntelligence) return;

  for (const opp of customerIntelligence.opportunities) {
    const monthlyImpact = normalizeCustomerImpact(opp);
    pushAction(out, {
      id: `customer-${opp.id}`,
      source: "customers",
      title: opp.title,
      reason: opp.description,
      estimatedMonthlyImpact: monthlyImpact,
      confidencePct: opp.confidencePct,
      priority: mapPriority(monthlyImpact, opp.confidencePct),
      moduleLabel: MODULE_META.customers.label,
      moduleHref: MODULE_META.customers.href,
    });
  }
}

function normalizeCustomerImpact(opp: CustomerOpportunity): number {
  const label = opp.impactLabel.toLowerCase();
  if (label.includes("annual")) return Math.round(opp.estimatedImpact / 12);
  if (label.includes("retention")) return 0;
  return opp.estimatedImpact;
}

function collectFromDecisions(decisions: DecisionItem[], out: UnifiedExecutiveAction[]): void {
  for (const item of decisions) {
    if (item.status !== "open" && item.status !== "viewed") continue;
    const impact = parseImpactMonthly(item.estimatedImpactLabel);
    pushAction(out, {
      id: `decision-${item.id}`,
      source: "marketing",
      title: item.entityName ?? item.summary,
      reason: item.why.split("\n")[0] ?? item.summary,
      estimatedMonthlyImpact: impact,
      confidencePct: item.confidenceBreakdown?.overallPct ?? item.confidencePct,
      priority: item.priority,
      moduleLabel: "Decisions",
      moduleHref: "/decisions",
    });
  }
}

export function computeGlobalBusinessHealth(input: {
  dashboard: DashboardSnapshot;
  snapshot: StoreSnapshot;
  actions: UnifiedExecutiveAction[];
  customerIntelligence?: CustomerIntelligenceDashboard | null;
}): GlobalBusinessHealth {
  const netProfit = input.dashboard.profitDashboard?.primary.netProfit ?? 0;
  const inventory = analyzeInventoryContext(input.snapshot);
  const roasGap = input.dashboard.attributionDashboard?.strategyPlan.metricsSummary?.roasGapPct;
  const storeLabel = input.dashboard.storeHealth?.label;
  const unprofitable = netProfit < 0;
  const criticalInventory = inventory.severity === "critical";
  const roasBelowBreakEven = roasGap != null && roasGap > 0;
  const hasCriticalActions = input.actions.some((a) => a.priority === "critical");
  const churnFactor = input.customerIntelligence?.healthBreakdown.factors.find(
    (f) => f.id === "churn",
  );
  const highChurnRisk = churnFactor != null && churnFactor.score < 45;
  const weakCustomerHealth =
    input.customerIntelligence != null &&
    input.customerIntelligence.healthBreakdown.overall < 50;

  if (unprofitable) {
    return {
      status: "critical",
      label: "Critical",
      indicator: "red",
      message: "Business is currently unprofitable.",
    };
  }

  if (criticalInventory || hasCriticalActions) {
    return {
      status: "critical",
      label: "Critical",
      indicator: "red",
      message: criticalInventory
        ? `${Math.round(inventory.oosPct)}% of inventory is out of stock — address before scaling acquisition.`
        : "Critical issues require immediate attention.",
    };
  }

  if (
    input.actions.length > 0 ||
    roasBelowBreakEven ||
    highChurnRisk ||
    weakCustomerHealth ||
    storeLabel === "At Risk" ||
    storeLabel === "Fair"
  ) {
    return {
      status: "needs_attention",
      label: "Needs Attention",
      indicator: "amber",
      message: "Multiple optimization opportunities detected across StorePilot modules.",
    };
  }

  return {
    status: "healthy",
    label: "Healthy",
    indicator: "green",
    message: "No critical issues detected.",
  };
}

export function buildUnifiedExecutiveBrief(input: {
  dashboard: DashboardSnapshot;
  snapshot: StoreSnapshot;
  decisions?: DecisionItem[];
  customerIntelligence?: CustomerIntelligenceDashboard | null;
  planUsage?: import("@/lib/billing/types").CampaignEntitlements;
}): UnifiedExecutiveBrief {
  const actions: UnifiedExecutiveAction[] = [];

  collectFromAttribution(input.dashboard, actions);

  const profitRecovery = input.dashboard.profitDashboard
    ? buildStagedRecoveryOpportunities(input.dashboard.profitDashboard, input.snapshot)
    : [];
  collectFromProfit(profitRecovery, actions);

  collectFromProducts(input.dashboard, actions);
  collectFromCustomers(input.customerIntelligence, actions);
  collectFromInventory(input.snapshot, input.dashboard, actions);
  collectFromTopOpportunities(input.dashboard, actions);

  if (actions.length < 3) {
    collectFromDecisions(input.decisions ?? input.dashboard.decisionCenter ?? [], actions);
  }

  const ranked = [...actions].sort((a, b) => b.priorityScore - a.priorityScore);

  const plan = input.planUsage;
  let visibleRanked = ranked;
  let lockedOpportunityCount = 0;

  if (plan && !plan.isUnlimited && plan.unlockedCampaignName) {
    const unlockedLower = plan.unlockedCampaignName.toLowerCase();
    const campaignSources: ExecutiveModuleSource[] = ["attribution", "marketing"];
    visibleRanked = ranked.filter((a) => {
      if (!campaignSources.includes(a.source)) return true;
      return a.title.toLowerCase().includes(unlockedLower);
    });
    lockedOpportunityCount = ranked.length - visibleRanked.length;
  }

  const highestPriority = visibleRanked[0] ?? null;
  const otherOpportunities = visibleRanked.slice(1, 8);

  const byPriority = {
    critical: visibleRanked.filter((a) => a.priority === "critical").length,
    high: visibleRanked.filter((a) => a.priority === "high").length,
    medium: visibleRanked.filter((a) => a.priority === "medium").length,
    low: visibleRanked.filter((a) => a.priority === "low").length,
  };

  const estimatedMonthlyRecovery = visibleRanked.reduce(
    (sum, a) => sum + a.estimatedMonthlyImpact,
    0,
  );

  const confidenceValues = visibleRanked.map((a) => a.confidencePct).filter((v) => v > 0);
  const overallConfidencePct =
    confidenceValues.length > 0
      ? Math.round(
          confidenceValues.reduce((s, v) => s + v, 0) / confidenceValues.length,
        )
      : input.dashboard.attributionDashboard?.strategyPlan.confidencePct ??
        input.dashboard.profitDashboard?.confidence.scorePct ??
        0;

  const businessHealth = computeGlobalBusinessHealth({
    dashboard: input.dashboard,
    snapshot: input.snapshot,
    actions: visibleRanked,
    customerIntelligence: input.customerIntelligence,
  });

  const legacyView = buildExecutiveInsightsView(
    input.decisions ?? input.dashboard.decisionCenter ?? [],
  );

  return {
    businessHealth,
    overallConfidencePct,
    highestPriority,
    otherOpportunities,
    opportunityCount: ranked.length,
    visibleOpportunityCount: visibleRanked.length,
    lockedOpportunityCount,
    estimatedMonthlyRecovery,
    byPriority,
    completed: legacyView.completed,
    planUsage: plan,
  };
}

export { MODULE_META };
