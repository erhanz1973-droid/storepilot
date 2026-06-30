import type {
  CustomerDataStatus,
  CustomerDataTier,
  CustomerMetricMeta,
  CustomerRecord,
  CustomerSnapshot,
} from "./types";

export const LTV_MIN_DAYS = 90;
export const COHORT_MIN_DAYS = 120;

export function metric(
  value: string,
  status: CustomerDataStatus,
  notice?: string,
  badgeLabel?: string,
): CustomerMetricMeta {
  return { value, status, notice, badgeLabel };
}

export function hasCustomerRecords(snapshot: CustomerSnapshot): boolean {
  return snapshot.dataTier === "record_level" && snapshot.customers.length > 0;
}

export function computeRepeatPurchaseRate(snapshot: CustomerSnapshot): CustomerMetricMeta {
  if (hasCustomerRecords(snapshot)) {
    const buyers = snapshot.customers.filter((c) => c.ordersCount >= 1);
    const repeatBuyers = snapshot.customers.filter((c) => c.ordersCount >= 2);

    if (buyers.length === 0 || repeatBuyers.length === 0) {
      return metric(
        "—",
        "unavailable",
        "Not enough historical data. At least two purchases by the same customer are required.",
      );
    }

    const pct = Math.round((repeatBuyers.length / buyers.length) * 1000) / 10;
    return metric(`${pct}%`, "verified", "Share of customers with 2+ orders");
  }

  if (snapshot.dataTier === "aggregated_only" && snapshot.aggregatedFromOrders) {
    const rate = snapshot.repeatPurchaseRatePct;
    if (rate != null && rate > 0) {
      return metric(
        `${rate}%`,
        "estimated",
        "Share of customers with 2+ orders in synced order history",
      );
    }
    return metric(
      "—",
      "unavailable",
      "Not enough historical data. At least two purchases by the same customer are required.",
    );
  }

  return metric(
    "—",
    "unavailable",
    "Not enough historical data. At least two purchases by the same customer are required.",
  );
}

export function computePurchaseFrequency(snapshot: CustomerSnapshot): CustomerMetricMeta {
  if (hasCustomerRecords(snapshot)) {
    const totalOrders = snapshot.customers.reduce((s, c) => s + c.ordersCount, 0);
    const freq = Math.round((totalOrders / snapshot.customers.length) * 10) / 10;
    return metric(`${freq} orders/customer`, "verified");
  }

  const activeCustomers = snapshot.newCustomers30d + snapshot.returningCustomers30d;
  if (
    snapshot.dataTier === "aggregated_only" &&
    snapshot.orders30d != null &&
    snapshot.orders30d > 0 &&
    activeCustomers > 0
  ) {
    const freq = Math.round((snapshot.orders30d / activeCustomers) * 10) / 10;
    return metric(
      `${freq} orders/active customer`,
      "estimated",
      "Based on 30-day orders divided by active customers (aggregated Shopify data)",
    );
  }

  return metric("—", "unavailable", "Requires synced customer-order records");
}

export function repeatBuyerCount(customers: CustomerRecord[]): number {
  return customers.filter((c) => c.ordersCount >= 2).length;
}

export function formatCustomerCount(count: number, status: CustomerDataStatus): string {
  const rounded = Math.round(count);
  if (status === "estimated") return `Estimated: ${rounded.toLocaleString()}`;
  return rounded.toLocaleString();
}
