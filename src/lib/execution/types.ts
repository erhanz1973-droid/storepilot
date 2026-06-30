import type { ExecutionMode } from "./config";
import type { FutureActionType } from "@/lib/insights/actions";
import type { ExecutionParams } from "./params";

export type ExecutionAvailability = "one_click" | "manual" | "autopilot_rule";

export type ExecutionPlatform = "meta_ads" | "google_ads" | "shopify";

export type ExecutionEntityType = "campaign" | "product" | "discount" | "email" | "collection";

export type ExecutionLogStatus = "validated" | "ready" | "success" | "failed" | "skipped";

export type MetaPauseCampaignRequest = {
  method: "POST";
  url: string;
  body: { status: "PAUSED" };
  campaignId: string;
  campaignName: string;
  adAccountId: string;
};

export type ActionExecutionContext = {
  storeId: string;
  actionType: FutureActionType;
  platform: ExecutionPlatform;
  entityType: ExecutionEntityType;
  entityId: string;
  entityName: string;
  decisionId?: string;
  recommendationId?: string;
  opportunityKey?: string;
  approvedBy?: string;
  params?: ExecutionParams;
};

export type ActionExecutionOutcome = {
  success: boolean;
  mode: ExecutionMode;
  status: ExecutionLogStatus;
  message: string;
  executed: boolean;
  logId?: string;
  request?: Record<string, unknown>;
  providerResponse?: unknown;
  validationErrors?: string[];
  durationMs?: number;
};

export type ActionExecutionLog = {
  id: string;
  storeId: string;
  decisionId: string | null;
  recommendationId: string | null;
  opportunityKey: string | null;
  actionType: string;
  platform: string;
  entityType: string;
  entityId: string;
  entityName: string;
  executionMode: ExecutionMode;
  status: ExecutionLogStatus;
  approvedBy: string;
  requestPayload: Record<string, unknown>;
  responsePayload: Record<string, unknown> | null;
  errorMessage: string | null;
  executedAt: string;
  durationMs?: number;
};
