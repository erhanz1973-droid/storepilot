import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * A failed delivery must never be consumed: the Shopify retry for the same
 * webhook id has to be able to claim it again. A completed delivery must never be
 * processed twice.
 */

type DeliveryRow = {
  webhook_id: string;
  topic: string;
  shop_domain: string | null;
  status: "processing" | "completed";
  claimed_at: string;
  completed_at: string | null;
  processed_at: string | null;
  attempts: number;
};

const state = vi.hoisted(() => ({
  rows: new Map<string, Record<string, unknown>>(),
  supabaseEnabled: true,
  failInsertWith: null as { code?: string; message: string } | null,
  throwOnInsert: false,
}));

function makeQuery(table: string) {
  if (table !== "shopify_webhook_deliveries") {
    throw new Error(`unexpected table ${table}`);
  }

  return {
    insert(row: Record<string, unknown>) {
      if (state.throwOnInsert) {
        return Promise.reject(new Error("connection reset"));
      }
      if (state.failInsertWith) {
        return Promise.resolve({ data: null, error: state.failInsertWith });
      }
      const id = String(row.webhook_id);
      if (state.rows.has(id)) {
        return Promise.resolve({
          data: null,
          error: { code: "23505", message: "duplicate key value violates unique constraint" },
        });
      }
      state.rows.set(id, { ...row, completed_at: null, processed_at: row.claimed_at });
      return Promise.resolve({ data: row, error: null });
    },

    select(_columns: string) {
      const filters: Record<string, unknown> = {};
      const builder = {
        eq(column: string, value: unknown) {
          filters[column] = value;
          return builder;
        },
        maybeSingle() {
          const id = String(filters.webhook_id);
          const row = state.rows.get(id);
          return Promise.resolve({ data: row ?? null, error: null });
        },
      };
      return builder;
    },

    update(patch: Record<string, unknown>) {
      const filters: Record<string, unknown> = {};
      const builder = {
        eq(column: string, value: unknown) {
          filters[column] = value;
          return builder;
        },
        then(resolve: (value: { data: unknown; error: unknown }) => unknown) {
          const id = String(filters.webhook_id);
          const row = state.rows.get(id);
          if (row && (!filters.status || row.status === filters.status)) {
            state.rows.set(id, { ...row, ...patch });
          }
          return Promise.resolve({ data: null, error: null }).then(resolve);
        },
      };
      return builder;
    },

    delete() {
      const filters: Record<string, unknown> = {};
      const builder = {
        eq(column: string, value: unknown) {
          filters[column] = value;
          return builder;
        },
        then(resolve: (value: { data: unknown; error: unknown }) => unknown) {
          const id = String(filters.webhook_id);
          const row = state.rows.get(id);
          if (row && (!filters.status || row.status === filters.status)) {
            state.rows.delete(id);
          }
          return Promise.resolve({ data: null, error: null }).then(resolve);
        },
      };
      return builder;
    },
  };
}

vi.mock("@/lib/supabase/client", () => ({
  getSupabaseAdmin: () =>
    state.supabaseEnabled ? { from: (table: string) => makeQuery(table) } : null,
}));

import {
  __resetWebhookDeliveryMemoryForTests,
  claimWebhookDelivery,
  completeWebhookDelivery,
  releaseWebhookDelivery,
} from "@/lib/shopify/webhook-idempotency";

const META = { topic: "orders/create", shopDomain: "test.myshopify.com" };

function row(webhookId: string): DeliveryRow | undefined {
  return state.rows.get(webhookId) as DeliveryRow | undefined;
}

describe("webhook delivery idempotency", () => {
  beforeEach(() => {
    state.rows.clear();
    state.supabaseEnabled = true;
    state.failInsertWith = null;
    state.throwOnInsert = false;
    __resetWebhookDeliveryMemoryForTests();
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("claims a first-time delivery as processing", async () => {
    const claim = await claimWebhookDelivery("wh-1", META);

    expect(claim.shouldProcess).toBe(true);
    expect(claim.reason).toBe("claimed");
    expect(row("wh-1")?.status).toBe("processing");
    expect(row("wh-1")?.completed_at).toBeNull();
  });

  it("does not mark a delivery completed until it succeeds", async () => {
    await claimWebhookDelivery("wh-2", META);
    expect(row("wh-2")?.status).toBe("processing");

    await completeWebhookDelivery("wh-2");

    expect(row("wh-2")?.status).toBe("completed");
    expect(row("wh-2")?.completed_at).not.toBeNull();
  });

  it("rejects a duplicate delivery once processing completed", async () => {
    await claimWebhookDelivery("wh-3", META);
    await completeWebhookDelivery("wh-3");

    const duplicate = await claimWebhookDelivery("wh-3", META);

    expect(duplicate.shouldProcess).toBe(false);
    expect(duplicate.reason).toBe("already_completed");
  });

  it("releases a failed delivery so the Shopify retry can claim it again", async () => {
    const first = await claimWebhookDelivery("wh-4", META);
    expect(first.shouldProcess).toBe(true);

    await releaseWebhookDelivery("wh-4");
    expect(row("wh-4")).toBeUndefined();

    const retry = await claimWebhookDelivery("wh-4", META);
    expect(retry.shouldProcess).toBe(true);
    expect(retry.reason).toBe("claimed");
  });

  it("treats a concurrent in-flight delivery as a duplicate", async () => {
    await claimWebhookDelivery("wh-5", META);

    const concurrent = await claimWebhookDelivery("wh-5", META);

    expect(concurrent.shouldProcess).toBe(false);
    expect(concurrent.reason).toBe("in_flight");
  });

  it("reclaims a delivery abandoned by a crashed invocation", async () => {
    await claimWebhookDelivery("wh-6", META);
    const stale = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    state.rows.set("wh-6", { ...state.rows.get("wh-6")!, claimed_at: stale });

    const reclaimed = await claimWebhookDelivery("wh-6", META);

    expect(reclaimed.shouldProcess).toBe(true);
    expect(reclaimed.reason).toBe("reclaimed_stale");
    expect(row("wh-6")?.attempts).toBe(2);
  });

  it("processes rather than drops when the delivery table is unavailable", async () => {
    state.failInsertWith = { code: "42P01", message: 'relation "..." does not exist' };

    const claim = await claimWebhookDelivery("wh-7", META);

    expect(claim.shouldProcess).toBe(true);
    expect(claim.degraded).toBe(true);
  });

  it("processes rather than drops when the database connection throws", async () => {
    state.throwOnInsert = true;

    const claim = await claimWebhookDelivery("wh-8", META);

    expect(claim.shouldProcess).toBe(true);
    expect(claim.degraded).toBe(true);
  });

  it("still deduplicates in the memory fallback after a completed delivery", async () => {
    state.supabaseEnabled = false;

    const first = await claimWebhookDelivery("wh-9", META);
    expect(first.shouldProcess).toBe(true);
    await completeWebhookDelivery("wh-9");

    const duplicate = await claimWebhookDelivery("wh-9", META);
    expect(duplicate.shouldProcess).toBe(false);
    expect(duplicate.reason).toBe("already_completed");
  });

  it("still releases in the memory fallback so retries are processed", async () => {
    state.supabaseEnabled = false;

    await claimWebhookDelivery("wh-10", META);
    await releaseWebhookDelivery("wh-10");

    const retry = await claimWebhookDelivery("wh-10", META);
    expect(retry.shouldProcess).toBe(true);
  });

  it("always processes a delivery with no webhook id", async () => {
    const claim = await claimWebhookDelivery(null, META);

    expect(claim.shouldProcess).toBe(true);
    expect(claim.reason).toBe("no_webhook_id");
    expect(state.rows.size).toBe(0);
  });
});
