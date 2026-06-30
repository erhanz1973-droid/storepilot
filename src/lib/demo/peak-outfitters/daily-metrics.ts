import type { DailyMetricPoint } from "@/lib/ads/types";
import { PEAK_OUTFITTERS } from "./constants";

/** 90-day chart data with believable weekly seasonality (not flat lines). */
export function peakOutfittersDailyMetrics(days = 90): DailyMetricPoint[] {
  const revenue30d = PEAK_OUTFITTERS.revenue30d;
  const orders30d = PEAK_OUTFITTERS.orders30d;
  const adSpend30d = 42_544;
  const points: DailyMetricPoint[] = [];
  const now = new Date();

  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const date = d.toISOString().slice(0, 10);
    const dayOfWeek = d.getDay();
    const weekendBoost = dayOfWeek === 0 || dayOfWeek === 6 ? 1.12 : 1.0;
    const wave = 0.78 + Math.sin(i * 0.45) * 0.14 + Math.cos(i * 0.17) * 0.08;
    const trend = 1 + (days - i) / days / 20;
    const noise = weekendBoost * wave * trend;

    points.push({
      date,
      revenue: Math.round((revenue30d / 30) * noise * 100) / 100,
      adSpend: Math.round((adSpend30d / 30) * (0.9 + Math.sin(i * 0.3) * 0.1) * 100) / 100,
      orders: Math.max(1, Math.round((orders30d / 30) * noise)),
    });
  }

  return points;
}
