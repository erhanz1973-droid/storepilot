import { getSupabaseAdmin } from "@/lib/supabase/client";
import { listStoredRecommendations } from "@/lib/db/recommendations";
import { listScheduledOutcomeRecords } from "@/lib/db/outcome-records";
import { DEMO_STORE_ID } from "@/lib/types";

/**
 * Stores that likely have pending measurements or active learning data.
 */
export async function listStoreIdsForLearningCron(): Promise<string[]> {
  const supabase = getSupabaseAdmin();
  const ids = new Set<string>();

  if (supabase) {
    const [{ data: implemented }, { data: scheduled }, { data: installs }] =
      await Promise.all([
        supabase
          .from("recommendations")
          .select("store_id")
          .eq("status", "implemented")
          .limit(500),
        supabase
          .from("outcome_records")
          .select("store_id")
          .eq("measure_status", "scheduled")
          .limit(500),
        supabase
          .from("shopify_installations")
          .select("store_id")
          .eq("status", "active")
          .limit(200),
      ]);

    for (const row of implemented ?? []) {
      if (row.store_id) ids.add(row.store_id as string);
    }
    for (const row of scheduled ?? []) {
      if (row.store_id) ids.add(row.store_id as string);
    }
    for (const row of installs ?? []) {
      if (row.store_id) ids.add(row.store_id as string);
    }
  } else {
    ids.add(DEMO_STORE_ID);
    const recs = await listStoredRecommendations(DEMO_STORE_ID);
    if (recs.some((r) => r.status === "implemented")) ids.add(DEMO_STORE_ID);
    const scheduled = await listScheduledOutcomeRecords(DEMO_STORE_ID);
    if (scheduled.length > 0) ids.add(DEMO_STORE_ID);
  }

  return [...ids];
}
