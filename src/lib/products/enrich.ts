import type { ProductOrderStats, ProductWindowStats } from "@/lib/connectors/types";

function emptyWindow(): ProductWindowStats {
  return { units: 0, revenue: 0, discounts: 0, refunds: 0 };
}

function emptyStats(): ProductOrderStats {
  return { last7d: emptyWindow(), last30d: emptyWindow(), previous30d: emptyWindow() };
}

type OrderLine = {
  quantity: number;
  product: { id: string } | null;
  originalTotalSet: { shopMoney: { amount: string } };
  discountedTotalSet?: { shopMoney: { amount: string } } | null;
};

type OrderLike = {
  createdAt: string;
  totalPriceSet: { shopMoney: { amount: string } };
  totalShippingPriceSet?: { shopMoney: { amount: string } } | null;
  totalRefundedSet?: { shopMoney: { amount: string } } | null;
  lineItems: { edges: { node: OrderLine }[] };
};

function addToWindow(
  w: ProductWindowStats,
  qty: number,
  revenue: number,
  discount: number,
  refundShare: number,
) {
  w.units += qty;
  w.revenue = Math.round((w.revenue + revenue) * 100) / 100;
  w.discounts = Math.round((w.discounts + discount) * 100) / 100;
  w.refunds = Math.round((w.refunds + refundShare) * 100) / 100;
}

export function computeProductOrderStats(
  orders: OrderLike[],
  now = new Date(),
): Map<string, ProductOrderStats> {
  const map = new Map<string, ProductOrderStats>();
  const nowMs = now.getTime();
  const dayMs = 86400000;

  for (const order of orders) {
    const ageDays = (nowMs - new Date(order.createdAt).getTime()) / dayMs;
    const orderTotal = parseFloat(order.totalPriceSet.shopMoney.amount);
    const orderRefunds = parseFloat(order.totalRefundedSet?.shopMoney?.amount ?? "0");

    let lineRevenueSum = 0;
    const lines: { productId: string; qty: number; revenue: number; discount: number }[] = [];

    for (const { node } of order.lineItems.edges) {
      if (!node.product?.id) continue;
      const original = parseFloat(node.originalTotalSet.shopMoney.amount);
      const discounted = parseFloat(
        node.discountedTotalSet?.shopMoney?.amount ?? node.originalTotalSet.shopMoney.amount,
      );
      lineRevenueSum += original;
      lines.push({
        productId: node.product.id,
        qty: node.quantity,
        revenue: discounted,
        discount: Math.max(0, original - discounted),
      });
    }

    if (lineRevenueSum <= 0) continue;

    for (const line of lines) {
      const share = line.revenue / lineRevenueSum;
      const refundShare = orderRefunds * share;
      let stats = map.get(line.productId);
      if (!stats) {
        stats = emptyStats();
        map.set(line.productId, stats);
      }

      if (ageDays <= 7) {
        addToWindow(stats.last7d, line.qty, line.revenue, line.discount, refundShare);
      }
      if (ageDays <= 30) {
        addToWindow(stats.last30d, line.qty, line.revenue, line.discount, refundShare);
      }
      if (ageDays > 30 && ageDays <= 60) {
        addToWindow(stats.previous30d, line.qty, line.revenue, line.discount, refundShare);
      }
    }
  }

  return map;
}

/** Demo / fallback when order stats unavailable */
export function estimateProductOrderStats(
  productId: string,
  units30d: number,
  revenue30d: number,
): ProductOrderStats {
  const refundPct = 0.02;
  const discountPct = 0.04;
  const w30: ProductWindowStats = {
    units: units30d,
    revenue: revenue30d,
    discounts: Math.round(revenue30d * discountPct * 100) / 100,
    refunds: Math.round(revenue30d * refundPct * 100) / 100,
  };
  return {
    last7d: {
      units: Math.round(units30d / 4),
      revenue: Math.round(revenue30d * 0.28 * 100) / 100,
      discounts: Math.round(revenue30d * 0.28 * discountPct * 100) / 100,
      refunds: Math.round(revenue30d * 0.28 * refundPct * 100) / 100,
    },
    last30d: w30,
    previous30d: {
      units: Math.round(units30d * 0.88),
      revenue: Math.round(revenue30d * 0.9 * 100) / 100,
      discounts: Math.round(revenue30d * 0.9 * discountPct * 100) / 100,
      refunds: Math.round(revenue30d * 0.9 * refundPct * 100) / 100,
    },
  };
}

export function allocateOrderCosts(
  productRevenue: number,
  storeRevenue: number,
  storeCosts: { shipping: number; transactionFees: number; adSpend: number },
): { shipping: number; transactionFees: number; adCost: number } {
  if (storeRevenue <= 0) return { shipping: 0, transactionFees: 0, adCost: 0 };
  const share = productRevenue / storeRevenue;
  return {
    shipping: Math.round(storeCosts.shipping * share * 100) / 100,
    transactionFees: Math.round(storeCosts.transactionFees * share * 100) / 100,
    adCost: Math.round(storeCosts.adSpend * share * 100) / 100,
  };
}
