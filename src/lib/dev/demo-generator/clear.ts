import { getSupabaseAdmin } from "@/lib/supabase/client";
import type { DemoShopContext } from "./context";
import { restoreDemoInventory } from "./inventory";

export async function clearDemoData(ctx: DemoShopContext): Promise<{
  customersDeleted: number;
  ordersDeleted: number;
}> {
  const supabase = getSupabaseAdmin();
  if (!supabase) throw new Error("Supabase is not configured");

  const [customersRes, ordersRes] = await Promise.all([
    supabase
      .from("shopify_customers")
      .delete()
      .eq("shop_id", ctx.shopId)
      .like("shopify_gid", "gid://storepilot-demo/Customer/%")
      .select("id"),
    supabase
      .from("shopify_orders")
      .delete()
      .eq("shop_id", ctx.shopId)
      .like("shopify_gid", "gid://storepilot-demo/Order/%")
      .select("id"),
  ]);

  if (customersRes.error) throw new Error(customersRes.error.message);
  if (ordersRes.error) throw new Error(ordersRes.error.message);

  await restoreDemoInventory(ctx);

  return {
    customersDeleted: customersRes.data?.length ?? 0,
    ordersDeleted: ordersRes.data?.length ?? 0,
  };
}
