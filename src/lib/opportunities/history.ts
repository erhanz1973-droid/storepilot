export type OpportunityHistoryStatus =
  | "detected"
  | "viewed"
  | "ignored"
  | "resolved"
  | "expired";

export type OpportunityHistoryRecord = {
  id: string;
  storeId: string;
  opportunityKey: string;
  title: string;
  category: string;
  status: OpportunityHistoryStatus;
  estimatedMonthlyRevenue: number;
  estimatedMonthlyProfit: number;
  confidencePct: number;
  detectedAt: string;
  viewedAt?: string;
  resolvedAt?: string;
  expiredAt?: string;
  ignoreCount: number;
};

export type OpportunityHistorySummary = {
  total: number;
  detected: number;
  viewed: number;
  ignored: number;
  resolved: number;
  expired: number;
  actionRate: number;
};

export function summarizeOpportunityHistory(
  records: OpportunityHistoryRecord[],
): OpportunityHistorySummary {
  const counts = { detected: 0, viewed: 0, ignored: 0, resolved: 0, expired: 0 };
  for (const r of records) counts[r.status] += 1;
  const actionable = records.filter((r) => r.status !== "expired").length;
  const acted = records.filter((r) => r.status === "resolved").length;
  return {
    total: records.length,
    ...counts,
    actionRate: actionable > 0 ? Math.round((acted / actionable) * 100) : 0,
  };
}

export function shouldExpireOpportunity(
  record: OpportunityHistoryRecord,
  maxAgeDays = 14,
): boolean {
  if (record.status === "resolved" || record.status === "expired") return false;
  const age = Date.now() - new Date(record.detectedAt).getTime();
  return age > maxAgeDays * 86400000;
}
