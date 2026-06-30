import type { AttributionModel } from "./models";

/** Return credit weights per touchpoint index (sum = 1) */
export function computeAttributionWeights(
  touchpointCount: number,
  model: AttributionModel,
  timestamps?: string[],
  purchaseTimestamp?: string,
): number[] {
  if (touchpointCount <= 0) return [];
  if (touchpointCount === 1) return [1];

  switch (model) {
    case "last_click":
      return touchpointCount === 1
        ? [1]
        : Array.from({ length: touchpointCount }, (_, i) =>
            i === touchpointCount - 1 ? 1 : 0,
          );

    case "first_click":
      return Array.from({ length: touchpointCount }, (_, i) => (i === 0 ? 1 : 0));

    case "linear":
      return Array.from({ length: touchpointCount }, () => 1 / touchpointCount);

    case "position_based": {
      if (touchpointCount === 2) return [0.5, 0.5];
      const middleShare = 0.2 / (touchpointCount - 2);
      return Array.from({ length: touchpointCount }, (_, i) => {
        if (i === 0) return 0.4;
        if (i === touchpointCount - 1) return 0.4;
        return middleShare;
      });
    }

    case "time_decay": {
      if (!timestamps?.length || !purchaseTimestamp) {
        return computeAttributionWeights(touchpointCount, "linear");
      }
      const purchaseMs = new Date(purchaseTimestamp).getTime();
      const halfLifeDays = 7;
      const halfLifeMs = halfLifeDays * 86400000;
      const raw = timestamps.map((ts) => {
        const ageMs = purchaseMs - new Date(ts).getTime();
        return Math.pow(0.5, ageMs / halfLifeMs);
      });
      const sum = raw.reduce((a, b) => a + b, 0);
      return raw.map((w) => w / sum);
    }

    default:
      return computeAttributionWeights(touchpointCount, "linear");
  }
}
