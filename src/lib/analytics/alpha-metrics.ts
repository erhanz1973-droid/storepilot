import { listAlphaFunnelEvents } from "@/lib/analytics/alpha-funnel";
import { getSupabaseAdmin } from "@/lib/supabase/client";

export type AlphaDashboardMetrics = {
  generatedAt: string;
  storesTracked: number;
  installationCompleted: number;
  shopifyConnected: number;
  connectionSuccessRate: number | null;
  firstRunOpened: number;
  firstRecommendationShown: number;
  seeWhyClicked: number;
  recommendationApproved: number;
  recommendationRejected: number;
  firstRunCompleted: number;
  approvalRate: number | null;
  rejectionRate: number | null;
  avgTimeToFirstRecommendationMs: number | null;
  avgTimeToFirstApprovalMs: number | null;
  avgSessionDurationMs: number | null;
  returnVisits: number;
  storesWithZeroRecommendations: number;
  storesWithNoCompletedSync: number;
};

function avg(nums: number[]): number | null {
  if (nums.length === 0) return null;
  return Math.round(nums.reduce((a, b) => a + b, 0) / nums.length);
}

function rate(num: number, den: number): number | null {
  if (den <= 0) return null;
  return Math.round((num / den) * 1000) / 10;
}

export async function buildAlphaDashboardMetrics(): Promise<AlphaDashboardMetrics> {
  const events = await listAlphaFunnelEvents(8000);
  const byEvent = new Map<string, typeof events>();
  const storeIds = new Set<string>();

  for (const e of events) {
    storeIds.add(e.storeId);
    const list = byEvent.get(e.event) ?? [];
    list.push(e);
    byEvent.set(e.event, list);
  }

  const countStores = (event: string) => {
    const rows = byEvent.get(event) ?? [];
    return new Set(rows.map((r) => r.storeId)).size;
  };

  const installationCompleted = countStores("installation_completed");
  const shopifyConnected = countStores("shopify_connected");
  const firstRunOpened = countStores("first_run_opened");
  const firstRecommendationShown = countStores("first_recommendation_shown");
  const seeWhyClicked = countStores("see_why_clicked");
  const recommendationApproved = countStores("recommendation_approved");
  const recommendationRejected = countStores("recommendation_rejected");
  const firstRunCompleted = countStores("first_run_completed");

  const decided = recommendationApproved + recommendationRejected;

  const ttvRec = (byEvent.get("ttv_recommendation_ms") ?? [])
    .map((e) => Number(e.props.ms))
    .filter((n) => Number.isFinite(n) && n >= 0);
  const ttvApp = (byEvent.get("ttv_approval_ms") ?? [])
    .map((e) => Number(e.props.ms))
    .filter((n) => Number.isFinite(n) && n >= 0);

  // Session duration: first_run_opened → first_run_completed per store
  const sessionDurations: number[] = [];
  for (const storeId of storeIds) {
    const opened = events
      .filter((e) => e.storeId === storeId && e.event === "first_run_opened")
      .sort((a, b) => a.occurredAt.localeCompare(b.occurredAt))[0];
    const completed = events
      .filter((e) => e.storeId === storeId && e.event === "first_run_completed")
      .sort((a, b) => a.occurredAt.localeCompare(b.occurredAt))[0];
    if (opened && completed) {
      const ms = new Date(completed.occurredAt).getTime() - new Date(opened.occurredAt).getTime();
      if (ms > 0 && ms < 1000 * 60 * 60 * 6) sessionDurations.push(ms);
    }
  }

  // Return visits: stores with more than one first_run_opened or executive-ish reopen
  let returnVisits = 0;
  for (const storeId of storeIds) {
    const opens = events.filter(
      (e) => e.storeId === storeId && (e.event === "first_run_opened" || e.event === "first_run_completed"),
    ).length;
    if (opens >= 2) returnVisits += 1;
  }

  let storesWithZeroRecommendations = 0;
  let storesWithNoCompletedSync = 0;
  const connectedStores = new Set(
    (byEvent.get("shopify_connected") ?? []).map((e) => e.storeId),
  );
  for (const storeId of connectedStores) {
    const shown = events.some(
      (e) => e.storeId === storeId && e.event === "first_recommendation_shown",
    );
    if (!shown) storesWithZeroRecommendations += 1;
    const analyzed = events.some(
      (e) =>
        e.storeId === storeId &&
        (e.event === "first_recommendation_shown" || e.event === "first_run_completed"),
    );
    if (!analyzed) storesWithNoCompletedSync += 1;
  }

  // Prefer DB distinct store installs when available
  let storesTracked = storeIds.size;
  const supabase = getSupabaseAdmin();
  if (supabase) {
    const { count } = await supabase
      .from("shopify_installations")
      .select("store_id", { count: "exact", head: true })
      .eq("status", "active");
    if (typeof count === "number" && count > storesTracked) {
      storesTracked = count;
    }
  }

  return {
    generatedAt: new Date().toISOString(),
    storesTracked,
    installationCompleted,
    shopifyConnected,
    connectionSuccessRate: rate(shopifyConnected, Math.max(installationCompleted, shopifyConnected)),
    firstRunOpened,
    firstRecommendationShown,
    seeWhyClicked,
    recommendationApproved,
    recommendationRejected,
    firstRunCompleted,
    approvalRate: rate(recommendationApproved, decided),
    rejectionRate: rate(recommendationRejected, decided),
    avgTimeToFirstRecommendationMs: avg(ttvRec),
    avgTimeToFirstApprovalMs: avg(ttvApp),
    avgSessionDurationMs: avg(sessionDurations),
    returnVisits,
    storesWithZeroRecommendations,
    storesWithNoCompletedSync,
  };
}
