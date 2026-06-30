export type ConnectionCategory =
  | "commerce"
  | "advertising"
  | "analytics"
  | "marketing"
  | "payments"
  | "marketplace"
  | "business_systems"
  | "marketplaces"
  | "finance";

export type ConnectionCatalogItem = {
  id: string;
  label: string;
  description: string;
  category: ConnectionCategory;
  status: "available" | "planned" | "beta";
  connectHref?: string;
  /** Legacy connector / integration id when wired */
  integrationId?: string;
};

export const CONNECTION_CATEGORY_LABELS: Record<ConnectionCategory, string> = {
  commerce: "Commerce Platforms",
  marketplaces: "Marketplaces",
  marketplace: "Marketplace",
  advertising: "Advertising",
  analytics: "Analytics",
  marketing: "Marketing",
  payments: "Payments",
  finance: "Finance",
  business_systems: "Business Systems",
};

export const CONNECTION_CATALOG: ConnectionCatalogItem[] = [
  // Commerce Platforms
  {
    id: "shopify",
    label: "Shopify",
    description: "Products, orders, inventory, and collections",
    category: "commerce",
    status: "available",
    connectHref: "/connections?tab=commerce",
    integrationId: "shopify",
  },
  {
    id: "amazon_seller",
    label: "Amazon Seller Central",
    description: "Seller catalog, FBA inventory, and orders",
    category: "commerce",
    status: "planned",
  },
  {
    id: "woocommerce",
    label: "WooCommerce",
    description: "WordPress storefront sync",
    category: "commerce",
    status: "planned",
  },
  {
    id: "bigcommerce",
    label: "BigCommerce",
    description: "Enterprise ecommerce catalog and orders",
    category: "commerce",
    status: "planned",
  },
  {
    id: "wix",
    label: "Wix",
    description: "Wix Stores products and orders",
    category: "commerce",
    status: "planned",
  },
  {
    id: "squarespace",
    label: "Squarespace Commerce",
    description: "Squarespace product and order sync",
    category: "commerce",
    status: "planned",
  },
  {
    id: "magento",
    label: "Magento (Adobe Commerce)",
    description: "Adobe Commerce APIs",
    category: "commerce",
    status: "planned",
  },
  {
    id: "prestashop",
    label: "PrestaShop",
    description: "Open-source ecommerce platform",
    category: "commerce",
    status: "planned",
  },
  {
    id: "opencart",
    label: "OpenCart",
    description: "OpenCart store sync",
    category: "commerce",
    status: "planned",
  },

  // Marketplaces
  {
    id: "amazon_marketplace",
    label: "Amazon",
    description: "Marketplace listings and multi-channel orders",
    category: "marketplaces",
    status: "planned",
  },
  {
    id: "ebay",
    label: "eBay",
    description: "eBay seller listings and orders",
    category: "marketplaces",
    status: "planned",
  },
  {
    id: "etsy",
    label: "Etsy",
    description: "Etsy shop products and sales",
    category: "marketplaces",
    status: "planned",
  },

  // Advertising
  {
    id: "google_ads",
    label: "Google Ads",
    description: "Search, Shopping, and Performance Max campaigns",
    category: "advertising",
    status: "available",
    connectHref: "/connections",
    integrationId: "google_ads",
  },
  {
    id: "meta_ads",
    label: "Meta Ads",
    description: "Facebook and Instagram campaign performance",
    category: "advertising",
    status: "available",
    connectHref: "/connections",
    integrationId: "meta_ads",
  },
  {
    id: "tiktok_ads",
    label: "TikTok Ads",
    description: "TikTok campaign spend and conversions",
    category: "advertising",
    status: "beta",
    connectHref: "/integrations",
    integrationId: "tiktok",
  },
  {
    id: "pinterest_ads",
    label: "Pinterest Ads",
    description: "Pinterest shopping and awareness campaigns",
    category: "advertising",
    status: "planned",
  },

  // Analytics
  {
    id: "ga4",
    label: "GA4",
    description: "Sessions, landing pages, and attribution touchpoints",
    category: "analytics",
    status: "beta",
    connectHref: "/integrations",
  },
  {
    id: "google_merchant_center",
    label: "Google Merchant Center",
    description: "Product feed and Shopping performance",
    category: "analytics",
    status: "planned",
  },

  // Marketing
  {
    id: "klaviyo",
    label: "Klaviyo",
    description: "Email flows, segments, and campaign revenue",
    category: "marketing",
    status: "beta",
    connectHref: "/integrations",
    integrationId: "klaviyo",
  },
  {
    id: "mailchimp",
    label: "Mailchimp",
    description: "Email campaigns and audience segments",
    category: "marketing",
    status: "planned",
  },

  // Finance
  {
    id: "stripe",
    label: "Stripe",
    description: "Payment revenue and fee reconciliation",
    category: "finance",
    status: "planned",
  },
  {
    id: "paypal",
    label: "PayPal",
    description: "PayPal transaction and payout data",
    category: "finance",
    status: "planned",
  },

  // Business Systems
  {
    id: "erp",
    label: "ERP",
    description: "Inventory, COGS, and fulfillment from your ERP",
    category: "business_systems",
    status: "planned",
    integrationId: "erp",
  },
];

export function getConnectionsByCategory(): Record<ConnectionCategory, ConnectionCatalogItem[]> {
  const grouped = {} as Record<ConnectionCategory, ConnectionCatalogItem[]>;
  for (const item of CONNECTION_CATALOG) {
    if (!grouped[item.category]) grouped[item.category] = [];
    grouped[item.category].push(item);
  }
  return grouped;
}

export function getConnectionItem(id: string): ConnectionCatalogItem | undefined {
  return CONNECTION_CATALOG.find((c) => c.id === id);
}
