import { buildAttributionDashboard } from "@/lib/attribution/engine";
import { buildCustomerIntelligence } from "@/lib/customers/engine";
import { assembleCustomersPageView } from "@/lib/customers/page-view";
import { computeProfitDashboard } from "@/lib/profit/engine";
import { getPeakOutfittersSnapshot } from "@/lib/demo/peak-outfitters";
import { peakOutfittersCommerceOrders } from "@/lib/demo/peak-outfitters/orders";
import type { StoreSnapshot } from "@/lib/connectors/types";
import { describe, expect, it } from "vitest";

describe("assembleCustomersPageView", () => {
  it("builds a full customer intelligence view from demo snapshot", () => {
    const snapshot = getPeakOutfittersSnapshot();
    const profitDashboard = computeProfitDashboard(snapshot, [])!;
    const attribution = buildAttributionDashboard(snapshot, profitDashboard)!;
    const intelligence = buildCustomerIntelligence({
      snapshot,
      attribution,
      profitDashboard,
    })!;

    const view = assembleCustomersPageView(intelligence);

    expect(view.dataTier).toBe("record_level");
    expect(view.executiveSummary.totalCustomers.value).toBe("1,500");
    expect(view.segments.length).toBe(7);
    expect(view.topCustomers.length).toBeGreaterThan(0);
    expect(view.acquisition.length).toBeGreaterThan(0);
    expect(view.acquisition.every((a) => Number.isInteger(a.customers))).toBe(true);
    expect(view.aiInsights.length).toBeGreaterThan(0);
    expect(view.growthCharts.last30d.series.length).toBe(4);
    expect(parseInt(view.analytics.repeatBuyers.value, 10)).toBeGreaterThan(0);
    expect(view.analytics.rfmSegments.length).toBeGreaterThan(0);
    expect(view.healthBreakdown.factors.length).toBe(5);
    expect(view.executiveSummary.repeatPurchaseRate.status).toBe("verified");
    expect(view.segments.some((s) => (s.revenueContribution ?? 0) > 0)).toBe(true);
  });

  it("aggregated-only stores show order-derived customer counts in executive summary", () => {
    const snapshot: StoreSnapshot = {
      ...getPeakOutfittersSnapshot(),
      source: "connected",
      customerSnapshot: undefined,
      commerceOrders: peakOutfittersCommerceOrders(),
      shopifyCustomersCount: 102,
      storeMetrics: {
        ...getPeakOutfittersSnapshot().storeMetrics,
        orders30d: 120,
        aov30d: 125,
      },
    };

    const profitDashboard = computeProfitDashboard(snapshot, [])!;
    const intelligence = buildCustomerIntelligence({ snapshot, profitDashboard })!;

    expect(intelligence.dataTier).toBe("aggregated_only");
    expect(intelligence.executiveSummary.totalCustomers.status).toBe("verified");
    expect(intelligence.executiveSummary.totalCustomers.badgeLabel).toBe("Verified (Aggregated)");
    expect(intelligence.executiveSummary.newCustomers.status).toBe("verified");
    expect(intelligence.executiveSummary.returningCustomers.status).toBe("verified");
    expect(intelligence.executiveSummary.averageOrderValue.status).toBe("verified");
    expect(intelligence.topCustomers).toHaveLength(0);
    expect(intelligence.acquisition).toHaveLength(0);
    expect(intelligence.segments.every((s) => s.revenueContribution == null)).toBe(true);
    expect(intelligence.analytics.purchaseFrequency.status).not.toBe("unavailable");
  });

  it("aggregated-only stores without order rows estimate counts from store metrics", () => {
    const snapshot: StoreSnapshot = {
      ...getPeakOutfittersSnapshot(),
      source: "connected",
      customerSnapshot: undefined,
      storeMetrics: {
        ...getPeakOutfittersSnapshot().storeMetrics,
        orders30d: 120,
        aov30d: 125,
      },
      shopifyCustomersCount: 102,
    };

    const profitDashboard = computeProfitDashboard(snapshot, [])!;
    const intelligence = buildCustomerIntelligence({ snapshot, profitDashboard })!;

    expect(intelligence.dataTier).toBe("aggregated_only");
    expect(intelligence.executiveSummary.totalCustomers.status).toBe("estimated");
    expect(intelligence.executiveSummary.averageOrderValue.status).toBe("verified");
    expect(intelligence.executiveSummary.repeatPurchaseRate.status).toBe("unavailable");
    expect(intelligence.topCustomers).toHaveLength(0);
  });

  it("marks LTV unavailable when store history is too short", () => {
    const snapshot = getPeakOutfittersSnapshot();
    snapshot.customerSnapshot = {
      ...snapshot.customerSnapshot!,
      storeAgeDays: 30,
      customers: snapshot.customerSnapshot!.customers.map((c) => ({
        ...c,
        ltv: null,
        ltvStatus: "unavailable" as const,
      })),
    };

    const profitDashboard = computeProfitDashboard(snapshot, [])!;
    const intelligence = buildCustomerIntelligence({ snapshot, profitDashboard })!;

    expect(intelligence.ltv.status).toBe("unavailable");
    expect(intelligence.ltv.requirements?.minHistoryDays).toBe(false);
    expect(intelligence.cohortsAvailable).toBe(false);
    expect(intelligence.cohortPreview.status).toBe("waiting");
  });

  it("never estimates LTV without sufficient evidence", () => {
    const snapshot = getPeakOutfittersSnapshot();
    const profitDashboard = computeProfitDashboard(snapshot, [])!;
    const intelligence = buildCustomerIntelligence({ snapshot, profitDashboard })!;

    if (intelligence.ltv.status === "verified") {
      expect(intelligence.ltv.average).toBeGreaterThan(0);
    } else if (intelligence.ltv.status === "unavailable") {
      expect(intelligence.ltv.average).toBeNull();
    }
  });
});
