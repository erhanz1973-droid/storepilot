import { getSupabaseAdmin } from "@/lib/supabase/client";
import { DEMO_REFUND_RATE } from "./constants";
import type { DemoShopContext } from "./context";
import { listDemoOrders, refreshDemoCustomerStats } from "./orders";
import { randomItem } from "./random";

export async function generateDemoRefunds(
  ctx: DemoShopContext,
): Promise<{ refunded: number }> {
  const supabase = getSupabaseAdmin();
  if (!supabase) throw new Error("Supabase is not configured");

  const orders = await listDemoOrders(ctx);
  if (orders.length === 0) {
    throw new Error("Generate orders first.");
  }

  const refundable = orders.filter(
    (order) => Number(order.total_refunded ?? 0) === 0 && order.financial_status === "PAID",
  );

  const targetCount = Math.max(1, Math.round(orders.length * DEMO_REFUND_RATE));
  const selected = [...refundable]
    .sort(() => Math.random() - 0.5)
    .slice(0, Math.min(targetCount, refundable.length));

  if (selected.length === 0) {
    return { refunded: 0 };
  }

  const now = new Date().toISOString();
  let refunded = 0;

  for (const order of selected) {
    const total = Number(order.total_price ?? 0);
    const fullRefund = Math.random() < 0.35;
    const refundAmount = fullRefund
      ? total
      : Math.round(total * randomItem([0.25, 0.4, 0.5, 0.65]) * 100) / 100;

    const { error } = await supabase
      .from("shopify_orders")
      .update({
        total_refunded: refundAmount,
        financial_status: fullRefund ? "REFUNDED" : "PARTIALLY_REFUNDED",
        shopify_updated_at: now,
        synced_at: now,
      })
      .eq("shop_id", ctx.shopId)
      .eq("shopify_gid", order.shopify_gid);

    if (error) throw new Error(error.message);
    refunded += 1;
  }

  await refreshDemoCustomerStats(ctx);

  return { refunded };
}
