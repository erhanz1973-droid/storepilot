import { describe, expect, it, vi, beforeEach } from "vitest";
import type { ExecutionActionHandler } from "@/lib/execution/provider";
import type { ActionExecutionContext } from "@/lib/execution/types";
import { clearHandlersForTests, registerHandler } from "@/lib/execution/registry";
import { runExecutionPipeline } from "@/lib/execution/pipeline";

vi.mock("@/lib/db/action-executions", () => ({
  insertActionExecution: vi.fn(async (input) => ({
    id: "log-pipeline",
    storeId: input.storeId,
    decisionId: input.decisionId ?? null,
    recommendationId: input.recommendationId ?? null,
    opportunityKey: input.opportunityKey ?? null,
    actionType: input.actionType,
    platform: input.platform,
    entityType: input.entityType,
    entityId: input.entityId,
    entityName: input.entityName,
    executionMode: input.executionMode,
    status: input.status,
    approvedBy: input.approvedBy ?? "Merchant",
    requestPayload: input.requestPayload,
    responsePayload: input.responsePayload ?? null,
    errorMessage: input.errorMessage ?? null,
    executedAt: new Date().toISOString(),
    durationMs: input.durationMs,
  })),
}));

const baseCtx: ActionExecutionContext = {
  storeId: "demo-store",
  actionType: "pause_campaign",
  platform: "meta_ads",
  entityType: "campaign",
  entityId: "camp-1",
  entityName: "Test Campaign",
};

describe("runExecutionPipeline", () => {
  beforeEach(() => {
    vi.stubEnv("STOREPILOT_EXECUTION_MODE", "dry_run");
    clearHandlersForTests();
  });

  it("runs validate → build → dry run → audit for orchestrated handlers", async () => {
    const handler: ExecutionActionHandler = {
      id: "test:pause_campaign",
      platform: "meta_ads",
      actionType: "pause_campaign",
      entityTypes: ["campaign"],
      label: "Pause Campaign",
      async validate() {
        return { valid: true, errors: [], entityName: "Resolved Name" };
      },
      async buildRequest() {
        return {
          payload: { method: "POST", url: "/camp-1", body: { status: "PAUSED" } },
          label: "Pause Campaign — Resolved Name",
        };
      },
      async executeLive() {
        return { payload: { success: true } };
      },
    };

    registerHandler(handler);
    const outcome = await runExecutionPipeline(baseCtx, handler);

    expect(outcome.success).toBe(true);
    expect(outcome.executed).toBe(false);
    expect(outcome.status).toBe("ready");
    expect(outcome.message).toContain("ready to be executed");
    expect(outcome.request?.url).toBe("/camp-1");
    expect(outcome.durationMs).toBeGreaterThanOrEqual(0);
  });

  it("stops on validation failure with audit log", async () => {
    const handler: ExecutionActionHandler = {
      id: "test:invalid",
      platform: "google_ads",
      actionType: "pause_campaign",
      entityTypes: ["campaign"],
      label: "Pause Campaign",
      async validate() {
        return { valid: false, errors: ["Google Ads is not connected."] };
      },
      async buildRequest() {
        return { payload: {} };
      },
      async executeLive() {
        return { payload: {} };
      },
    };

    const outcome = await runExecutionPipeline(baseCtx, handler);

    expect(outcome.success).toBe(false);
    expect(outcome.status).toBe("failed");
    expect(outcome.validationErrors).toContain("Google Ads is not connected.");
  });

  it("delegates to executeLegacy for migrated Shopify handlers", async () => {
    const handler: ExecutionActionHandler = {
      id: "test:legacy",
      platform: "shopify",
      actionType: "create_discount",
      entityTypes: ["product"],
      label: "Create Discount",
      async executeLegacy() {
        return {
          success: true,
          mode: "dry_run",
          status: "ready",
          message: "legacy path",
          executed: false,
          logId: "legacy-log",
        };
      },
    };

    const outcome = await runExecutionPipeline(
      { ...baseCtx, platform: "shopify", actionType: "create_discount", entityType: "product" },
      handler,
    );

    expect(outcome.message).toBe("legacy path");
    expect(outcome.logId).toBe("legacy-log");
  });
});
