import { COHORT_MIN_DAYS, computeRepeatPurchaseRate, hasCustomerRecords } from "@/lib/customers/metrics";
import type { CustomerSnapshot } from "@/lib/customers/types";
import { describe, expect, it } from "vitest";

describe("customer metrics", () => {
  it("does not report repeat rate without repeat buyers", () => {
    const snapshot: CustomerSnapshot = {
      dataTier: "record_level",
      storeAgeDays: 30,
      totalCustomers: 10,
      newCustomers30d: 8,
      returningCustomers30d: 2,
      repeatPurchaseRatePct: 0,
      aov: 120,
      aovStatus: "verified",
      customers: [
        {
          id: "1",
          name: "A",
          email: "a@test.com",
          ordersCount: 1,
          revenue30d: 100,
          lifetimeRevenue: 100,
          ltv: null,
          ltvStatus: "unavailable",
          aov: 100,
          lastPurchaseAt: "2026-01-01",
          firstPurchaseAt: "2026-01-01",
          segment: "one_time",
          status: "New",
          acquisitionSource: "direct",
          acquisitionLabel: "Direct",
          totalProfit: null,
          profitStatus: "unavailable",
          favoriteProducts: [],
          purchaseHistory: [],
          daysSinceLastPurchase: 5,
        },
      ],
    };

    const repeat = computeRepeatPurchaseRate(snapshot);
    expect(repeat.status).toBe("unavailable");
    expect(repeat.notice).toContain("two purchases");
  });

  it("detects record-level vs aggregated snapshots", () => {
    expect(
      hasCustomerRecords({
        dataTier: "aggregated_only",
        storeAgeDays: 30,
        totalCustomers: 0,
        newCustomers30d: 0,
        returningCustomers30d: 0,
        repeatPurchaseRatePct: 0,
        aov: 100,
        aovStatus: "verified",
        customers: [],
      }),
    ).toBe(false);
  });

  it("uses cohort minimum constant", () => {
    expect(COHORT_MIN_DAYS).toBe(120);
  });
});
