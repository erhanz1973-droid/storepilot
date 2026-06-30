import { getSupabaseAdmin } from "@/lib/supabase/client";
import { resolveActiveStoreId } from "@/lib/store/context";
import type {
  FeedbackCenterView,
  FeedbackContext,
  FeedbackReport,
  FeedbackReportStatus,
  FeedbackReportType,
  SubmitFeedbackInput,
} from "@/lib/feedback/types";

const memoryReports: FeedbackReport[] = [];
const memoryVotes = new Set<string>();

function voteKey(feedbackId: string, storeId: string): string {
  return `${feedbackId}:${storeId}`;
}

function isMissingTableError(message: string): boolean {
  return (
    message.includes("Could not find the table") ||
    message.includes("does not exist") ||
    message.includes("schema cache")
  );
}

function rowToReport(
  row: Record<string, unknown>,
  votedByStore = false,
): FeedbackReport {
  return {
    id: row.id as string,
    storeId: row.store_id as string,
    type: row.type as FeedbackReportType,
    status: row.status as FeedbackReportStatus,
    title: row.title as string,
    description: row.description as string,
    helpful: row.helpful as boolean | null,
    reason: (row.reason as string | null) ?? null,
    recommendationId: (row.recommendation_id as string | null) ?? null,
    context: row.context as FeedbackContext,
    screenshotDataUrl: (row.screenshot_data_url as string | null) ?? null,
    voteCount: (row.vote_count as number) ?? 0,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
    votedByStore,
  };
}

export async function createFeedbackReport(
  input: SubmitFeedbackInput & { context: FeedbackContext; storeId?: string },
): Promise<FeedbackReport> {
  const storeId = input.storeId ?? (await resolveActiveStoreId());
  const now = new Date().toISOString();
  const row: FeedbackReport = {
    id: crypto.randomUUID(),
    storeId,
    type: input.type,
    status: "new",
    title: input.title.trim(),
    description: input.description.trim(),
    helpful: input.helpful ?? null,
    reason: input.reason?.trim() ?? null,
    recommendationId: input.recommendationId ?? null,
    context: input.context,
    screenshotDataUrl: input.screenshotDataUrl ?? null,
    voteCount: 0,
    createdAt: now,
    updatedAt: now,
  };

  const supabase = getSupabaseAdmin();
  if (supabase) {
    const { error } = await supabase.from("feedback_reports").insert({
      id: row.id,
      store_id: row.storeId,
      type: row.type,
      status: row.status,
      title: row.title,
      description: row.description,
      helpful: row.helpful,
      reason: row.reason,
      recommendation_id: row.recommendationId,
      context: row.context,
      screenshot_data_url: row.screenshotDataUrl,
      vote_count: 0,
      created_at: row.createdAt,
      updated_at: row.updatedAt,
    });
    if (error) throw new Error(error.message);
    return row;
  }

  memoryReports.push(row);
  return row;
}

export async function listFeedbackForStore(storeId?: string): Promise<FeedbackReport[]> {
  const activeStoreId = storeId ?? (await resolveActiveStoreId());
  const supabase = getSupabaseAdmin();

  if (supabase) {
    const { data, error } = await supabase
      .from("feedback_reports")
      .select("*")
      .eq("store_id", activeStoreId)
      .order("created_at", { ascending: false });
    if (error) {
      if (isMissingTableError(error.message)) return [];
      throw new Error(error.message);
    }

    const voteIds = await listVotedFeedbackIds(activeStoreId);
    return (data ?? []).map((r) =>
      rowToReport(r as Record<string, unknown>, voteIds.has(r.id as string)),
    );
  }

  return memoryReports
    .filter((r) => r.storeId === activeStoreId)
    .map((r) => ({ ...r, votedByStore: memoryVotes.has(voteKey(r.id, activeStoreId)) }));
}

export async function listFeatureRequests(storeId?: string): Promise<FeedbackReport[]> {
  const activeStoreId = storeId ?? (await resolveActiveStoreId());
  const supabase = getSupabaseAdmin();

  if (supabase) {
    const { data, error } = await supabase
      .from("feedback_reports")
      .select("*")
      .eq("type", "feature_request")
      .order("vote_count", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) {
      if (isMissingTableError(error.message)) return [];
      throw new Error(error.message);
    }

    const voteIds = await listVotedFeedbackIds(activeStoreId);
    return (data ?? []).map((r) =>
      rowToReport(r as Record<string, unknown>, voteIds.has(r.id as string)),
    );
  }

  return memoryReports
    .filter((r) => r.type === "feature_request")
    .sort((a, b) => b.voteCount - a.voteCount)
    .map((r) => ({ ...r, votedByStore: memoryVotes.has(voteKey(r.id, activeStoreId)) }));
}

async function listVotedFeedbackIds(storeId: string): Promise<Set<string>> {
  const supabase = getSupabaseAdmin();
  if (!supabase) {
    const ids = new Set<string>();
    for (const key of memoryVotes) {
      const [fid, sid] = key.split(":");
      if (sid === storeId && fid) ids.add(fid);
    }
    return ids;
  }

  const { data, error } = await supabase
    .from("feedback_votes")
    .select("feedback_id")
    .eq("store_id", storeId);
  if (error) {
    if (isMissingTableError(error.message)) return new Set();
    throw new Error(error.message);
  }
  return new Set((data ?? []).map((r) => r.feedback_id as string));
}

export async function voteForFeatureRequest(
  feedbackId: string,
  storeId?: string,
): Promise<{ voteCount: number; voted: boolean }> {
  const activeStoreId = storeId ?? (await resolveActiveStoreId());
  const supabase = getSupabaseAdmin();

  if (supabase) {
    const { error: voteError } = await supabase.from("feedback_votes").insert({
      id: crypto.randomUUID(),
      feedback_id: feedbackId,
      store_id: activeStoreId,
    });
    if (voteError) {
      if (voteError.message.includes("duplicate") || voteError.code === "23505") {
        const { data } = await supabase
          .from("feedback_reports")
          .select("vote_count")
          .eq("id", feedbackId)
          .maybeSingle();
        return { voteCount: (data?.vote_count as number) ?? 0, voted: true };
      }
      if (isMissingTableError(voteError.message)) {
        return voteMemory(feedbackId, activeStoreId);
      }
      throw new Error(voteError.message);
    }

    const { data, error } = await supabase
      .from("feedback_reports")
      .select("vote_count")
      .eq("id", feedbackId)
      .maybeSingle();
    if (error) throw new Error(error.message);

    const newCount = ((data?.vote_count as number) ?? 0) + 1;
    await supabase
      .from("feedback_reports")
      .update({ vote_count: newCount, updated_at: new Date().toISOString() })
      .eq("id", feedbackId);

    return { voteCount: newCount, voted: true };
  }

  return voteMemory(feedbackId, activeStoreId);
}

function voteMemory(feedbackId: string, storeId: string): { voteCount: number; voted: boolean } {
  const key = voteKey(feedbackId, storeId);
  if (!memoryVotes.has(key)) {
    memoryVotes.add(key);
    const report = memoryReports.find((r) => r.id === feedbackId);
    if (report) report.voteCount += 1;
  }
  const report = memoryReports.find((r) => r.id === feedbackId);
  return { voteCount: report?.voteCount ?? 0, voted: true };
}

export async function buildFeedbackCenterView(storeId?: string): Promise<FeedbackCenterView> {
  const activeStoreId = storeId ?? (await resolveActiveStoreId());
  const [myReports, featureRequests] = await Promise.all([
    listFeedbackForStore(activeStoreId),
    listFeatureRequests(activeStoreId),
  ]);

  const resolvedStatuses: FeedbackReportStatus[] = ["fixed", "released"];
  const openCount = myReports.filter((r) => !resolvedStatuses.includes(r.status)).length;
  const resolvedCount = myReports.filter((r) => resolvedStatuses.includes(r.status)).length;

  return {
    myReports,
    featureRequests,
    stats: {
      totalSubmitted: myReports.length,
      openCount,
      resolvedCount,
    },
  };
}

/** Test helper */
export function clearFeedbackCenterMemory(): void {
  memoryReports.length = 0;
  memoryVotes.clear();
}
