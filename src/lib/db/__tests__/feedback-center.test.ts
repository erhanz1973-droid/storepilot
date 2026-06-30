import { describe, expect, it, beforeEach } from "vitest";
import {
  clearFeedbackCenterMemory,
  createFeedbackReport,
  voteForFeatureRequest,
  buildFeedbackCenterView,
} from "@/lib/db/feedback-center";

const context = {
  page: "/decisions",
  appVersion: "0.1.0",
  browser: "test",
  timestamp: new Date().toISOString(),
  integrations: [{ id: "shopify", label: "Shopify", status: "connected" }],
};

describe("feedback center", () => {
  beforeEach(() => {
    clearFeedbackCenterMemory();
  });

  it("creates and lists feedback reports", async () => {
    await createFeedbackReport({
      type: "bug",
      title: "Broken chart",
      description: "The profit chart shows NaN on load.",
      context,
      storeId: "test-store",
    });

    const view = await buildFeedbackCenterView("test-store");
    expect(view.myReports).toHaveLength(1);
    expect(view.myReports[0]?.status).toBe("new");
    expect(view.myReports[0]?.type).toBe("bug");
  });

  it("allows voting on feature requests", async () => {
    const report = await createFeedbackReport({
      type: "feature_request",
      title: "PDF export",
      description: "Export weekly reports to PDF.",
      context,
      storeId: "store-a",
    });

    const vote = await voteForFeatureRequest(report.id, "store-b");
    expect(vote.voteCount).toBe(1);

    const view = await buildFeedbackCenterView("store-b");
    expect(view.featureRequests[0]?.votedByStore).toBe(true);
  });
});
