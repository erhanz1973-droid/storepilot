import type { ShopifyProduct } from "@/lib/connectors/types";
import { ALPINE_OUTFITTERS } from "./constants";

type ProductSeed = {
  id: string;
  title: string;
  category: string;
  tier: "bestseller" | "average" | "slow";
  price: number;
  unitCost: number;
  unitsSold30d: number;
  revenue30d: number;
  inventoryQuantity: number;
  tags?: string[];
  cartAdds30d?: number;
  /** UI trend arrow: up | flat | down */
  trend?: "up" | "flat" | "down";
};

const IMG =
  "https://cdn.shopify.com/s/files/1/0533/2089/files/placeholder-images-product-1_large.png";

/**
 * 18 products — revenues sum exactly to ALPINE_OUTFITTERS.revenue30d ($82,450).
 * Tuned so analyzers surface restock / bundle / pricing / pause-ad signals.
 */
const SEEDS: ProductSeed[] = [
  {
    id: "ao-1001",
    title: "Alpine Waterproof Jacket",
    category: "ao-jackets",
    tier: "bestseller",
    price: 189,
    unitCost: 72,
    unitsSold30d: 72,
    revenue30d: 13_600,
    inventoryQuantity: 14,
    tags: ["bestseller", "featured", "low-stock"],
    cartAdds30d: 210,
    trend: "up",
  },
  {
    id: "ao-1002",
    title: "Summit Backpack 35L",
    category: "ao-packs",
    tier: "bestseller",
    price: 129,
    unitCost: 48,
    unitsSold30d: 76,
    revenue30d: 9_800,
    inventoryQuantity: 92,
    tags: ["bestseller", "bundle-candidate"],
    cartAdds30d: 168,
    trend: "up",
  },
  {
    id: "ao-1003",
    title: "Trekking Poles Pro",
    category: "ao-accessories",
    tier: "bestseller",
    price: 79,
    unitCost: 26,
    unitsSold30d: 66,
    revenue30d: 5_200,
    inventoryQuantity: 118,
    tags: ["bestseller", "bundle-candidate"],
    cartAdds30d: 142,
    trend: "up",
  },
  {
    id: "ao-1004",
    title: "Merino Hiking Socks",
    category: "ao-accessories",
    tier: "bestseller",
    price: 22,
    unitCost: 6,
    unitsSold30d: 186,
    revenue30d: 4_100,
    inventoryQuantity: 248,
    tags: ["bestseller", "price-increase-candidate"],
    cartAdds30d: 420,
    trend: "up",
  },
  {
    id: "ao-1005",
    title: "Thermal Base Layer",
    category: "ao-base",
    tier: "bestseller",
    price: 68,
    unitCost: 24,
    unitsSold30d: 79,
    revenue30d: 5_400,
    inventoryQuantity: 86,
    tags: ["bestseller"],
    trend: "up",
  },
  {
    id: "ao-1006",
    title: "Camping Lantern",
    category: "ao-camp",
    tier: "slow",
    price: 48,
    unitCost: 22,
    unitsSold30d: 40,
    revenue30d: 1_900,
    inventoryQuantity: 186,
    tags: ["overstock", "slow-moving"],
    trend: "down",
  },
  {
    id: "ao-1007",
    title: "Trail Running Shoes",
    category: "ao-footwear",
    tier: "bestseller",
    price: 118,
    unitCost: 46,
    unitsSold30d: 56,
    revenue30d: 6_600,
    inventoryQuantity: 64,
    tags: ["bestseller"],
    trend: "up",
  },
  {
    id: "ao-1008",
    title: "Stainless Steel Bottle",
    category: "ao-camp",
    tier: "average",
    price: 28,
    unitCost: 8,
    unitsSold30d: 139,
    revenue30d: 3_900,
    inventoryQuantity: 210,
    tags: ["bundle-candidate"],
    cartAdds30d: 310,
    trend: "flat",
  },
  {
    id: "ao-1009",
    title: "Alpine Softshell Jacket",
    category: "ao-jackets",
    tier: "bestseller",
    price: 149,
    unitCost: 58,
    unitsSold30d: 40,
    revenue30d: 6_000,
    inventoryQuantity: 58,
    tags: ["bestseller"],
    trend: "up",
  },
  {
    id: "ao-1010",
    title: "Day Hike Pack 22L",
    category: "ao-packs",
    tier: "average",
    price: 89,
    unitCost: 34,
    unitsSold30d: 53,
    revenue30d: 4_700,
    inventoryQuantity: 74,
    trend: "up",
  },
  {
    id: "ao-1011",
    title: "Merino Beanie",
    category: "ao-accessories",
    tier: "average",
    price: 32,
    unitCost: 9,
    unitsSold30d: 91,
    revenue30d: 2_900,
    inventoryQuantity: 156,
    trend: "flat",
  },
  {
    id: "ao-1012",
    title: "Rain Shell Pants",
    category: "ao-base",
    tier: "average",
    price: 98,
    unitCost: 38,
    unitsSold30d: 36,
    revenue30d: 3_500,
    inventoryQuantity: 52,
    trend: "up",
  },
  {
    id: "ao-1013",
    title: "Trail Cap",
    category: "ao-accessories",
    tier: "average",
    price: 28,
    unitCost: 8,
    unitsSold30d: 82,
    revenue30d: 2_300,
    inventoryQuantity: 168,
    trend: "flat",
  },
  {
    id: "ao-1014",
    title: "Packable Down Vest",
    category: "ao-jackets",
    tier: "average",
    price: 159,
    unitCost: 62,
    unitsSold30d: 27,
    revenue30d: 4_300,
    inventoryQuantity: 44,
    trend: "up",
  },
  {
    id: "ao-1015",
    title: "Ultralight Stuff Sack",
    category: "ao-packs",
    tier: "average",
    price: 18,
    unitCost: 5,
    unitsSold30d: 111,
    revenue30d: 2_000,
    inventoryQuantity: 220,
    trend: "flat",
  },
  {
    id: "ao-1016",
    title: "Fleece Midlayer",
    category: "ao-base",
    tier: "average",
    price: 78,
    unitCost: 28,
    unitsSold30d: 41,
    revenue30d: 3_200,
    inventoryQuantity: 70,
    trend: "up",
  },
  {
    id: "ao-1017",
    title: "Hiking Gaiters",
    category: "ao-footwear",
    tier: "slow",
    price: 36,
    unitCost: 12,
    unitsSold30d: 44,
    revenue30d: 1_600,
    inventoryQuantity: 142,
    tags: ["overstock", "slow-moving"],
    trend: "down",
  },
  {
    id: "ao-1018",
    title: "Titanium Camp Mug",
    category: "ao-camp",
    tier: "average",
    price: 34,
    unitCost: 11,
    unitsSold30d: 43,
    revenue30d: 1_450,
    inventoryQuantity: 98,
    trend: "flat",
  },
];

function colId(category: string) {
  return `gid://shopify/Collection/${category}`;
}

export const ALPINE_OUTFITTERS_PRODUCTS: ShopifyProduct[] = SEEDS.map((s) => ({
  id: `gid://shopify/Product/${s.id}`,
  title: s.title,
  inventoryQuantity: s.inventoryQuantity,
  unitsSold30d: s.unitsSold30d,
  revenue30d: s.revenue30d,
  price: s.price,
  unitCost: s.unitCost,
  collectionIds: [colId(s.category)],
  tags: s.tags ?? [s.tier],
  imageUrl: IMG,
  cartAdds30d: s.cartAdds30d,
}));

export function alpineProductRevenueTotal(): number {
  return ALPINE_OUTFITTERS_PRODUCTS.reduce((s, p) => s + p.revenue30d, 0);
}

export function assertAlpineProductRevenue(): void {
  const total = alpineProductRevenueTotal();
  if (total !== ALPINE_OUTFITTERS.revenue30d) {
    throw new Error(
      `Alpine product revenue ${total} !== store revenue ${ALPINE_OUTFITTERS.revenue30d}`,
    );
  }
}

export const ALPINE_JACKET = ALPINE_OUTFITTERS_PRODUCTS.find((p) =>
  p.title.includes("Alpine Waterproof Jacket"),
)!;

export const ALPINE_BACKPACK = ALPINE_OUTFITTERS_PRODUCTS.find((p) =>
  p.title.includes("Summit Backpack"),
)!;

export const ALPINE_POLES = ALPINE_OUTFITTERS_PRODUCTS.find((p) =>
  p.title.includes("Trekking Poles"),
)!;

export const ALPINE_SOCKS = ALPINE_OUTFITTERS_PRODUCTS.find((p) =>
  p.title.includes("Merino Hiking Socks"),
)!;
