import type { ShopifyProduct } from "@/lib/connectors/types";

type ProductSeed = {
  id: string;
  title: string;
  category: string;
  tier: "bestseller" | "average" | "slow" | "dead";
  price: number;
  unitCost: number;
  unitsSold30d: number;
  revenue30d: number;
  inventoryQuantity: number;
  tags?: string[];
  cartAdds30d?: number;
};

const IMG = "https://cdn.shopify.com/s/files/1/0533/2089/files/placeholder-images-product-1_large.png";

/** Revenues sum to $184,250 — matches PEAK_OUTFITTERS.revenue30d */
const SEEDS: ProductSeed[] = [
  { id: "po-1001", title: "Mountain Pro Backpack 65L", category: "po-backpacks", tier: "bestseller", price: 249, unitCost: 98, unitsSold30d: 114, revenue30d: 28_400, inventoryQuantity: 142, tags: ["bestseller", "featured"] },
  { id: "po-1002", title: "TrailMaster Hiking Boots", category: "po-boots", tier: "bestseller", price: 189, unitCost: 72, unitsSold30d: 91, revenue30d: 17_200, inventoryQuantity: 96, tags: ["bestseller"] },
  { id: "po-1003", title: "Alpine 2-Person Tent", category: "po-tents", tier: "bestseller", price: 329, unitCost: 128, unitsSold30d: 46, revenue30d: 15_200, inventoryQuantity: 58, tags: ["bestseller"] },
  { id: "po-1004", title: "Summit Down Sleeping Bag", category: "po-sleeping", tier: "bestseller", price: 279, unitCost: 108, unitsSold30d: 44, revenue30d: 12_400, inventoryQuantity: 74, tags: ["bestseller"] },
  { id: "po-1005", title: "Insulated Water Bottle Pro 32oz", category: "po-bottles", tier: "bestseller", price: 42, unitCost: 11, unitsSold30d: 257, revenue30d: 10_800, inventoryQuantity: 310, tags: ["bestseller", "bundle-candidate"], cartAdds30d: 650 },
  { id: "po-1006", title: "LED Headlamp Pro 800L", category: "po-flashlights", tier: "bestseller", price: 59, unitCost: 18, unitsSold30d: 156, revenue30d: 9_200, inventoryQuantity: 186, tags: ["bestseller"] },
  { id: "po-1007", title: "Compact Camp Stove", category: "po-stoves", tier: "bestseller", price: 89, unitCost: 32, unitsSold30d: 97, revenue30d: 8_600, inventoryQuantity: 112, tags: ["bestseller"] },
  { id: "po-1008", title: "Carbon Trekking Poles (Pair)", category: "po-accessories", tier: "bestseller", price: 79, unitCost: 24, unitsSold30d: 86, revenue30d: 6_800, inventoryQuantity: 134, tags: ["bestseller"] },
  { id: "po-1009", title: "Day Hike Backpack 28L", category: "po-backpacks", tier: "average", price: 129, unitCost: 48, unitsSold30d: 56, revenue30d: 7_200, inventoryQuantity: 88 },
  { id: "po-1010", title: "Ultralight Bivy Tent", category: "po-tents", tier: "average", price: 199, unitCost: 76, unitsSold30d: 37, revenue30d: 7_375, inventoryQuantity: 44 },
  { id: "po-1011", title: "All-Weather Hiking Boots", category: "po-boots", tier: "average", price: 159, unitCost: 62, unitsSold30d: 43, revenue30d: 6_800, inventoryQuantity: 72 },
  { id: "po-1012", title: "Synthetic Sleeping Bag 20°F", category: "po-sleeping", tier: "average", price: 149, unitCost: 58, unitsSold30d: 39, revenue30d: 5_800, inventoryQuantity: 64 },
  { id: "po-1013", title: "Stainless Steel Bottle 24oz", category: "po-bottles", tier: "average", price: 32, unitCost: 9, unitsSold30d: 163, revenue30d: 5_200, inventoryQuantity: 198, tags: ["bundle-candidate"] },
  { id: "po-1014", title: "Rechargeable Camp Lantern", category: "po-flashlights", tier: "average", price: 45, unitCost: 16, unitsSold30d: 107, revenue30d: 4_800, inventoryQuantity: 118 },
  { id: "po-1015", title: "Portable Grill Stove", category: "po-stoves", tier: "average", price: 119, unitCost: 44, unitsSold30d: 37, revenue30d: 4_400, inventoryQuantity: 52 },
  { id: "po-1016", title: "Trail Gaiters", category: "po-accessories", tier: "average", price: 38, unitCost: 12, unitsSold30d: 105, revenue30d: 4_000, inventoryQuantity: 142 },
  { id: "po-1017", title: "Waterproof Dry Bag Set", category: "po-accessories", tier: "average", price: 34, unitCost: 10, unitsSold30d: 112, revenue30d: 3_800, inventoryQuantity: 156 },
  { id: "po-1018", title: "Family Camping Tent 6P", category: "po-tents", tier: "average", price: 399, unitCost: 158, unitsSold30d: 9, revenue30d: 3_600, inventoryQuantity: 22 },
  { id: "po-1019", title: "Merino Hiking Socks (3-Pack)", category: "po-accessories", tier: "average", price: 36, unitCost: 11, unitsSold30d: 94, revenue30d: 3_400, inventoryQuantity: 210 },
  { id: "po-1020", title: "Trail Running Shoes", category: "po-boots", tier: "average", price: 124, unitCost: 46, unitsSold30d: 26, revenue30d: 3_200, inventoryQuantity: 48 },
  { id: "po-1021", title: "Camping Lantern XL", category: "po-flashlights", tier: "slow", price: 68, unitCost: 42, unitsSold30d: 63, revenue30d: 4_300, inventoryQuantity: 248, tags: ["overstock", "discount-candidate"] },
  { id: "po-1022", title: "Foldable Camp Chair", category: "po-accessories", tier: "slow", price: 54, unitCost: 28, unitsSold30d: 52, revenue30d: 2_800, inventoryQuantity: 164 },
  { id: "po-1023", title: "Single Burner Stove", category: "po-stoves", tier: "slow", price: 49, unitCost: 22, unitsSold30d: 49, revenue30d: 2_400, inventoryQuantity: 98 },
  { id: "po-1024", title: "Kids Hiking Backpack", category: "po-backpacks", tier: "slow", price: 59, unitCost: 24, unitsSold30d: 37, revenue30d: 2_200, inventoryQuantity: 76 },
  { id: "po-1025", title: "Mummy Sleeping Bag 40°F", category: "po-sleeping", tier: "slow", price: 89, unitCost: 38, unitsSold30d: 22, revenue30d: 2_000, inventoryQuantity: 88 },
  { id: "po-1026", title: "Collapsible Water Bottle", category: "po-bottles", tier: "slow", price: 24, unitCost: 8, unitsSold30d: 75, revenue30d: 1_800, inventoryQuantity: 132 },
  { id: "po-1027", title: "Summit Ice Axe (Clearance)", category: "po-clearance", tier: "dead", price: 120, unitCost: 68, unitsSold30d: 2, revenue30d: 240, inventoryQuantity: 84, tags: ["clearance", "dead-inventory"] },
  { id: "po-1028", title: "Vintage Climbing Harness", category: "po-clearance", tier: "dead", price: 85, unitCost: 48, unitsSold30d: 1, revenue30d: 85, inventoryQuantity: 62, tags: ["clearance", "dead-inventory"] },
  { id: "po-1029", title: "Wool Base Layer (Discontinued)", category: "po-clearance", tier: "dead", price: 65, unitCost: 38, unitsSold30d: 0, revenue30d: 0, inventoryQuantity: 96, tags: ["clearance", "dead-inventory"] },
  { id: "po-1030", title: "Heavy Winter Parka", category: "po-clearance", tier: "dead", price: 199, unitCost: 112, unitsSold30d: 1, revenue30d: 199, inventoryQuantity: 44, tags: ["clearance", "dead-inventory", "seasonal"] },
  { id: "po-1031", title: "Trail Runner Pro 2.0", category: "po-boots", tier: "bestseller", price: 124, unitCost: 48, unitsSold30d: 28, revenue30d: 3_472, inventoryQuantity: 0, tags: ["bestseller", "out-of-stock"] },
  { id: "po-1032", title: "Winter Insulated Jacket", category: "po-accessories", tier: "average", price: 189, unitCost: 78, unitsSold30d: 22, revenue30d: 4_158, inventoryQuantity: 68, tags: ["seasonal"] },
  { id: "po-1033", title: "Rain Cover Pack 55L", category: "po-backpacks", tier: "slow", price: 34, unitCost: 12, unitsSold30d: 41, revenue30d: 1_394, inventoryQuantity: 186, tags: ["overstock"] },
  { id: "po-1034", title: "Carabiner Set Pro (6-Pack)", category: "po-accessories", tier: "average", price: 28, unitCost: 8, unitsSold30d: 6, revenue30d: 168, inventoryQuantity: 240, tags: ["launching"] },
  { id: "po-1035", title: "Eco Fuel Canister 230g", category: "po-stoves", tier: "average", price: 18, unitCost: 5, unitsSold30d: 4, revenue30d: 72, inventoryQuantity: 320, tags: ["launching"] },
];

function colId(category: string) {
  return `gid://shopify/Collection/${category}`;
}

export const PEAK_OUTFITTERS_PRODUCTS: ShopifyProduct[] = SEEDS.map((s) => ({
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

export function productRevenueTotal(): number {
  return PEAK_OUTFITTERS_PRODUCTS.reduce((s, p) => s + p.revenue30d, 0);
}

export const PEAK_OUTFITTERS_HERO = PEAK_OUTFITTERS_PRODUCTS.find((p) =>
  p.title.includes("Mountain Pro Backpack"),
)!;

export const PEAK_OUTFITTERS_LANTERN = PEAK_OUTFITTERS_PRODUCTS.find((p) =>
  p.title.includes("Camping Lantern XL"),
)!;
