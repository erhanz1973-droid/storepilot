/**
 * Idempotent webhook delivery tracking via X-Shopify-Webhook-Id.
 *
 * A delivery is claimed as `processing` before the handler runs and only marked
 * `completed` once the handler succeeds. A failed attempt is released, so the
 * Shopify retry for the same webhook id can claim it again — failing to process
 * a delivery must never consume it.
 *
 * Supabase is the source of truth. The in-memory map is only a fallback for
 * environments without a Supabase admin client (local dev, tests) or when the
 * table is unavailable; mixing the two would let a released row stay blocked.
 */

import { getSupabaseAdmin } from "@/lib/supabase/client";

const PG_UNIQUE_VIOLATION = "23505";

/** A claim older than this is assumed abandoned by a crashed/timed-out invocation. */
const STALE_CLAIM_MS = 5 * 60 * 1000;

const MEMORY_TTL_MS = 1000 * 60 * 60 * 24; // 24h

type MemoryRecord = {
  status: "processing" | "completed";
  claimedAt: number;
};

const memoryDeliveries = new Map<string, MemoryRecord>();

function pruneMemory(now = Date.now()): void {
  for (const [id, record] of memoryDeliveries) {
    if (now - record.claimedAt > MEMORY_TTL_MS) memoryDeliveries.delete(id);
  }
}

/** Test seam — the memory map is module state that would otherwise leak between cases. */
export function __resetWebhookDeliveryMemoryForTests(): void {
  memoryDeliveries.clear();
}

export type WebhookClaimReason =
  | "claimed"
  | "no_webhook_id"
  | "reclaimed_stale"
  | "already_completed"
  | "in_flight";

export type WebhookClaimResult = {
  /** True if this delivery should be processed. */
  shouldProcess: boolean;
  webhookId: string | null;
  reason: WebhookClaimReason;
  /** True when Supabase was unavailable and the memory fallback was used. */
  degraded: boolean;
};

function logIdempotency(event: string, payload: Record<string, unknown>): void {
  console.log(
    "[shopify-webhook-idempotency]",
    JSON.stringify({ event, ...payload }),
  );
}

function claimInMemory(webhookId: string, degraded: boolean): WebhookClaimResult {
  pruneMemory();
  const existing = memoryDeliveries.get(webhookId);

  if (existing?.status === "completed") {
    return { shouldProcess: false, webhookId, reason: "already_completed", degraded };
  }

  if (existing?.status === "processing") {
    if (Date.now() - existing.claimedAt <= STALE_CLAIM_MS) {
      return { shouldProcess: false, webhookId, reason: "in_flight", degraded };
    }
    memoryDeliveries.set(webhookId, { status: "processing", claimedAt: Date.now() });
    return { shouldProcess: true, webhookId, reason: "reclaimed_stale", degraded };
  }

  memoryDeliveries.set(webhookId, { status: "processing", claimedAt: Date.now() });
  return { shouldProcess: true, webhookId, reason: "claimed", degraded };
}

/**
 * Claim a webhook delivery for processing.
 *
 * Returns shouldProcess=false for a delivery that already completed, or one that
 * another invocation is currently processing.
 */
export async function claimWebhookDelivery(
  webhookId: string | null,
  meta: { topic: string; shopDomain: string | null },
): Promise<WebhookClaimResult> {
  if (!webhookId) {
    // Without an id there is nothing to deduplicate against; processing is safer
    // than dropping, and handlers are idempotent.
    return { shouldProcess: true, webhookId: null, reason: "no_webhook_id", degraded: false };
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return claimInMemory(webhookId, false);
  }

  try {
    const now = new Date().toISOString();
    const { error } = await supabase.from("shopify_webhook_deliveries").insert({
      webhook_id: webhookId,
      topic: meta.topic,
      shop_domain: meta.shopDomain,
      status: "processing",
      claimed_at: now,
      attempts: 1,
    } as Record<string, unknown>);

    if (!error) {
      return { shouldProcess: true, webhookId, reason: "claimed", degraded: false };
    }

    if (error.code !== PG_UNIQUE_VIOLATION) {
      // Table missing or another persistence problem — fall back to memory rather
      // than dropping a delivery we cannot track.
      logIdempotency("claim_persist_unavailable", {
        webhookId,
        code: error.code,
        message: error.message,
      });
      return claimInMemory(webhookId, true);
    }

    const { data, error: readError } = await supabase
      .from("shopify_webhook_deliveries")
      .select("status, claimed_at, attempts")
      .eq("webhook_id", webhookId)
      .maybeSingle();

    if (readError || !data) {
      logIdempotency("claim_read_failed", {
        webhookId,
        message: readError?.message ?? "row not found after unique violation",
      });
      return claimInMemory(webhookId, true);
    }

    const row = data as Record<string, unknown>;
    const status = row.status === "processing" ? "processing" : "completed";

    if (status === "completed") {
      return { shouldProcess: false, webhookId, reason: "already_completed", degraded: false };
    }

    const claimedAtMs = Date.parse(String(row.claimed_at ?? ""));
    const isStale = !Number.isFinite(claimedAtMs) || Date.now() - claimedAtMs > STALE_CLAIM_MS;

    if (!isStale) {
      return { shouldProcess: false, webhookId, reason: "in_flight", degraded: false };
    }

    const attempts = typeof row.attempts === "number" ? row.attempts : 1;
    const { error: reclaimError } = await supabase
      .from("shopify_webhook_deliveries")
      .update({
        status: "processing",
        claimed_at: new Date().toISOString(),
        attempts: attempts + 1,
      } as Record<string, unknown>)
      .eq("webhook_id", webhookId)
      .eq("status", "processing");

    if (reclaimError) {
      logIdempotency("reclaim_failed", { webhookId, message: reclaimError.message });
      return { shouldProcess: false, webhookId, reason: "in_flight", degraded: false };
    }

    logIdempotency("reclaimed_stale_delivery", { webhookId, attempts: attempts + 1 });
    return { shouldProcess: true, webhookId, reason: "reclaimed_stale", degraded: false };
  } catch (error) {
    logIdempotency("claim_threw", {
      webhookId,
      message: error instanceof Error ? error.message : String(error),
    });
    return claimInMemory(webhookId, true);
  }
}

/**
 * Mark a delivery as successfully processed so future retries short-circuit.
 * Never throws: a bookkeeping failure must not turn a successful delivery into a
 * retry (the row simply stays claimable once the claim goes stale).
 */
export async function completeWebhookDelivery(webhookId: string | null): Promise<void> {
  if (!webhookId) return;

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    memoryDeliveries.set(webhookId, { status: "completed", claimedAt: Date.now() });
    return;
  }

  try {
    const now = new Date().toISOString();
    const { error } = await supabase
      .from("shopify_webhook_deliveries")
      .update({
        status: "completed",
        completed_at: now,
        processed_at: now,
      } as Record<string, unknown>)
      .eq("webhook_id", webhookId);

    if (error) {
      logIdempotency("complete_failed", { webhookId, message: error.message });
      memoryDeliveries.set(webhookId, { status: "completed", claimedAt: Date.now() });
    }
  } catch (error) {
    logIdempotency("complete_threw", {
      webhookId,
      message: error instanceof Error ? error.message : String(error),
    });
    memoryDeliveries.set(webhookId, { status: "completed", claimedAt: Date.now() });
  }
}

/**
 * Release a failed delivery so the Shopify retry can claim it again.
 * Never throws: the caller is already returning a retryable status.
 */
export async function releaseWebhookDelivery(webhookId: string | null): Promise<void> {
  if (!webhookId) return;

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    memoryDeliveries.delete(webhookId);
    return;
  }

  try {
    const { error } = await supabase
      .from("shopify_webhook_deliveries")
      .delete()
      .eq("webhook_id", webhookId)
      .eq("status", "processing");

    if (error) {
      logIdempotency("release_failed", { webhookId, message: error.message });
    }
  } catch (error) {
    logIdempotency("release_threw", {
      webhookId,
      message: error instanceof Error ? error.message : String(error),
    });
  } finally {
    // Keep the fallback map consistent with the released row.
    memoryDeliveries.delete(webhookId);
  }
}
