import type { BusinessModel } from "@/lib/business-model/types";
import type { ProductIntelligenceDashboard } from "@/lib/products/types";
import type { StoreSnapshot } from "@/lib/connectors/types";
import type { PricePosition, ProductDna, SeasonalityLevel } from "../types";

export function inferProductDna(input: {
  snapshot: StoreSnapshot;
  businessModel: BusinessModel;
  productIntelligence?: ProductIntelligenceDashboard | null;
  averageOrderValue?: number;
}): { productDna: ProductDna; pricePosition: PricePosition; seasonality: SeasonalityLevel } {
  const count = input.snapshot.products.length;
  const aov = input.averageOrderValue ?? input.snapshot.storeMetrics?.aov30d ?? 0;
  const heroes = input.productIntelligence?.heroes?.length ?? 0;
  const totalRevenue = input.snapshot.storeMetrics?.revenue30d ?? 0;
  const heroRevenue = (input.productIntelligence?.heroes ?? []).reduce(
    (s, h) => s + (h.revenue ?? 0),
    0,
  );
  const heroShare = totalRevenue > 0 ? heroRevenue / totalRevenue : 0;

  let productDna: ProductDna = "general_store";
  if (input.businessModel === "subscription") productDna = "subscription";
  else if (count <= 3) productDna = "single_product";
  else if (heroShare >= 0.45 || heroes === 1) productDna = "hero_product";
  else if (count >= 100) productDna = "large_catalog";
  else if (aov >= 200) productDna = "high_ticket";
  else if (aov > 0 && aov < 35) productDna = "low_ticket";

  let pricePosition: PricePosition = "mid_market";
  if (aov >= 300) pricePosition = "luxury";
  else if (aov >= 120) pricePosition = "premium";
  else if (aov > 0 && aov < 40) pricePosition = "budget";

  if (pricePosition === "luxury" && productDna !== "subscription") {
    productDna = "luxury";
  }

  const seasonalTags = input.snapshot.products.some((p) =>
    (p.tags ?? []).some((t) => /season|holiday|christmas|summer/i.test(t)),
  );
  const seasonality: SeasonalityLevel = seasonalTags ? "moderate" : "none";

  return { productDna, pricePosition, seasonality };
}
