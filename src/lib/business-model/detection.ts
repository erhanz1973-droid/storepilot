import type { StoreSnapshot } from "@/lib/connectors/types";
import type { ProfitDashboard } from "@/lib/profit/types";
import type { BusinessModel, DetectionSignal } from "./types";

export type BusinessModelDetectionResult = {
  detectedModel: BusinessModel;
  confidence: number;
  signals: DetectionSignal[];
};

function scoreModel(
  model: BusinessModel,
  points: number,
  signal: string,
  detail: string,
  signals: DetectionSignal[],
): void {
  signals.push({ signal, weight: points, detail });
}

export function detectBusinessModelFromSnapshot(input: {
  snapshot: StoreSnapshot;
  profitDashboard?: ProfitDashboard | null;
}): BusinessModelDetectionResult {
  const { snapshot, profitDashboard } = input;
  const products = snapshot.products ?? [];
  const scores: Record<BusinessModel, number> = {
    own_inventory: 0,
    dropshipping: 0,
    private_label: 0,
    print_on_demand: 0,
    digital_products: 0,
    subscription: 0,
    hybrid: 0,
  };
  const signals: DetectionSignal[] = [];

  if (products.length === 0) {
    return { detectedModel: "own_inventory", confidence: 0.3, signals: [] };
  }

  const zeroInventoryCount = products.filter((p) => p.inventoryQuantity <= 0).length;
  const zeroInventoryRatio = zeroInventoryCount / products.length;
  const avgInventory =
    products.reduce((s, p) => s + p.inventoryQuantity, 0) / products.length;

  if (zeroInventoryRatio >= 0.85) {
    scores.dropshipping += 3;
    scoreModel("dropshipping", 3, "zero_inventory_ratio", `${Math.round(zeroInventoryRatio * 100)}% SKUs show zero inventory`, signals);
  } else if (zeroInventoryRatio >= 0.6) {
    scores.dropshipping += 2;
    scoreModel("dropshipping", 2, "mostly_untracked_inventory", "Majority of catalog has no on-hand stock", signals);
  }

  if (avgInventory >= 15) {
    scores.own_inventory += 3;
    scoreModel("own_inventory", 3, "tracked_inventory", `Average on-hand units ${avgInventory.toFixed(0)}`, signals);
  } else if (avgInventory >= 5 && zeroInventoryRatio < 0.5) {
    scores.own_inventory += 2;
    scoreModel("own_inventory", 2, "moderate_inventory", `Average ${avgInventory.toFixed(0)} units on hand`, signals);
  }

  const inStockRatio = products.filter((p) => p.inventoryQuantity > 0).length / products.length;
  if (inStockRatio >= 0.7 && avgInventory >= 10) {
    scores.own_inventory += 2;
    scoreModel("own_inventory", 2, "in_stock_catalog", `${Math.round(inStockRatio * 100)}% SKUs have tracked stock`, signals);
  }

  const digitalHints = products.filter((p) => {
    const title = p.title.toLowerCase();
    const tags = (p.tags ?? []).join(" ").toLowerCase();
    return (
      tags.includes("digital") ||
      tags.includes("download") ||
      title.includes("ebook") ||
      title.includes("course") ||
      title.includes("license")
    );
  }).length;

  if (digitalHints / products.length >= 0.5) {
    scores.digital_products += 3;
    scoreModel("digital_products", 3, "digital_product_types", "Catalog dominated by digital product types", signals);
  }

  const podHints = products.filter((p) => {
    const title = p.title.toLowerCase();
    const tags = (p.tags ?? []).join(" ").toLowerCase();
    return (
      tags.includes("apparel") ||
      tags.includes("print") ||
      title.includes("t-shirt") ||
      title.includes("hoodie") ||
      title.includes("mug")
    );
  }).length;

  if (podHints / products.length >= 0.4 && zeroInventoryRatio >= 0.5) {
    scores.print_on_demand += 2;
    scoreModel("print_on_demand", 2, "pod_catalog_shape", "Apparel/print catalog with low inventory tracking", signals);
  }

  const subscriptionHints = products.some((p) =>
    p.title.toLowerCase().includes("subscription"),
  );

  if (subscriptionHints) {
    scores.subscription += 2;
    scoreModel("subscription", 2, "subscription_offers", "Subscription offers detected in catalog", signals);
  }

  const marginPct = profitDashboard?.primary.profitMarginPct;
  if (marginPct != null && marginPct >= 45 && avgInventory >= 10) {
    scores.private_label += 1;
    scoreModel("private_label", 1, "healthy_margin_with_stock", `Margin ${marginPct}% with owned inventory`, signals);
  }

  if (scores.dropshipping >= 2 && scores.own_inventory >= 2) {
    scores.hybrid += scores.dropshipping + scores.own_inventory;
    scoreModel("hybrid", 2, "mixed_signals", "Both dropship and inventory signals present", signals);
  }

  const ranked = Object.entries(scores).sort(([, a], [, b]) => b - a);
  const [topModel, topScore] = ranked[0] as [BusinessModel, number];
  const [, secondScore] = ranked[1] as [BusinessModel, number];

  const confidence =
    topScore === 0
      ? 0.35
      : Math.min(0.95, 0.45 + (topScore - secondScore) * 0.12 + topScore * 0.05);

  return {
    detectedModel: topScore === 0 ? "own_inventory" : topModel,
    confidence: Math.round(confidence * 100) / 100,
    signals,
  };
}
