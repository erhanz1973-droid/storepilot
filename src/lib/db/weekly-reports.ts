import type { WeeklyAiReport } from "@/lib/types";
import { DEMO_STORE_ID } from "@/lib/types";
import { getSupabaseAdmin } from "@/lib/supabase/client";

export async function saveWeeklyReport(
  storeId: string,
  weekStart: string,
  report: WeeklyAiReport,
): Promise<void> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return;

  await supabase.from("weekly_ai_reports").upsert(
    {
      store_id: storeId,
      week_start: weekStart,
      report_data: report,
    },
    { onConflict: "store_id,week_start" },
  );
}

export async function getWeeklyReport(
  storeId: string,
  weekStart: string,
): Promise<WeeklyAiReport | null> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from("weekly_ai_reports")
    .select("report_data")
    .eq("store_id", storeId)
    .eq("week_start", weekStart)
    .single();

  if (error || !data) return null;
  return (data as { report_data: WeeklyAiReport }).report_data;
}

export async function listWeeklyReports(
  storeId = DEMO_STORE_ID,
  limit = 8,
): Promise<WeeklyAiReport[]> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from("weekly_ai_reports")
    .select("report_data")
    .eq("store_id", storeId)
    .order("week_start", { ascending: false })
    .limit(limit);

  if (error || !data) return [];
  return (data as { report_data: WeeklyAiReport }[]).map((r) => r.report_data);
}
