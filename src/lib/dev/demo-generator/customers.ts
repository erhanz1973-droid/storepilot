import { getSupabaseAdmin } from "@/lib/supabase/client";
import { DEMO_CUSTOMER_COUNT } from "./constants";
import type { DemoShopContext } from "./context";
import { demoGid, randomPerson } from "./random";

export async function generateDemoCustomers(
  ctx: DemoShopContext,
): Promise<{ inserted: number }> {
  const supabase = getSupabaseAdmin();
  if (!supabase) throw new Error("Supabase is not configured");

  const now = new Date().toISOString();
  const rows = Array.from({ length: DEMO_CUSTOMER_COUNT }, (_, index) => {
    const person = randomPerson();
    return {
      shop_id: ctx.shopId,
      shopify_gid: demoGid("Customer", index),
      email: person.email,
      first_name: person.firstName,
      last_name: `${person.lastName} (${person.countryCode})`,
      orders_count: 0,
      total_spent: 0,
      shopify_updated_at: now,
      synced_at: now,
    };
  });

  const { error } = await supabase
    .from("shopify_customers")
    .upsert(rows, { onConflict: "shop_id,shopify_gid" });

  if (error) throw new Error(error.message);
  return { inserted: rows.length };
}

export async function listDemoCustomers(ctx: DemoShopContext): Promise<
  Array<{
    shopify_gid: string;
    email: string | null;
  }>
> {
  const supabase = getSupabaseAdmin();
  if (!supabase) throw new Error("Supabase is not configured");

  const { data, error } = await supabase
    .from("shopify_customers")
    .select("shopify_gid, email")
    .eq("shop_id", ctx.shopId)
    .like("shopify_gid", "gid://storepilot-demo/Customer/%");

  if (error) throw new Error(error.message);
  return (data ?? []) as Array<{ shopify_gid: string; email: string | null }>;
}
