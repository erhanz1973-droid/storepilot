import type { CommerceOrder } from "@/lib/commerce/types";

export type CustomerOrderAggregates = {
  totalCustomers: number;
  newCustomers30d: number;
  returningCustomers30d: number;
  repeatPurchaseRatePct: number | null;
  orders30d: number;
  aov30d: number;
  /** True when computed from order rows with customer identifiers */
  fromOrderHistory: boolean;
};

const MS_30D = 30 * 86_400_000;

export function customerOrderKey(order: CommerceOrder): string | null {
  const email = order.customerEmail?.trim().toLowerCase();
  if (email) return `email:${email}`;
  if (order.customerId) return `id:${order.customerId}`;
  return null;
}

/**
 * Derive customer counts from synced order history (distinct emails / customer IDs).
 */
export function aggregateCustomersFromOrders(
  orders: CommerceOrder[],
  options?: {
    now?: Date;
    shopifyCustomersCount?: number;
  },
): CustomerOrderAggregates | null {
  const keyed = orders
    .map((order) => ({ order, key: customerOrderKey(order) }))
    .filter((row): row is { order: CommerceOrder; key: string } => row.key != null);

  if (keyed.length === 0) return null;

  const now = options?.now ?? new Date();
  const nowMs = now.getTime();

  const sorted = [...keyed].sort(
    (a, b) => new Date(a.order.createdAt).getTime() - new Date(b.order.createdAt).getTime(),
  );

  const firstOrderAt = new Map<string, number>();
  const orderCountByCustomer = new Map<string, number>();

  for (const { order, key } of sorted) {
    orderCountByCustomer.set(key, (orderCountByCustomer.get(key) ?? 0) + 1);
    if (!firstOrderAt.has(key)) {
      firstOrderAt.set(key, new Date(order.createdAt).getTime());
    }
  }

  const ordersIn30d = sorted.filter(
    ({ order }) => nowMs - new Date(order.createdAt).getTime() <= MS_30D,
  );
  const customersActive30d = new Set(ordersIn30d.map(({ key }) => key));

  let newCustomers30d = 0;
  let returningCustomers30d = 0;

  for (const key of customersActive30d) {
    const firstMs = firstOrderAt.get(key)!;
    if (nowMs - firstMs <= MS_30D) newCustomers30d += 1;
    else returningCustomers30d += 1;
  }

  const revenue30d = ordersIn30d.reduce((sum, { order }) => sum + order.revenue, 0);
  const orders30d = ordersIn30d.length;
  const aov30d = orders30d > 0 ? Math.round((revenue30d / orders30d) * 100) / 100 : 0;

  const repeatCustomers = [...orderCountByCustomer.values()].filter((count) => count >= 2).length;
  const distinctFromOrders = firstOrderAt.size;
  const totalCustomers = Math.max(
    options?.shopifyCustomersCount ?? 0,
    distinctFromOrders,
  );

  const repeatPurchaseRatePct =
    repeatCustomers >= 1 && distinctFromOrders >= 2
      ? Math.round((repeatCustomers / distinctFromOrders) * 1000) / 10
      : null;

  return {
    totalCustomers,
    newCustomers30d,
    returningCustomers30d,
    repeatPurchaseRatePct,
    orders30d,
    aov30d,
    fromOrderHistory: true,
  };
}

export function inferAggregatesFromStoreMetrics(input: {
  orders30d: number;
  aov30d: number;
  shopifyCustomersCount?: number;
}): CustomerOrderAggregates {
  const orders30d = input.orders30d;
  const distinctEstimate = Math.max(1, Math.round(orders30d * 0.72));

  return {
    totalCustomers: input.shopifyCustomersCount ?? distinctEstimate,
    newCustomers30d: Math.max(0, Math.round(distinctEstimate * 0.75)),
    returningCustomers30d: Math.max(0, Math.round(distinctEstimate * 0.25)),
    repeatPurchaseRatePct: null,
    orders30d,
    aov30d: input.aov30d,
    fromOrderHistory: false,
  };
}
