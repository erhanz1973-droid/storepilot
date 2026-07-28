import type { MerchantBusinessProfile } from "@/lib/business-model/types";
import type { StoreSnapshot } from "@/lib/connectors/types";
import type { ProfitDashboard } from "@/lib/profit/types";
import {
  buildBusinessScaleContext,
  constrainRecoveryTotal,
} from "@/lib/analytics/recovery-business-constraints";
import type { ProfitRecoveryOpportunity } from "@/lib/profit/profit-recommendations";
import type { RevenuePlaybook, RevenueStudio } from "@/lib/analytics/revenue-studio";
import type { SalesOpportunity } from "@/lib/analytics/sales-manager-v2";
import { DEMO_SCENARIOS } from "@/lib/demo/scenarios/registry";
import type { DemoScenarioId } from "@/lib/demo/scenarios/types";
import { ALPINE_UI_METRICS } from "@/lib/demo/alpine-outfitters/ui-metrics";
import { allowDemoData } from "@/lib/env/runtime";
import { hasCustomerRecords } from "@/lib/customers/metrics";
import {
  EXECUTIVE_MODULES,
  type ExecutiveModuleId,
  isPlaybookDuplicate,
  moduleHref,
  moduleRole,
  normalizePlaybookDedupKey,
} from "@/lib/analytics/executive-modules";

export type PlaybookModule = Exclude<
  ExecutiveModuleId,
  "executive" | "health" | "approvals"
>;

export type DailyPlaybookItem = {
  rank: number;
  id: string;
  module: PlaybookModule;
  roleLabel: string;
  moduleHref: string;
  title: string;
  impactLabel: string;
  impactMonthly: number | null;
  confidence: string;
  approvalHref: string;
  dedupKey: string;
};

export type DailyAiPlaybook = {
  title: string;
  subtitle: string;
  items: DailyPlaybookItem[];
  totalRecoverableMonthly: number;
};

export type ExecutiveFocusSummary = {
  todayDecision: {
    title: string;
    module: ExecutiveModuleId;
    moduleHref: string;
    approvalHref: string;
    recommendationId?: string;
  } | null;
  topRisks: Array<{ label: string; module: ExecutiveModuleId; href: string }>;
  recoveryPotentialMonthly: number;
  recoveryExplanation?: import("@/lib/analytics/recovery-business-constraints").RecoveryExplanation;
  businessHealth: { score: number; label: string; href: string };
};

function fmtImpact(n: number | null): string {
  if (n == null || n <= 0) return "Unlock intelligence";
  return `+$${n.toLocaleString(undefined, { maximumFractionDigits: 0 })}/month`;
}

type Candidate = Omit<DailyPlaybookItem, "rank">;

function pushCandidate(list: Candidate[], item: Omit<Candidate, "dedupKey" | "roleLabel" | "moduleHref"> & { module: PlaybookModule }): void {
  const dedupKey = normalizePlaybookDedupKey(item.title);
  if (isPlaybookDuplicate(list, item.title)) return;
  list.push({
    ...item,
    dedupKey,
    roleLabel: moduleRole(item.module),
    moduleHref: moduleHref(item.module),
  });
}

function fromRevenuePlaybook(
  pb: RevenuePlaybook,
): Omit<Candidate, "dedupKey" | "roleLabel" | "moduleHref"> & { module: PlaybookModule } {
  return {
    id: pb.id,
    module: "sales",
    title: pb.title,
    impactLabel: `Expected Profit Recovery: ${fmtImpact(pb.expectedProfitMonthly)}`,
    impactMonthly: pb.expectedProfitMonthly,
    confidence: pb.confidence,
    approvalHref: pb.approvalHref,
  };
}

function adsConnected(snapshot: StoreSnapshot): { meta: boolean; google: boolean } {
  const states = snapshot.connectorStates ?? {};
  const meta =
    states.meta_ads === "connected" ||
    states.meta_ads === "demo" ||
    (snapshot.campaigns?.length ?? 0) > 0;
  const google =
    states.google_ads === "connected" ||
    states.google_ads === "demo" ||
    (snapshot.googleAdsSnapshot?.campaigns?.length ?? 0) > 0;
  return { meta, google };
}

/** Live Meta + Google campaign count — never invents demo campaign volume. */
export function countLiveCampaignsScanned(snapshot: StoreSnapshot | null | undefined): number {
  if (!snapshot) return 0;
  const { meta, google } = adsConnected(snapshot);
  const metaCount = meta ? (snapshot.campaigns?.length ?? 0) : 0;
  const googleCount = google ? (snapshot.googleAdsSnapshot?.campaigns?.length ?? 0) : 0;
  return metaCount + googleCount;
}

function isDemoScenarioActive(snapshot: StoreSnapshot): boolean {
  return Boolean(allowDemoData() && snapshot.demoScenario);
}

function marketingCandidates(snapshot: StoreSnapshot): Candidate[] {
  const items: Candidate[] = [];

  // Demo personality templates only apply to explicit demo scenarios — never to live merchants.
  if (isDemoScenarioActive(snapshot)) {
    const scenarioId = snapshot.demoScenario ?? "healthy_growth";
    const scenario = DEMO_SCENARIOS[scenarioId];

    if (scenario.personality === "growth") {
      pushCandidate(items, {
        id: "mkt-scale-google",
        module: "marketing",
        title: "Increase Google Ads budget on winning campaigns",
        impactLabel: "Scale high-ROAS campaigns",
        impactMonthly: 2800,
        confidence: "High",
        approvalHref: "/approvals?playbook=mkt-scale-google",
      });
      pushCandidate(items, {
        id: "mkt-vip-campaign",
        module: "marketing",
        title: "Create VIP customer campaign",
        impactLabel: "Grow customer lifetime value",
        impactMonthly: 1900,
        confidence: "High",
        approvalHref: "/approvals?playbook=mkt-vip-campaign",
      });
      return items;
    }

    if (scenario.personality === "operations" || scenario.personality === "seasonal") {
      pushCandidate(items, {
        id: "mkt-seasonal-budget",
        module: "marketing",
        title: "Increase advertising budget for seasonal demand",
        impactLabel: "Capture peak-season traffic",
        impactMonthly: 4200,
        confidence: "High",
        approvalHref: "/approvals?playbook=mkt-seasonal-budget",
      });
      return items;
    }
  }

  const { meta, google } = adsConnected(snapshot);

  if (meta) {
    const losing = [...(snapshot.campaigns ?? [])]
      .filter((c) => c.roas7d < 1 && c.spend7d > 200)
      .sort((a, b) => b.spend7d - a.spend7d)[0];

    if (losing) {
      const recovery = Math.round(losing.spend7d * 4.33 * 0.1);
      pushCandidate(items, {
        id: `mkt-reduce-${losing.id}`,
        module: "marketing",
        title: `Reduce Meta budget on ${losing.name}`,
        impactLabel: `ROAS ${losing.roas7d.toFixed(2)} — tighten targeting before scaling`,
        impactMonthly: recovery,
        confidence: "Medium",
        approvalHref: `/approvals?playbook=mkt-reduce-${losing.id}`,
      });
    }
  }

  if (google) {
    const winners = [...(snapshot.googleAdsSnapshot?.campaigns ?? [])]
      .filter((c) => c.roas7d >= 2 && c.spend7d > 50)
      .sort((a, b) => b.roas7d - a.roas7d);
    if (winners.length > 0) {
      pushCandidate(items, {
        id: "mkt-scale-google-live",
        module: "marketing",
        title: "Increase Google Ads budget on winning campaigns",
        impactLabel: "Scale high-ROAS campaigns",
        impactMonthly: Math.round(winners[0]!.spend7d * 4.33 * 0.15),
        confidence: "High",
        approvalHref: "/approvals?playbook=mkt-scale-google-live",
      });
    }
  }

  if (!meta && !google) {
    pushCandidate(items, {
      id: "mkt-connect-ads",
      module: "connections",
      title: "Connect Advertising Platforms",
      impactLabel: "Unlock Advertising Intelligence",
      impactMonthly: null,
      confidence: "High",
      approvalHref: "/connections?tab=advertising&highlight=meta_ads",
    });
  }

  const landing = snapshot.ga4Snapshot?.landingPages?.[0];
  if (landing?.path && landing.sessions > 5000) {
    pushCandidate(items, {
      id: "mkt-landing-page",
      module: "marketing",
      title: `Improve prospecting landing page ${landing.path}`,
      impactLabel: "High traffic, conversion opportunity",
      impactMonthly: 5332,
      confidence: "High",
      approvalHref: "/approvals?playbook=mkt-landing-page",
    });
  }

  return items;
}

function profitCandidates(recovery: ProfitRecoveryOpportunity[]): Candidate[] {
  const items: Candidate[] = [];
  for (const opp of recovery.slice(0, 3)) {
    pushCandidate(items, {
      id: `profit-${opp.id}`,
      module: "profit",
      title: opp.title,
      impactLabel: `Expected Profit Recovery: ${fmtImpact(opp.estimatedMonthlyRecovery)}`,
      impactMonthly: opp.estimatedMonthlyRecovery,
      confidence: opp.confidencePct >= 80 ? "High" : opp.confidencePct >= 65 ? "Medium" : "Low",
      approvalHref: `/approvals?playbook=profit-${encodeURIComponent(opp.id)}`,
    });
  }
  return items;
}

function inventoryCandidates(snapshot: StoreSnapshot): Candidate[] {
  const items: Candidate[] = [];
  const lowStock = [...(snapshot.products ?? [])]
    .filter((p) => p.inventoryQuantity > 0 && p.inventoryQuantity < 15 && p.unitsSold30d >= 10)
    .sort((a, b) => b.unitsSold30d - a.unitsSold30d)[0];

  if (lowStock) {
    pushCandidate(items, {
      id: `inv-reorder-${lowStock.id}`,
      module: "inventory",
      title: `Reorder ${lowStock.title}`,
      impactLabel: "Prevent stockouts on high-velocity SKU",
      impactMonthly: null,
      confidence: "High",
      approvalHref: `/approvals?playbook=inv-reorder-${lowStock.id}`,
    });
  }

  return items;
}

function customerCandidates(snapshot: StoreSnapshot): Candidate[] {
  const items: Candidate[] = [];
  const cs = snapshot.customerSnapshot;
  if (!cs || !hasCustomerRecords(cs)) return items;

  const inactive = cs.customers.filter((c) => c.segment === "inactive" || c.segment === "at_risk");
  const vip = cs.customers.filter((c) => c.segment === "vip");
  const oneTime = cs.customers.filter((c) => c.segment === "one_time");
  const buyers = cs.customers.filter((c) => c.ordersCount >= 1);
  const repeatBuyers = cs.customers.filter((c) => c.ordersCount >= 2);
  const repeatPct =
    buyers.length > 0 ? Math.round((repeatBuyers.length / buyers.length) * 1000) / 10 : null;

  if (inactive.length > 0) {
    const recoverable = Math.round(inactive.reduce((s, c) => s + c.lifetimeRevenue, 0) * 0.08);
    pushCandidate(items, {
      id: "cust-reengage",
      module: "customers",
      title: "Re-engage inactive customers",
      impactLabel: `${inactive.length} customers inactive 60+ days`,
      impactMonthly: recoverable > 0 ? recoverable : null,
      confidence: "High",
      approvalHref: "/commerce/customers?playbook=cust-reengage",
    });
  }

  if (repeatPct != null && repeatPct < 30 && oneTime.length > 5) {
    pushCandidate(items, {
      id: "cust-repeat",
      module: "customers",
      title: "Increase repeat purchases with post-purchase flows",
      impactLabel: `Repeat purchase rate ${repeatPct}% · ${oneTime.length} one-time buyers`,
      impactMonthly: null,
      confidence: "High",
      approvalHref: "/commerce/customers?playbook=cust-repeat",
    });
  }

  if (vip.length >= 3) {
    pushCandidate(items, {
      id: "cust-vip",
      module: "customers",
      title: "Reward VIP customers with exclusive retention offers",
      impactLabel: `${vip.length} VIP customers in connected dataset`,
      impactMonthly: null,
      confidence: "High",
      approvalHref: "/commerce/customers?playbook=cust-vip",
    });
  }

  // Fallback insight when records exist but no strong segment signal yet
  if (items.length === 0 && cs.customers.length > 0) {
    pushCandidate(items, {
      id: "cust-review-segments",
      module: "customers",
      title: "Review customer segments for retention opportunities",
      impactLabel: `${cs.customers.length} customers synced from Shopify`,
      impactMonthly: null,
      confidence: "Medium",
      approvalHref: "/commerce/customers",
    });
  }

  return items;
}

function connectionCandidates(snapshot: StoreSnapshot): Candidate[] {
  const items: Candidate[] = [];
  const states = snapshot.connectorStates ?? {};

  if (!states.shopify || states.shopify === "disconnected") {
    pushCandidate(items, {
      id: "conn-shopify",
      module: "connections",
      title: "Connect Shopify",
      impactLabel: "Unlock product & order intelligence",
      impactMonthly: null,
      confidence: "High",
      approvalHref: "/connections?highlight=shopify",
    });
  }

  // Only when customer records are actually unavailable — never when Customers is connected.
  const cs = snapshot.customerSnapshot;
  if (!cs || !hasCustomerRecords(cs)) {
    pushCandidate(items, {
      id: "conn-customers",
      module: "connections",
      title: "Connect Customer Data",
      impactLabel: "Unlock retention intelligence",
      impactMonthly: null,
      confidence: "Medium",
      approvalHref: "/connections?highlight=shopify",
    });
  }

  return items;
}

export function buildDailyAiPlaybook(input: {
  snapshot: StoreSnapshot;
  profitDashboard?: ProfitDashboard | null;
  revenueStudio?: RevenueStudio;
  salesOpportunities?: SalesOpportunity[];
  profitRecovery?: ProfitRecoveryOpportunity[];
}): DailyAiPlaybook {
  const demoActive = isDemoScenarioActive(input.snapshot);
  const scenarioId: DemoScenarioId | null = demoActive
    ? (input.snapshot.demoScenario ?? "healthy_growth")
    : null;
  const scenario = scenarioId ? DEMO_SCENARIOS[scenarioId] : null;
  const candidates: Candidate[] = [];
  const businessContext = buildBusinessScaleContext(
    input.profitDashboard ?? null,
    input.snapshot,
  );

  if (input.revenueStudio) {
    for (const pb of input.revenueStudio.playbooks.slice(0, 2)) {
      pushCandidate(candidates, fromRevenuePlaybook(pb));
    }
  }

  for (const opp of (input.salesOpportunities ?? []).slice(0, 2)) {
    pushCandidate(candidates, {
      id: `sales-opp-${opp.id}`,
      module: "sales",
      title: opp.title,
      impactLabel: `Expected Profit Recovery: ${fmtImpact(opp.estimatedProfitMonthly)}`,
      impactMonthly: opp.estimatedProfitMonthly,
      confidence: opp.recoveryProbabilityPct >= 70 ? "High" : "Medium",
      approvalHref: `/approvals?playbook=${encodeURIComponent(`sales-opp-${opp.id}`)}`,
    });
  }

  candidates.push(...marketingCandidates(input.snapshot));

  if (input.profitRecovery?.length) {
    candidates.push(...profitCandidates(input.profitRecovery));
  }

  candidates.push(...inventoryCandidates(input.snapshot));
  candidates.push(...customerCandidates(input.snapshot));
  candidates.push(...connectionCandidates(input.snapshot));

  const sorted = candidates
    .sort((a, b) => (b.impactMonthly ?? 0) - (a.impactMonthly ?? 0))
    .slice(0, 8)
    .map((item, i) => ({ ...item, rank: i + 1 }));

  const rawTotal = sorted.reduce((s, i) => s + (i.impactMonthly ?? 0), 0);
  const constrainedTotal = constrainRecoveryTotal(rawTotal, 75, businessContext);

  let totalRecoverableMonthly = constrainedTotal.amount;
  if (demoActive && input.snapshot.demoScenario === "healthy_growth") {
    totalRecoverableMonthly = ALPINE_UI_METRICS.totalRecoverableOpportunityMonthly;
  }

  const subtitle = scenario
    ? `${scenario.focusVerbs.slice(0, 3).join(" · ")} — actions from your AI executive team.`
    : "Actions grounded in connected Shopify, inventory, and customer data.";

  return {
    title: "Today's AI Playbook",
    subtitle,
    items: sorted,
    totalRecoverableMonthly,
  };
}

export function buildExecutiveFocusSummary(input: {
  playbook: DailyAiPlaybook;
  businessHealthScore?: number;
  businessHealthLabel?: string;
  topThreatLabel?: string;
  recoveryExplanation?: import("@/lib/analytics/recovery-business-constraints").RecoveryExplanation;
}): ExecutiveFocusSummary {
  const top = input.playbook.items[0] ?? null;

  const topRisks: ExecutiveFocusSummary["topRisks"] = [];
  if (input.topThreatLabel) {
    topRisks.push({
      label: input.topThreatLabel,
      module: "profit",
      href: moduleHref("profit"),
    });
  }
  for (const item of input.playbook.items.filter((i) => i.module === "marketing").slice(0, 1)) {
    topRisks.push({
      label: item.title,
      module: "marketing",
      href: item.moduleHref,
    });
  }

  return {
    todayDecision: top
      ? {
          title: top.title,
          module: top.module,
          moduleHref: top.moduleHref,
          approvalHref: top.approvalHref,
        }
      : null,
    topRisks,
    recoveryPotentialMonthly: input.playbook.totalRecoverableMonthly,
    recoveryExplanation: input.recoveryExplanation,
    businessHealth: {
      score: input.businessHealthScore ?? 0,
      label: input.businessHealthLabel ?? "View health",
      href: moduleHref("health"),
    },
  };
}

export function buildUnifiedExecutivePlaybook(input: {
  snapshot: StoreSnapshot;
  profitDashboard?: ProfitDashboard | null;
  revenueStudio?: RevenueStudio;
  salesOpportunities?: SalesOpportunity[];
  profitRecovery?: ProfitRecoveryOpportunity[];
  businessHealthScore?: number;
  businessHealthLabel?: string;
  topThreatLabel?: string;
  businessProfile?: MerchantBusinessProfile | null;
}): { playbook: DailyAiPlaybook; focus: ExecutiveFocusSummary } {
  const businessContext = buildBusinessScaleContext(
    input.profitDashboard ?? null,
    input.snapshot,
    { businessProfile: input.businessProfile },
  );
  const playbook = buildDailyAiPlaybook({
    snapshot: input.snapshot,
    profitDashboard: input.profitDashboard,
    revenueStudio: input.revenueStudio,
    salesOpportunities: input.salesOpportunities,
    profitRecovery: input.profitRecovery,
  });

  const recoveryExplanation = constrainRecoveryTotal(
    playbook.totalRecoverableMonthly,
    75,
    businessContext,
  ).explanation;

  const focus = buildExecutiveFocusSummary({
    playbook,
    businessHealthScore: input.businessHealthScore,
    businessHealthLabel: input.businessHealthLabel,
    topThreatLabel: input.topThreatLabel,
    recoveryExplanation,
  });

  return { playbook, focus };
}
