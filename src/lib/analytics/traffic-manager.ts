import type { ProfitDashboard } from "@/lib/profit/types";
import type { StoreSnapshot } from "@/lib/connectors/types";
import { buildTrafficAnalytics, type TrafficAnalytics } from "@/lib/analytics/traffic";
import {
  buildTrafficManagerV2,
  type TrafficManagerV2,
} from "@/lib/analytics/traffic-manager-v2";

export type TrafficManagerView = TrafficAnalytics & {
  v2: TrafficManagerV2;
};

export function buildTrafficManagerView(input: {
  snapshot: StoreSnapshot;
  profitDashboard?: ProfitDashboard | null;
}): TrafficManagerView {
  const base = buildTrafficAnalytics(input.snapshot);
  const v2 = buildTrafficManagerV2({
    snapshot: input.snapshot,
    profitDashboard: input.profitDashboard,
  });
  return { ...base, v2 };
}

export type { TrafficManagerV2 } from "@/lib/analytics/traffic-manager-v2";
