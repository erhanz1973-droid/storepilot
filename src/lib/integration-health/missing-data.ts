import type { StoreSnapshot } from "@/lib/connectors/types";
import type { ModuleReadiness } from "./types";
import type { MissingDataBlock } from "./types";

export function buildMissingDataBlocks(
  snapshot: StoreSnapshot,
  modules: ModuleReadiness[],
): MissingDataBlock[] {
  const blocks: MissingDataBlock[] = [];

  const customerModule = modules.find((m) => m.id === "customers");
  if (customerModule && customerModule.status === "locked") {
    blocks.push({
      module: "Customer Intelligence",
      headline: "Customer Intelligence is unavailable",
      explanation:
        "Shopify customer records have not been synchronized. StorePilot cannot compute LTV, cohorts, or repeat-purchase insights without customer and order history.",
      required: [
        { label: "Customers", met: (snapshot.customerSnapshot?.customers.length ?? 0) > 0 },
        { label: "Orders", met: snapshot.storeMetrics.orders30d > 0 },
        { label: "Order history", met: Boolean(snapshot.salesTrends || snapshot.dailyMetrics?.length) },
      ],
      estimatedSetupMinutes: 2,
    });
  }

  const ga4 = snapshot.ga4Snapshot;
  if (!ga4) {
    blocks.push({
      module: "Traffic & Funnel",
      headline: "GA4 is not connected",
      explanation:
        "Conversion rate, landing page analysis, and funnel intelligence require GA4 with ecommerce events enabled.",
      required: [
        { label: "GA4 property", met: false },
        { label: "Ecommerce events", met: false },
        { label: "Sessions", met: false },
      ],
      estimatedSetupMinutes: 5,
    });
  } else if (
    ga4.ecommerceConversionRatePct == null &&
    (ga4.funnelEvents?.purchases30d ?? ga4.purchases30d ?? 0) === 0
  ) {
    blocks.push({
      module: "GA4 Ecommerce",
      headline: "Ecommerce events missing in GA4",
      explanation:
        "Sessions are syncing but purchase events are not available. Marketing funnel diagnostics and conversion-based recommendations will be limited.",
      required: [
        { label: "Sessions", met: ga4.sessions30d > 0 },
        { label: "Purchase events", met: false },
        { label: "Revenue", met: ga4.purchaseRevenue30d != null },
      ],
      estimatedSetupMinutes: 10,
    });
  }

  const forecast = modules.find((m) => m.id === "forecast");
  if (forecast && forecast.readinessPct < 60) {
    blocks.push({
      module: "Forecasting",
      headline: "Forecasting needs more historical data",
      explanation:
        "Predictive models require at least 30 days of consistent daily revenue and spend history.",
      required: [
        { label: "14+ days daily metrics", met: (snapshot.dailyMetrics?.length ?? 0) >= 14 },
        { label: "30 days history", met: (snapshot.dailyMetrics?.length ?? 0) >= 28 },
        { label: "Profit baseline", met: Boolean(snapshot.profitRollups) },
      ],
      estimatedSetupMinutes: null,
    });
  }

  return blocks;
}

export function buildCapabilityMatrix(
  modules: ModuleReadiness[],
  missingBlocks: MissingDataBlock[],
): import("./types").CapabilityMatrixRow[] {
  const waiting = (id: string, fallback: string) =>
    missingBlocks.find((b) => b.module.toLowerCase().includes(id))?.headline ?? fallback;

  return [
    {
      feature: "Executive Dashboard",
      status: modules.find((m) => m.id === "executive")?.status === "ready" ? "ready" : "partial",
      reason:
        modules.find((m) => m.id === "executive")?.status === "ready"
          ? "Profit and revenue available"
          : "Complete profit setup",
    },
    {
      feature: "Marketing Intelligence",
      status: (modules.find((m) => m.id === "marketing")?.readinessPct ?? 0) >= 70 ? "ready" : "partial",
      reason:
        (modules.find((m) => m.id === "marketing")?.readinessPct ?? 0) >= 70
          ? "Ad platforms syncing"
          : waiting("meta", "Connect advertising platforms"),
    },
    {
      feature: "Decision Engine",
      status: modules.find((m) => m.id === "decisions")?.status === "ready" ? "ready" : "waiting",
      reason:
        modules.find((m) => m.id === "decisions")?.status === "ready"
          ? "Validation gate passed"
          : modules.find((m) => m.id === "decisions")?.blockers[0] ?? "Run validation",
    },
    {
      feature: "Customer Intelligence",
      status: modules.find((m) => m.id === "customers")?.status === "locked" ? "waiting" : "partial",
      reason: waiting("customer", "Waiting for Shopify customers"),
    },
    {
      feature: "Inventory Forecasting",
      status: modules.find((m) => m.id === "inventory")?.status === "ready" ? "ready" : "partial",
      reason: "Based on product inventory sync",
    },
    {
      feature: "LTV Analysis",
      status: (modules.find((m) => m.id === "customers")?.readinessPct ?? 0) >= 60 ? "partial" : "waiting",
      reason: "Waiting for customer data",
    },
    {
      feature: "Forecasting",
      status: (modules.find((m) => m.id === "forecast")?.readinessPct ?? 0) >= 70 ? "ready" : "waiting",
      reason: waiting("forecast", "Waiting for 30 days of historical data"),
    },
  ];
}
