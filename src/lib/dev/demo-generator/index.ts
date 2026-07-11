export type { DemoGeneratorAction } from "./constants";
export {
  DEMO_CUSTOMER_COUNT,
  DEMO_ORDER_COUNT,
  DEMO_REFUND_RATE,
} from "./constants";
export { resolveDemoShopContext, type DemoShopContext } from "./context";
export { generateDemoCustomers } from "./customers";
export { generateDemoOrders } from "./orders";
export { generateDemoRefunds } from "./refunds";
export { generateDemoInventoryChanges } from "./inventory";
export { clearDemoData } from "./clear";
export { refreshDashboardMetrics, type DemoMetricsSnapshot } from "./metrics";

import type { DemoGeneratorAction } from "./constants";
import { clearDemoData } from "./clear";
import { resolveDemoShopContext } from "./context";
import { generateDemoCustomers } from "./customers";
import { generateDemoInventoryChanges } from "./inventory";
import { refreshDashboardMetrics } from "./metrics";
import { generateDemoOrders } from "./orders";
import { generateDemoRefunds } from "./refunds";

export async function runDemoGeneratorAction(action: DemoGeneratorAction) {
  const ctx = await resolveDemoShopContext();

  switch (action) {
    case "generate-customers": {
      const result = await generateDemoCustomers(ctx);
      const metrics = await refreshDashboardMetrics(ctx);
      return { action, ...result, metrics };
    }
    case "generate-orders": {
      const result = await generateDemoOrders(ctx);
      const metrics = await refreshDashboardMetrics(ctx);
      return { action, ...result, metrics };
    }
    case "generate-refunds": {
      const result = await generateDemoRefunds(ctx);
      const metrics = await refreshDashboardMetrics(ctx);
      return { action, ...result, metrics };
    }
    case "generate-inventory": {
      const result = await generateDemoInventoryChanges(ctx);
      const metrics = await refreshDashboardMetrics(ctx);
      return { action, ...result, metrics };
    }
    case "clear": {
      const result = await clearDemoData(ctx);
      const metrics = await refreshDashboardMetrics(ctx);
      return { action, ...result, metrics };
    }
    default:
      throw new Error(`Unknown demo generator action: ${action satisfies never}`);
  }
}
