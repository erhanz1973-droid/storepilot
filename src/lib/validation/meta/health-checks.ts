import type { MetaAdsInstallation } from "@/lib/db/meta-ads";
import type { MetaAccountInfo, MetaAccountInsights30d } from "./metrics";
import type { MetaHealthCheck } from "./types";

const REQUIRED_SCOPES = ["ads_read", "business_management"];

export function runMetaHealthChecks(input: {
  installation: MetaAdsInstallation | null;
  accountInfo: MetaAccountInfo | null;
  accountInfoError?: string;
  insights: MetaAccountInsights30d | null;
  insightsError?: string;
  campaignCount: number;
  dashboardGenerated: boolean;
  tokenValid: boolean;
}): MetaHealthCheck[] {
  const checks: MetaHealthCheck[] = [];

  checks.push({
    id: "ad_account_selected",
    label: "Selected ad account exists",
    passed: Boolean(input.installation?.ad_account_id),
    detail: input.installation?.ad_account_id ?? "No installation",
  });

  checks.push({
    id: "token_valid",
    label: "Token valid",
    passed: input.tokenValid,
    detail: input.tokenValid ? "Access token accepted by Graph API" : "Token rejected or expired",
  });

  checks.push({
    id: "campaign_count",
    label: "Campaign count > 0",
    passed: input.campaignCount > 0,
    detail: `${input.campaignCount} campaigns`,
  });

  checks.push({
    id: "currency",
    label: "Currency received",
    passed: Boolean(input.accountInfo?.currency),
    detail: input.accountInfo?.currency ?? input.accountInfoError ?? "Missing",
  });

  checks.push({
    id: "insights_reachable",
    label: "Insights endpoint reachable",
    passed: Boolean(input.insights),
    detail: input.insightsError ?? (input.insights ? "last_30d account insights OK" : "Failed"),
  });

  checks.push({
    id: "dashboard_values",
    label: "Dashboard values generated",
    passed: input.dashboardGenerated,
    detail: input.dashboardGenerated ? "Rollups available from sync pipeline" : "No rollups in cache",
  });

  const scopes = input.installation?.scopes ?? [];
  const missingScopes = REQUIRED_SCOPES.filter((s) => !scopes.includes(s));
  checks.push({
    id: "permissions",
    label: missingScopes.length === 0 ? "Permissions OK" : "Missing permissions",
    passed: missingScopes.length === 0,
    detail: missingScopes.length === 0 ? scopes.join(", ") : `Missing: ${missingScopes.join(", ")}`,
  });

  const accountOk = input.accountInfo != null && input.accountInfo.accountStatus !== 2;
  checks.push({
    id: "account_valid",
    label: accountOk ? "Ad account valid" : "Invalid account",
    passed: accountOk,
    detail: input.accountInfo
      ? `status=${input.accountInfo.accountStatus}`
      : input.accountInfoError ?? "Could not load account",
  });

  return checks;
}
