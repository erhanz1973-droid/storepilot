import type { StoreSnapshot } from "@/lib/connectors/types";
import type { ProfitDashboard } from "@/lib/profit/types";
import type { ValidationGateReport } from "@/lib/recommendations/validation/types";
import type { ModuleReadiness } from "./types";

export function buildModuleReadiness(input: {
  snapshot: StoreSnapshot;
  profitDashboard: ProfitDashboard | null;
  gate: ValidationGateReport;
  overallQualityPct: number;
}): ModuleReadiness[] {
  const { snapshot, profitDashboard, gate, overallQualityPct } = input;
  const shopify = gate.providers.find((p) => p.providerId === "shopify");
  const meta = gate.providers.find((p) => p.providerId === "meta");
  const google = gate.providers.find((p) => p.providerId === "google");
  const ga4 = gate.providers.find((p) => p.providerId === "ga4");

  const profitOk = profitDashboard?.primaryProfit.status !== "unavailable";
  const hasAds = snapshot.campaigns.length > 0 || Boolean(snapshot.googleAdsSnapshot);
  const hasCustomers =
    (snapshot.customerSnapshot?.customers.length ?? 0) > 0 ||
    snapshot.customerSnapshot?.dataTier === "aggregated_only";
  const hasInventory = snapshot.products.some((p) => p.inventoryQuantity >= 0);
  const hasGa4Ecom =
    snapshot.ga4Snapshot?.ecommerceConversionRatePct != null ||
    (snapshot.ga4Snapshot?.funnelEvents?.purchases30d ??
      snapshot.ga4Snapshot?.purchases30d ??
      0) > 0;

  const modules: ModuleReadiness[] = [
    {
      id: "executive",
      label: "Executive Dashboard",
      readinessPct: profitOk && snapshot.storeMetrics.revenue30d > 0 ? 100 : 65,
      status: profitOk ? "ready" : "partial",
      blockers: profitOk ? [] : ["Complete profit setup"],
    },
    {
      id: "marketing",
      label: "Marketing Intelligence",
      readinessPct: hasAds
        ? Math.round(((meta?.matchScore ?? 70) + (google?.matchScore ?? 60)) / 2)
        : 20,
      status: hasAds ? "ready" : "locked",
      blockers: hasAds ? [] : ["Connect Meta or Google Ads"],
    },
    {
      id: "customers",
      label: "Customer Intelligence",
      readinessPct: hasCustomers ? 72 : 18,
      status: hasCustomers ? "partial" : "locked",
      blockers: hasCustomers ? [] : ["Sync Shopify customers"],
    },
    {
      id: "inventory",
      label: "Inventory Intelligence",
      readinessPct: hasInventory ? 74 : 30,
      status: hasInventory ? "ready" : "partial",
      blockers: hasInventory ? [] : ["Product inventory levels missing"],
    },
    {
      id: "forecast",
      label: "Forecast Engine",
      readinessPct: snapshot.dailyMetrics && snapshot.dailyMetrics.length >= 14 ? 81 : 45,
      status: snapshot.dailyMetrics && snapshot.dailyMetrics.length >= 14 ? "ready" : "partial",
      blockers:
        snapshot.dailyMetrics && snapshot.dailyMetrics.length >= 14
          ? []
          : ["Need 14+ days of daily metrics"],
    },
    {
      id: "decisions",
      label: "Decision Engine",
      readinessPct: gate.canGenerateRecommendations ? 95 : 40,
      status: gate.canGenerateRecommendations ? "ready" : "locked",
      blockers: gate.canGenerateRecommendations ? [] : [gate.globalBlockReason ?? "Validation blocked"],
    },
  ];

  if (!hasGa4Ecom && ga4?.connected) {
    const m = modules.find((x) => x.id === "marketing");
    if (m) {
      m.readinessPct = Math.min(m.readinessPct, 85);
      m.blockers.push("GA4 ecommerce events incomplete");
    }
  }

  const avg = Math.round(modules.reduce((s, m) => s + m.readinessPct, 0) / modules.length);
  void overallQualityPct;
  void avg;

  return modules;
}

export function overallReadinessPct(modules: ModuleReadiness[]): number {
  if (modules.length === 0) return 0;
  return Math.round(modules.reduce((s, m) => s + m.readinessPct, 0) / modules.length);
}
