import type { StoreSnapshot } from "@/lib/connectors/types";

export type InventorySeverity = "healthy" | "low" | "critical" | "unknown";

export type InventoryContext = {
  totalProducts: number;
  trackedProducts: number;
  oosCount: number;
  inStockCount: number;
  lowStockCount: number;
  oosPct: number;
  avgDaysCover: number | null;
  severity: InventorySeverity;
};

export function analyzeInventoryContext(snapshot: StoreSnapshot): InventoryContext {
  const products = snapshot.products ?? [];
  if (products.length === 0) {
    return {
      totalProducts: 0,
      trackedProducts: 0,
      oosCount: 0,
      inStockCount: 0,
      lowStockCount: 0,
      oosPct: 0,
      avgDaysCover: null,
      severity: "unknown",
    };
  }

  const oosCount = products.filter((p) => p.inventoryQuantity <= 0).length;
  const inStock = products.filter((p) => p.inventoryQuantity > 0);
  const lowStockCount = products.filter(
    (p) => p.inventoryQuantity > 0 && p.inventoryQuantity <= 5,
  ).length;
  const oosPct = Math.round((oosCount / products.length) * 1000) / 10;

  const avgDaysCover =
    inStock.length > 0
      ? Math.round(
          inStock.reduce((s, p) => {
            const daily = p.unitsSold30d / 30;
            return s + (daily > 0 ? p.inventoryQuantity / daily : 30);
          }, 0) / inStock.length,
        )
      : null;

  let severity: InventorySeverity = "healthy";
  if (oosPct >= 75 || inStock.length === 0) severity = "critical";
  else if (oosPct > 25 || (avgDaysCover != null && avgDaysCover < 7)) severity = "low";

  return {
    totalProducts: products.length,
    trackedProducts: products.length,
    oosCount,
    inStockCount: inStock.length,
    lowStockCount,
    oosPct,
    avgDaysCover,
    severity,
  };
}

export function inventoryAssumptionText(ctx: InventoryContext): { text: string; valid: boolean } {
  if (ctx.severity === "unknown") {
    return { text: "Inventory tracking unavailable — verify stock before scaling ads.", valid: false };
  }
  if (ctx.severity === "critical") {
    return {
      text: `${Math.round(ctx.oosPct)}% of tracked inventory is currently out of stock.`,
      valid: false,
    };
  }
  if (ctx.severity === "low") {
    return {
      text: `${Math.round(ctx.oosPct)}% of catalog is out of stock — scaling ads may waste spend.`,
      valid: false,
    };
  }
  const cover =
    ctx.avgDaysCover != null ? ` (~${ctx.avgDaysCover} days cover)` : "";
  return {
    text: `Inventory remains available for advertised products${cover}.`,
    valid: true,
  };
}

export function inventoryCrossModuleImpact(
  ctx: InventoryContext,
  actionTitle: string,
): { headline: string; detail: string; verificationStatus: "Verified" | "Estimated" | "Simulated" } {
  const isScaleAction =
    actionTitle.toLowerCase().includes("increase") ||
    actionTitle.toLowerCase().includes("scale") ||
    actionTitle.toLowerCase().includes("duplicate");

  if (ctx.severity === "unknown") {
    return {
      headline: "Inventory data limited",
      detail: "Connect product inventory to validate whether ads can convert demand.",
      verificationStatus: "Estimated",
    };
  }

  if (ctx.severity === "critical") {
    return {
      headline: "Critical Risk",
      detail: isScaleAction
        ? `${Math.round(ctx.oosPct)}% of tracked inventory is out of stock. Increasing advertising spend is not recommended until inventory is replenished.`
        : `${Math.round(ctx.oosPct)}% of tracked inventory is out of stock. Protect cash flow until replenishment — avoid scaling acquisition.`,
      verificationStatus: "Verified",
    };
  }

  if (ctx.severity === "low") {
    return {
      headline: `Stock pressure — ${Math.round(ctx.oosPct)}% out of stock`,
      detail:
        ctx.avgDaysCover != null
          ? `Average cover ~${ctx.avgDaysCover} days. Low inventory may limit upside from increased spend.`
          : "Low inventory may limit upside from increased spend.",
      verificationStatus: "Verified",
    };
  }

  return {
    headline:
      ctx.avgDaysCover != null
        ? `Stock cover ~${ctx.avgDaysCover} days`
        : "Inventory available",
    detail: "Inventory supports current acquisition volume.",
    verificationStatus: "Verified",
  };
}
