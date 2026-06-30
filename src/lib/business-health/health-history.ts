import { getSupabaseAdmin, isSupabaseConfigured } from "@/lib/supabase/client";
import type { HealthHistoryPoint } from "./types";

export async function listHealthScoreHistory(
  storeId: string,
  days = 30,
): Promise<HealthHistoryPoint[]> {
  const supabase = getSupabaseAdmin();
  if (!supabase || !isSupabaseConfigured()) return [];

  const since = new Date(Date.now() - days * 86400000).toISOString().slice(0, 10);

  const { data } = await supabase
    .from("daily_snapshots")
    .select("snapshot_date, health_score")
    .eq("store_id", storeId)
    .gte("snapshot_date", since)
    .order("snapshot_date", { ascending: true });

  if (!data?.length) return [];

  return (data as { snapshot_date: string; health_score: number }[]).map((row) => ({
    date: row.snapshot_date,
    score: row.health_score,
  }));
}

export function appendCurrentScore(
  history: HealthHistoryPoint[],
  currentScore: number,
): HealthHistoryPoint[] {
  const today = new Date().toISOString().slice(0, 10);
  const withoutToday = history.filter((h) => h.date !== today);
  return [...withoutToday, { date: today, score: currentScore }];
}
