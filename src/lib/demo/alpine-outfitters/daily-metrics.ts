import type { DailyMetricPoint } from "@/lib/ads/types";
import { ALPINE_OUTFITTERS } from "./constants";

const DEMO_TODAY_UTC = Date.UTC(2026, 6, 20);

/**
 * 90-day chart series with a clear upward trend — no zeros, no empty gaps.
 * Deterministic: same inputs always produce the same series.
 */
export function alpineOutfittersDailyMetrics(days = 90): DailyMetricPoint[] {
  const revenue30d = ALPINE_OUTFITTERS.revenue30d;
  const orders30d = ALPINE_OUTFITTERS.orders30d;
  const adSpend30d =
    ALPINE_OUTFITTERS.metaSpend30d + ALPINE_OUTFITTERS.googleSpend30d;
  const points: DailyMetricPoint[] = [];

  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(DEMO_TODAY_UTC - i * 86_400_000);
    const date = d.toISOString().slice(0, 10);
    const dayOfWeek = d.getUTCDay();
    const weekendBoost = dayOfWeek === 0 || dayOfWeek === 6 ? 1.1 : 1.0;
    const progress = (days - 1 - i) / (days - 1);
    const upward = 0.82 + progress * 0.28;
    const wave = 1 + Math.sin(i * 0.42) * 0.09 + Math.cos(i * 0.19) * 0.05;
    const noise = weekendBoost * upward * wave;

    points.push({
      date,
      revenue: Math.max(1, Math.round((revenue30d / 30) * noise * 100) / 100),
      adSpend: Math.max(
        1,
        Math.round((adSpend30d / 30) * (0.9 + Math.sin(i * 0.31) * 0.1) * 100) / 100,
      ),
      orders: Math.max(1, Math.round((orders30d / 30) * noise)),
    });
  }

  return points;
}
