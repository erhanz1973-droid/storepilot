import type { MetaSyncLogEntry } from "./types";
import { pushMetaSyncLog } from "./registry";

export function recordMetaSyncLog(input: {
  storeId: string;
  storeLabel?: string;
  businessId?: string;
  businessName?: string;
  adAccountId: string;
  adAccountName?: string;
  campaignCount: number;
  spend30d: number;
  currency?: string;
  durationMs: number;
  success: boolean;
  error?: string;
}): void {
  const currency = input.currency ?? "USD";
  const dateRange = "Last 30 Days";
  const lines = [
    "=== META SYNC ===",
    `Store: ${input.storeLabel ?? input.storeId}`,
    `Business: ${input.businessName ?? input.businessId ?? "—"}`,
    `Ad Account: ${input.adAccountId}`,
    `Campaigns: ${input.campaignCount}`,
    `Spend: ${input.spend30d.toFixed(2)} ${currency}`,
    `Date Range: ${dateRange}`,
    `Sync Duration: ${(input.durationMs / 1000).toFixed(1)}s`,
    input.success ? "Success" : `Failed: ${input.error ?? "unknown"}`,
  ];

  const entry: MetaSyncLogEntry = {
    id: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
    storeId: input.storeId,
    storeLabel: input.storeLabel,
    businessId: input.businessId,
    businessName: input.businessName,
    adAccountId: input.adAccountId,
    adAccountName: input.adAccountName,
    campaignCount: input.campaignCount,
    spend30d: input.spend30d,
    currency,
    dateRange,
    durationMs: input.durationMs,
    success: input.success,
    error: input.error,
    text: lines.join("\n"),
  };

  pushMetaSyncLog(entry);
}
