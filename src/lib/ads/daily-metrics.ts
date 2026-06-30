type OrderLike = { createdAt: string; totalPriceSet: { shopMoney: { amount: string } } };

export function computeDailyRevenueMetrics(
  orders: OrderLike[],
  days = 90,
  now = new Date(),
): Map<string, { revenue: number; orders: number }> {
  const byDate = new Map<string, { revenue: number; orders: number }>();
  const nowMs = now.getTime();
  const dayMs = 86400000;

  for (const order of orders) {
    const ageDays = (nowMs - new Date(order.createdAt).getTime()) / dayMs;
    if (ageDays > days) continue;
    const date = order.createdAt.split("T")[0];
    const amount = parseFloat(order.totalPriceSet.shopMoney.amount);
    const existing = byDate.get(date) ?? { revenue: 0, orders: 0 };
    existing.revenue += amount;
    existing.orders += 1;
    byDate.set(date, existing);
  }

  for (const [date, bucket] of byDate) {
    byDate.set(date, {
      revenue: Math.round(bucket.revenue * 100) / 100,
      orders: bucket.orders,
    });
  }

  return byDate;
}

export function generateDemoDailyMetrics(
  revenue30d: number,
  adSpend30d: number,
  orders30d: number,
  days = 90,
): import("@/lib/ads/types").DailyMetricPoint[] {
  const points: import("@/lib/ads/types").DailyMetricPoint[] = [];
  const now = new Date();

  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const date = d.toISOString().split("T")[0];
    const noise = 0.85 + (Math.sin(i * 0.5) + 1) * 0.15;
    points.push({
      date,
      revenue: Math.round((revenue30d / 30) * noise * 100) / 100,
      adSpend: Math.round((adSpend30d / 30) * noise * 100) / 100,
      orders: Math.max(1, Math.round((orders30d / 30) * noise)),
    });
  }

  return points;
}
