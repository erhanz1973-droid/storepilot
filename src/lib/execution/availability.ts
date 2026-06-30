import type { FutureActionType } from "@/lib/insights/actions";
import { getActionCapability, isExecutableAction } from "@/lib/insights/actions";
import { missingScopesForShopifyAction } from "@/lib/shopify/scopes";
import type { ExecutionAvailability } from "./types";

const SHOPIFY_ONE_CLICK_ACTIONS: FutureActionType[] = [
  "create_automatic_discount",
  "create_discount",
  "create_discount_code",
  "create_bundle",
  "create_promotion",
  "add_to_collection",
  "publish_product",
  "unpublish_product",
];

export function resolveExecutionAvailability(input: {
  futureAction?: FutureActionType;
  platform?: import("./types").ExecutionPlatform;
  entityId?: string;
  metaConnected?: boolean;
  shopifyConnected?: boolean;
  shopifyScopes?: string[];
}): ExecutionAvailability {
  if (!input.futureAction) return "manual";

  const cap = getActionCapability(input.futureAction);
  if (!cap || cap.blocked) return "manual";

  if (
    input.futureAction === "pause_campaign" &&
    input.platform === "meta_ads" &&
    input.entityId &&
    input.metaConnected &&
    isExecutableAction(input.futureAction)
  ) {
    return "one_click";
  }

  if (
    input.platform === "shopify" &&
    input.entityId &&
    input.shopifyConnected &&
    SHOPIFY_ONE_CLICK_ACTIONS.includes(input.futureAction) &&
    isExecutableAction(input.futureAction)
  ) {
    const missing = missingScopesForShopifyAction(input.shopifyScopes, input.futureAction);
    if (missing.length > 0) return "manual";
    return "one_click";
  }

  if (cap.platforms.length > 0 && input.entityId && isExecutableAction(input.futureAction)) {
    return "manual";
  }

  if (cap.platforms.length > 0 && input.entityId) {
    return "manual";
  }

  return "autopilot_rule";
}

export function executionAvailabilityLabel(mode: ExecutionAvailability): string {
  switch (mode) {
    case "one_click":
      return "One-click execution available";
    case "manual":
      return "Manual execution required";
    case "autopilot_rule":
      return "Autopilot rule";
  }
}

export function executionAvailabilityDescription(mode: ExecutionAvailability): string {
  switch (mode) {
    case "one_click":
      return "StorePilot can perform this action immediately after approval.";
    case "manual":
      return "StorePilot will prepare the exact steps because this platform or action does not yet support automatic execution.";
    case "autopilot_rule":
      return "This action can be executed automatically in the future if you enable an Autopilot rule.";
  }
}
