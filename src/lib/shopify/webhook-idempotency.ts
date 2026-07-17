/**
 * Idempotent webhook delivery tracking via X-Shopify-Webhook-Id.
 * Safe across retries: duplicate IDs short-circuit with a recorded hit.
 */

import { getSupabaseAdmin } from "@/lib/supabase/client";

const memoryDeliveries = new Map<string, number>();
const MEMORY_TTL_MS = 1000 * 60 * 60 * 24; // 24h

function pruneMemory(now = Date.now()): void {
  for (const [id, seenAt] of memoryDeliveries) {
    if (now - seenAt > MEMORY_TTL_MS) memoryDeliveries.delete(id);
  }
}

export type WebhookClaimResult = {
  /** True if this delivery should be processed (first time). */
  shouldProcess: boolean;
  webhookId: string | null;
};

/**
 * Claim a webhook delivery. Returns shouldProcess=false for duplicates.
 * Falls back to in-memory when Supabase is unavailable or table missing.
 */
export async function claimWebhookDelivery(
  webhookId: string | null,
  meta: { topic: string; shopDomain: string | null },
): Promise<WebhookClaimResult> {
  if (!webhookId) {
    return { shouldProcess: true, webhookId: null };
  }

  pruneMemory();
  if (memoryDeliveries.has(webhookId)) {
    return { shouldProcess: false, webhookId };
  }

  const supabase = getSupabaseAdmin();
  if (supabase) {
    const { error } = await supabase.from("shopify_webhook_deliveries").insert({
      webhook_id: webhookId,
      topic: meta.topic,
      shop_domain: meta.shopDomain,
    } as Record<string, unknown>);

    if (error) {
      // Unique violation → duplicate
      if (error.code === "23505") {
        memoryDeliveries.set(webhookId, Date.now());
        return { shouldProcess: false, webhookId };
      }
      // Table missing / other errors → fall through to memory-only
      console.warn(
        "[shopify-webhook]",
        JSON.stringify({
          event: "idempotency_persist_skipped",
          webhookId,
          message: error.message,
          code: error.code,
        }),
      );
    } else {
      memoryDeliveries.set(webhookId, Date.now());
      return { shouldProcess: true, webhookId };
    }
  }

  memoryDeliveries.set(webhookId, Date.now());
  return { shouldProcess: true, webhookId };
}
