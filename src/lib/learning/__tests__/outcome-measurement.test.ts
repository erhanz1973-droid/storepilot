import { describe, expect, it, vi } from "vitest";
import { DEMO_STORE_SNAPSHOT } from "@/lib/connectors/demo-data";
import { insertOutcomeRecord } from "@/lib/db/outcome-records";
import { measureOutcomeRecord } from "@/lib/learning/outcome-measurer";

vi.mock("@/lib/connectors/registry", () => ({
  aggregateStoreSnapshot: vi.fn(async () => DEMO_STORE_SNAPSHOT),
}));

describe("Outcome measurement", () => {
  it("measures a scheduled outcome when due", async () => {
    const pastDue = new Date(Date.now() - 86400000).toISOString();
    const record = await insertOutcomeRecord({
      storeId: "demo-store",
      title: "Dead inventory — Archived Snowboard",
      category: "slow_selling",
      actionType: "create_automatic_discount",
      entityType: "product",
      entityId: "gid://shopify/Product/1007",
      entityName: "Archived Snowboard",
      baselineCapturedAt: pastDue,
      measureDueAt: pastDue,
      measurementWindowDays: 7,
      expectedMonthlyImpact: 500,
      baselineMetrics: {
        unitsSold30d: 0,
        inventoryQuantity: 50,
        revenue30d: 0,
      },
    });

    const measured = await measureOutcomeRecord(record);
    expect(measured).not.toBeNull();
    expect(measured?.measureStatus).toBe("completed");
    expect(measured?.outcomeRating).toBeTruthy();
    expect(measured?.aiVerdict).toContain("Archived Snowboard");
  });
});
