/**
 * Demo Mode showcase overrides — apply Demo Provider metrics onto computed surfaces.
 * Production Mode: all functions are no-ops (return input unchanged).
 */

import type { StoreSnapshot } from "@/lib/connectors/types";
import type { ProfitDashboard } from "@/lib/profit/types";
import type { AnalyzerOutput, Recommendation, RecommendationSeverity } from "@/lib/types";
import type { DecisionImpact, DecisionImpactPresentation } from "@/lib/calculations/impact/engine";
import {
  buildDecisionImpactPresentation,
  DECISION_IMPACT_COPY,
} from "@/lib/calculations/impact/engine";
import {
  ALPINE_CURATED_RECOMMENDATIONS,
  ALPINE_OUTFITTERS,
  isAlpineOutfittersSnapshot,
} from "@/lib/demo/alpine-outfitters";
import {
  ALPINE_UI_METRICS,
  getAlpineHeroRecommendation,
} from "@/lib/demo/alpine-outfitters/ui-metrics";
import type { ExecutiveKpi } from "@/lib/analytics/executive-advisor-enrichment";
import { allowDemoData } from "@/lib/env/runtime";

const DEMO_CREATED_AT = "2026-07-20T12:00:00.000Z";

function curatedToRecommendation(output: AnalyzerOutput): Recommendation {
  return {
    id: output.id,
    category: output.category,
    title: output.title,
    severity: output.priority as RecommendationSeverity,
    reason: output.description,
    expectedImpact: output.expectedImpact,
    confidenceScore: output.confidence,
    actionLabel: output.actions[0]?.label ?? "Review",
    supportingMetrics: output.evidence,
    entityType: output.entityType,
    entityId: output.entityId,
    createdAt: DEMO_CREATED_AT,
    status: "pending",
  };
}

export function isAlpineShowcaseActive(snapshot: StoreSnapshot | null | undefined): boolean {
  if (!snapshot) return false;
  return allowDemoData() && isAlpineOutfittersSnapshot(snapshot);
}

/** Curated AnalyzerOutputs — exclusive recommendation set for Alpine showcase. */
export function getAlpineShowcaseAnalyzerOutputs(): AnalyzerOutput[] {
  return ALPINE_CURATED_RECOMMENDATIONS;
}

/** Curated recommendations as Recommendation records (in-memory, no DB required). */
export function getAlpineShowcaseRecommendations(): Recommendation[] {
  return ALPINE_CURATED_RECOMMENDATIONS.map(curatedToRecommendation);
}

/**
 * Demo Mode: replace stored/analyzer recommendations with curated Alpine set.
 * Production Mode: return stored unchanged.
 */
export function resolveDemoModeRecommendations(
  snapshot: StoreSnapshot,
  stored: Recommendation[],
): Recommendation[] {
  if (!isAlpineShowcaseActive(snapshot)) return stored;
  return getAlpineShowcaseRecommendations();
}

/**
 * Prepend/replace analyzer outputs for Alpine when running recommendation sync.
 */
export function mergeAlpineCuratedAnalyzerOutputs(
  snapshot: StoreSnapshot,
  analyzerOutputs: AnalyzerOutput[],
): AnalyzerOutput[] {
  if (!isAlpineShowcaseActive(snapshot)) return analyzerOutputs;
  /** Exclusive curated set — no legacy analyzer leftovers (e.g. +$103 pricing) */
  return getAlpineShowcaseAnalyzerOutputs();
}

/** Pin profit dashboard primary KPIs to Demo Provider. */
export function applyDemoProfitDashboard(
  snapshot: StoreSnapshot,
  profit: ProfitDashboard | null,
): ProfitDashboard | null {
  if (!profit || !isAlpineShowcaseActive(snapshot)) return profit;
  const m = ALPINE_UI_METRICS;
  const marginPct = Math.round((m.profit30d / m.revenue30d) * 1000) / 10;

  return {
    ...profit,
    primary: {
      ...profit.primary,
      revenue: m.revenue30d,
      netProfit: m.profit30d,
      profitMarginPct: marginPct,
      orders: m.orders30d,
      adSpend: m.totalAdSpend30d,
      netProfitMeta: {
        ...profit.primary.netProfitMeta,
        value: m.profit30d,
        status: "verified",
        confidence: m.aiConfidencePct,
      },
    },
    primaryProfit: {
      ...profit.primaryProfit,
      value: m.profit30d,
      status: "verified",
      confidence: m.aiConfidencePct,
    },
    blendedRoas: profit.blendedRoas
      ? {
          ...profit.blendedRoas,
          blendedRoas30d: m.blendedRoas,
          metaRoas30d: ALPINE_OUTFITTERS.metaRoas,
          isAdvertisingProfitable: true,
        }
      : profit.blendedRoas,
    kpis: profit.kpis.map((kpi) => {
      const label = kpi.label.toLowerCase();
      if (kpi.id === "revenue" || label.includes("revenue")) {
        return { ...kpi, value: m.revenue30d, changePct: m.revenueChangePct };
      }
      if (kpi.id === "profit" || label.includes("profit")) {
        return { ...kpi, value: m.profit30d, changePct: m.profitChangePct };
      }
      if (kpi.id === "roas" || label.includes("roas")) {
        return { ...kpi, value: m.blendedRoas, changePct: m.roasChangePct };
      }
      return kpi;
    }),
  };
}

function fmtCurrency(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 10_000) return `$${Math.round(n / 1000)}K`;
  return n.toLocaleString(undefined, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });
}

/** Override executive KPI strip with Demo Provider values. */
export function applyDemoExecutiveKpis(
  snapshot: StoreSnapshot,
  kpis: ExecutiveKpi[],
): ExecutiveKpi[] {
  if (!isAlpineShowcaseActive(snapshot)) return kpis;
  const m = ALPINE_UI_METRICS;

  return kpis.map((kpi) => {
    switch (kpi.id) {
      case "revenue":
        return {
          ...kpi,
          value: fmtCurrency(m.revenue30d),
          sublabel: "Last 30 days",
          tone: "positive" as const,
        };
      case "profit":
        return {
          ...kpi,
          value: fmtCurrency(m.profit30d),
          sublabel: "Monthly run rate",
          tone: "positive" as const,
        };
      case "cash_at_risk":
        return {
          ...kpi,
          value: fmtCurrency(m.cashAtRiskMonthly),
          sublabel: "Monthly waste & leakage",
          tone: "warning" as const,
        };
      case "inventory_risk":
        return {
          ...kpi,
          value: fmtCurrency(m.inventoryRiskMonthly),
          sublabel: "Cash locked in slow movers",
          tone: "warning" as const,
        };
      case "recovery":
        return {
          ...kpi,
          value: fmtCurrency(m.recoveryOpportunityMonthly),
          sublabel: `Up to ${fmtCurrency(m.recoveryBestCaseMonthly)} best case`,
          tone: "positive" as const,
        };
      default:
        return kpi;
    }
  });
}

/** Build DecisionImpact from a curated AnalyzerOutput financialImpact. */
export function decisionImpactFromCurated(output: AnalyzerOutput): DecisionImpact {
  const fi = output.financialImpact;
  const revenue = fi?.estimatedMonthlyRevenueIncrease ?? 0;
  const savings = fi?.estimatedMonthlyCostSavings ?? 0;
  const profit = fi?.estimatedMonthlyProfitIncrease ?? 0;
  const recovery = Math.max(revenue, savings, profit);

  return {
    businessRecovery: recovery,
    recoverableWaste: savings > 0 ? savings : null,
    recoverableRevenue: revenue > 0 ? revenue : null,
    revenueRecovered: revenue > 0 ? revenue : null,
    advertisingSavings: output.category === "campaign_review" && savings > 0 ? savings : null,
    advertisingSavingsLow: null,
    advertisingSavingsHigh: null,
    grossProfitImpact: profit || recovery,
    netProfitImpact: profit || Math.round(recovery * 0.35),
    cashFlowImpact: profit || recovery,
    monthlyProfitRecovery: profit || recovery,
    expectedProfit: profit || recovery,
    expectedROAS: null,
    paybackDays: 14,
    confidence: Math.round(output.confidence * 100),
    campaignCount: output.category === "campaign_review" ? 2 : null,
    observationPeriodDays: 30,
    sourceAmount: recovery,
    alreadyProfitLabeled: Boolean(profit),
    sourceLabel: output.expectedImpact,
  };
}

/** Hero Recoverable Profit Opportunity presentation from Demo Provider. */
export function getAlpineRecoverableProfitPresentation(): DecisionImpactPresentation {
  const hero = getAlpineHeroRecommendation();
  const impact = decisionImpactFromCurated(hero);
  return buildDecisionImpactPresentation(impact);
}

export function getAlpineShowcaseConstants() {
  return {
    store: ALPINE_OUTFITTERS,
    metrics: ALPINE_UI_METRICS,
    heroLabel: DECISION_IMPACT_COPY.heroLabel,
  };
}
