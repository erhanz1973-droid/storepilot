/**
 * Inventory aging model — replaces "zero sales = dead inventory".
 *
 * Lifecycle (defaults):
 *   0–14 days  → New Product (never Dead Inventory)
 *  15–45 days  → Needs Attention (when sales are flat)
 *  46–90 days  → Slow Moving (when sales are flat)
 *  90+ days + no/low sales → Dead Inventory
 *
 * Thresholds are configurable per merchant override or industry preset.
 */

export type InventoryAgingStage =
  | "new_product"
  | "needs_attention"
  | "slow_moving"
  | "dead_inventory";

export type InventoryAgingThresholds = {
  /** Inclusive upper bound for New Product (default 14). */
  newProductMaxDays: number;
  /** Inclusive upper bound for Needs Attention (default 45). */
  needsAttentionMaxDays: number;
  /** Inclusive upper bound for Slow Moving (default 90). */
  slowMovingMaxDays: number;
  /** Minimum age (days) before Dead Inventory is allowed (default 90). */
  deadInventoryMinDays: number;
  /**
   * Units sold in the sales window at or below this count as "no/low sales"
   * for Needs Attention / Slow Moving / Dead (default 0).
   */
  lowSalesMaxUnits: number;
  /** Minimum on-hand units required to flag Dead Inventory (default 1). */
  minInventoryForDead: number;
};

export const DEFAULT_INVENTORY_AGING_THRESHOLDS: InventoryAgingThresholds = {
  newProductMaxDays: 14,
  needsAttentionMaxDays: 45,
  slowMovingMaxDays: 90,
  deadInventoryMinDays: 90,
  lowSalesMaxUnits: 0,
  minInventoryForDead: 1,
};

/** Industry presets — merchants can still override individual fields. */
export const INVENTORY_AGING_INDUSTRY_PRESETS: Record<string, Partial<InventoryAgingThresholds>> = {
  general: {},
  outdoor: {},
  fashion: {
    newProductMaxDays: 7,
    needsAttentionMaxDays: 30,
    slowMovingMaxDays: 60,
    deadInventoryMinDays: 60,
  },
  apparel: {
    newProductMaxDays: 7,
    needsAttentionMaxDays: 30,
    slowMovingMaxDays: 60,
    deadInventoryMinDays: 60,
  },
  electronics: {
    newProductMaxDays: 14,
    needsAttentionMaxDays: 45,
    slowMovingMaxDays: 75,
    deadInventoryMinDays: 75,
  },
  furniture: {
    newProductMaxDays: 21,
    needsAttentionMaxDays: 60,
    slowMovingMaxDays: 120,
    deadInventoryMinDays: 120,
  },
  home: {
    newProductMaxDays: 21,
    needsAttentionMaxDays: 60,
    slowMovingMaxDays: 120,
    deadInventoryMinDays: 120,
  },
  beauty: {
    newProductMaxDays: 10,
    needsAttentionMaxDays: 35,
    slowMovingMaxDays: 70,
    deadInventoryMinDays: 70,
  },
  food: {
    newProductMaxDays: 5,
    needsAttentionMaxDays: 14,
    slowMovingMaxDays: 30,
    deadInventoryMinDays: 30,
  },
};

export const INVENTORY_AGING_STAGE_LABELS: Record<InventoryAgingStage, string> = {
  new_product: "New Product",
  needs_attention: "Needs Attention",
  slow_moving: "Slow Moving",
  dead_inventory: "Dead Inventory",
};

export type InventoryAgingInput = {
  createdAt?: string | null;
  firstInventoryAt?: string | null;
  inventoryQuantity: number;
  unitsSold30d: number;
  /** Optional explicit age override (tests / imported catalogs). */
  ageDays?: number | null;
  now?: Date | string | number;
  thresholds?: Partial<InventoryAgingThresholds>;
  industry?: string | null;
};

function normalizeIndustryKey(industry?: string | null): string {
  if (!industry) return "general";
  return industry.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
}

export function resolveInventoryAgingThresholds(options?: {
  industry?: string | null;
  overrides?: Partial<InventoryAgingThresholds> | null;
}): InventoryAgingThresholds {
  const industryKey = normalizeIndustryKey(options?.industry);
  const preset =
    INVENTORY_AGING_INDUSTRY_PRESETS[industryKey] ??
    INVENTORY_AGING_INDUSTRY_PRESETS[
      Object.keys(INVENTORY_AGING_INDUSTRY_PRESETS).find((k) => industryKey.includes(k)) ?? ""
    ] ??
    {};

  const merged: InventoryAgingThresholds = {
    ...DEFAULT_INVENTORY_AGING_THRESHOLDS,
    ...preset,
    ...(options?.overrides ?? {}),
  };

  // Keep bounds coherent even if a merchant misconfigures overrides.
  merged.newProductMaxDays = Math.max(0, merged.newProductMaxDays);
  merged.needsAttentionMaxDays = Math.max(
    merged.newProductMaxDays + 1,
    merged.needsAttentionMaxDays,
  );
  merged.slowMovingMaxDays = Math.max(
    merged.needsAttentionMaxDays + 1,
    merged.slowMovingMaxDays,
  );
  merged.deadInventoryMinDays = Math.max(
    merged.needsAttentionMaxDays + 1,
    merged.deadInventoryMinDays,
  );
  merged.lowSalesMaxUnits = Math.max(0, merged.lowSalesMaxUnits);
  merged.minInventoryForDead = Math.max(1, merged.minInventoryForDead);

  return merged;
}

export function productAgeDays(input: {
  createdAt?: string | null;
  firstInventoryAt?: string | null;
  ageDays?: number | null;
  now?: Date | string | number;
}): number | null {
  if (typeof input.ageDays === "number" && Number.isFinite(input.ageDays)) {
    return Math.max(0, Math.floor(input.ageDays));
  }

  const anchor = input.firstInventoryAt || input.createdAt;
  if (!anchor) return null;

  const startMs = Date.parse(anchor);
  if (!Number.isFinite(startMs)) return null;

  const nowMs =
    input.now == null
      ? Date.now()
      : typeof input.now === "number"
        ? input.now
        : new Date(input.now).getTime();

  if (!Number.isFinite(nowMs)) return null;
  return Math.max(0, Math.floor((nowMs - startMs) / 86_400_000));
}

/**
 * Classify inventory aging. Returns null when aging labels do not apply
 * (no stock, healthy sales after the New Product window, or unknown age
 * without enough signal to call Dead Inventory).
 */
export function classifyInventoryAging(input: InventoryAgingInput): InventoryAgingStage | null {
  const thresholds = resolveInventoryAgingThresholds({
    industry: input.industry,
    overrides: input.thresholds,
  });

  if (input.inventoryQuantity <= 0) return null;

  const ageDays = productAgeDays(input);
  const lowSales = input.unitsSold30d <= thresholds.lowSalesMaxUnits;

  // Known age within New Product window — never Dead Inventory.
  if (ageDays != null && ageDays <= thresholds.newProductMaxDays) {
    return "new_product";
  }

  // Selling after launch → not an aging problem (velocity classifiers apply elsewhere).
  if (!lowSales) return null;

  // Without a create/first-inventory date we refuse to call Dead Inventory
  // (that was the old "zero sales = dead" bug for brand-new catalog SKUs).
  if (ageDays == null) {
    return "needs_attention";
  }

  if (ageDays <= thresholds.needsAttentionMaxDays) {
    return "needs_attention";
  }

  // Slow Moving covers the band after Needs Attention and before Dead Inventory.
  if (ageDays < thresholds.deadInventoryMinDays) {
    return "slow_moving";
  }

  if (input.inventoryQuantity >= thresholds.minInventoryForDead) {
    return "dead_inventory";
  }

  return "slow_moving";
}

export function isDeadInventoryByAging(input: InventoryAgingInput): boolean {
  return classifyInventoryAging(input) === "dead_inventory";
}

export function inventoryAgingStageLabel(stage: InventoryAgingStage | null): string | null {
  return stage ? INVENTORY_AGING_STAGE_LABELS[stage] : null;
}
