import type { RecommendationCategory } from "@/lib/types";

export type BusinessAreaId =
  | "advertising"
  | "inventory"
  | "customers"
  | "pricing"
  | "merchandising"
  | "store_operations"
  | "email_marketing"
  | "finance";

export type BusinessArea = {
  id: BusinessAreaId;
  label: string;
  categories: RecommendationCategory[];
};

export const BUSINESS_AREAS: BusinessArea[] = [
  { id: "advertising", label: "Advertising", categories: ["campaign_review"] },
  { id: "inventory", label: "Inventory", categories: ["low_inventory"] },
  { id: "customers", label: "Customers", categories: ["promotion_opportunity"] },
  { id: "pricing", label: "Pricing", categories: ["slow_selling"] },
  { id: "merchandising", label: "Merchandising", categories: ["bundle_opportunity", "homepage_merchandising"] },
  { id: "store_operations", label: "Store Operations", categories: [] },
  { id: "email_marketing", label: "Email Marketing", categories: ["promotion_opportunity"] },
  { id: "finance", label: "Finance", categories: [] },
];

export function categoryToBusinessArea(category: RecommendationCategory): BusinessAreaId {
  const match = BUSINESS_AREAS.find((a) => a.categories.includes(category));
  return match?.id ?? "store_operations";
}

export function businessAreaLabel(id: BusinessAreaId): string {
  return BUSINESS_AREAS.find((a) => a.id === id)?.label ?? "Store Operations";
}

export function categoriesForArea(area: BusinessAreaId): RecommendationCategory[] | null {
  const found = BUSINESS_AREAS.find((a) => a.id === area);
  if (!found) return null;
  if (found.categories.length === 0) return [];
  return found.categories;
}
