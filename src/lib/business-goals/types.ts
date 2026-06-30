/** Merchant-stated priorities that override how campaigns are evaluated. */
export type BusinessGoal =
  | "increase_revenue"
  | "increase_profit"
  | "acquire_new_customers"
  | "increase_returning_customers"
  | "build_brand_awareness"
  | "launch_new_product"
  | "clear_inventory"
  | "grow_email_list";

export const BUSINESS_GOAL_LABELS: Record<BusinessGoal, string> = {
  increase_revenue: "Increase Revenue",
  increase_profit: "Increase Profit",
  acquire_new_customers: "Acquire New Customers",
  increase_returning_customers: "Increase Returning Customers",
  build_brand_awareness: "Build Brand Awareness",
  launch_new_product: "Launch New Product",
  clear_inventory: "Clear Inventory",
  grow_email_list: "Grow Email List",
};

export const ALL_BUSINESS_GOALS: BusinessGoal[] = [
  "increase_revenue",
  "increase_profit",
  "acquire_new_customers",
  "increase_returning_customers",
  "build_brand_awareness",
  "launch_new_product",
  "clear_inventory",
  "grow_email_list",
];

export type StoreBusinessGoals = {
  storeId: string;
  goals: BusinessGoal[];
  primaryGoal: BusinessGoal;
};

export function normalizeBusinessGoal(raw: string): BusinessGoal | null {
  const key = raw.trim().toLowerCase().replace(/[\s-]+/g, "_") as BusinessGoal;
  return ALL_BUSINESS_GOALS.includes(key) ? key : null;
}

export function normalizeBusinessGoals(raw: string[]): BusinessGoal[] {
  const seen = new Set<BusinessGoal>();
  const out: BusinessGoal[] = [];
  for (const item of raw) {
    const goal = normalizeBusinessGoal(item);
    if (goal && !seen.has(goal)) {
      seen.add(goal);
      out.push(goal);
    }
  }
  return out.length > 0 ? out : ["increase_revenue"];
}
