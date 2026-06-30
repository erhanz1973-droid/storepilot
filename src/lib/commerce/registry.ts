import type {
  CommercePlatformDefinition,
  CommercePlatformId,
  MarketplaceDefinition,
} from "./types";

export const COMMERCE_PLATFORMS: CommercePlatformDefinition[] = [
  {
    id: "shopify",
    label: "Shopify",
    description: "Products, orders, inventory, and collections via Shopify Admin API",
    status: "available",
    connectHref: "/connections?tab=commerce",
    connectorId: "shopify",
  },
  {
    id: "amazon_seller",
    label: "Amazon Seller Central",
    description: "Seller orders, FBA inventory, and catalog sync",
    status: "planned",
  },
  {
    id: "woocommerce",
    label: "WooCommerce",
    description: "WordPress storefront orders and product catalog",
    status: "planned",
  },
  {
    id: "bigcommerce",
    label: "BigCommerce",
    description: "Enterprise storefront catalog and order management",
    status: "planned",
  },
  {
    id: "wix",
    label: "Wix",
    description: "Wix Stores products and orders",
    status: "planned",
  },
  {
    id: "squarespace",
    label: "Squarespace Commerce",
    description: "Squarespace product and order sync",
    status: "planned",
  },
  {
    id: "magento",
    label: "Magento (Adobe Commerce)",
    description: "Adobe Commerce catalog and order APIs",
    status: "planned",
  },
  {
    id: "prestashop",
    label: "PrestaShop",
    description: "Open-source ecommerce catalog and orders",
    status: "planned",
  },
  {
    id: "opencart",
    label: "OpenCart",
    description: "OpenCart store products and sales data",
    status: "planned",
  },
];

export const MARKETPLACE_PLATFORMS: MarketplaceDefinition[] = [
  {
    id: "amazon",
    label: "Amazon",
    description: "Marketplace listings, orders, and FBA inventory",
    status: "planned",
  },
  {
    id: "ebay",
    label: "eBay",
    description: "eBay seller listings and order sync",
    status: "planned",
  },
  {
    id: "etsy",
    label: "Etsy",
    description: "Etsy shop products and order data",
    status: "planned",
  },
];

export function getCommercePlatform(id: CommercePlatformId): CommercePlatformDefinition | undefined {
  return COMMERCE_PLATFORMS.find((p) => p.id === id);
}

export function getAvailableCommercePlatforms(): CommercePlatformDefinition[] {
  return COMMERCE_PLATFORMS.filter((p) => p.status === "available");
}

export function getPlannedCommercePlatforms(): CommercePlatformDefinition[] {
  return COMMERCE_PLATFORMS.filter((p) => p.status === "planned");
}
