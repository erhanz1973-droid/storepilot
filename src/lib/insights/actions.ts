/** Future Action Center — execution wired when OAuth scopes allow */

export type FutureActionType =
  | "pause_campaign"
  | "increase_budget"
  | "decrease_budget"
  | "reduce_budget"
  | "scale_campaign"
  | "enable_campaign"
  | "create_promotion"
  | "create_bundle"
  | "create_discount"
  | "create_automatic_discount"
  | "create_discount_code"
  | "add_to_collection"
  | "publish_product"
  | "unpublish_product"
  | "update_product_price"
  | "restock_product"
  | "create_email_campaign";

export type ActionCapability = {
  type: FutureActionType;
  label: string;
  description: string;
  platforms: ("google_ads" | "meta_ads" | "shopify")[];
  /** Set true when OAuth scopes + API routes are live */
  available: boolean;
  requiredScopes: string[];
  /** Never execute automatically — recommendation only */
  blocked?: boolean;
};

export const ACTION_CAPABILITIES: ActionCapability[] = [
  {
    type: "pause_campaign",
    label: "Pause Campaign",
    description: "Stop delivery on an underperforming campaign",
    platforms: ["google_ads", "meta_ads"],
    available: true,
    requiredScopes: ["google_ads:mutate", "ads_management"],
  },
  {
    type: "increase_budget",
    label: "Increase Budget",
    description: "Raise daily budget on a winning campaign",
    platforms: ["google_ads", "meta_ads"],
    available: false,
    requiredScopes: ["google_ads:mutate", "ads_management"],
  },
  {
    type: "decrease_budget",
    label: "Decrease Budget",
    description: "Reduce spend on declining campaigns",
    platforms: ["google_ads", "meta_ads"],
    available: false,
    requiredScopes: ["google_ads:mutate", "ads_management"],
  },
  {
    type: "reduce_budget",
    label: "Reduce Budget",
    description: "Trim budget on underperforming campaigns",
    platforms: ["google_ads", "meta_ads"],
    available: false,
    requiredScopes: ["google_ads:mutate", "ads_management"],
  },
  {
    type: "scale_campaign",
    label: "Scale Campaign",
    description: "Increase budget on high-ROAS campaigns",
    platforms: ["google_ads", "meta_ads"],
    available: false,
    requiredScopes: ["google_ads:mutate", "ads_management"],
  },
  {
    type: "enable_campaign",
    label: "Enable Campaign",
    description: "Resume a paused campaign",
    platforms: ["google_ads", "meta_ads"],
    available: false,
    requiredScopes: ["google_ads:mutate", "ads_management"],
  },
  {
    type: "create_promotion",
    label: "Create Bundle Offer",
    description: "Create a reversible bundle discount on paired products",
    platforms: ["shopify"],
    available: true,
    requiredScopes: ["write_discounts"],
  },
  {
    type: "create_bundle",
    label: "Create Bundle",
    description: "Bundle products with a reversible automatic discount",
    platforms: ["shopify"],
    available: true,
    requiredScopes: ["write_discounts"],
  },
  {
    type: "create_discount",
    label: "Create Automatic Discount",
    description: "Create an automatic percentage-off discount on selected products",
    platforms: ["shopify"],
    available: true,
    requiredScopes: ["write_discounts"],
  },
  {
    type: "create_automatic_discount",
    label: "Create Automatic Discount",
    description: "Create an automatic percentage-off discount with start and end dates",
    platforms: ["shopify"],
    available: true,
    requiredScopes: ["write_discounts"],
  },
  {
    type: "create_discount_code",
    label: "Create Discount Code",
    description: "Create a limited-time discount code for selected products",
    platforms: ["shopify"],
    available: true,
    requiredScopes: ["write_discounts"],
  },
  {
    type: "add_to_collection",
    label: "Add to Collection",
    description: "Add a product to a merchandising collection",
    platforms: ["shopify"],
    available: true,
    requiredScopes: ["write_products"],
  },
  {
    type: "publish_product",
    label: "Publish Product",
    description: "Publish a product to the online store",
    platforms: ["shopify"],
    available: true,
    requiredScopes: ["write_products"],
  },
  {
    type: "unpublish_product",
    label: "Unpublish Product",
    description: "Unpublish a product from the online store",
    platforms: ["shopify"],
    available: true,
    requiredScopes: ["write_products"],
  },
  {
    type: "update_product_price",
    label: "Update Product Price",
    description: "Adjust SKU price based on margin analysis",
    platforms: ["shopify"],
    available: false,
    blocked: true,
    requiredScopes: ["write_products"],
  },
  {
    type: "restock_product",
    label: "Restock Product",
    description: "Trigger a purchase order or inventory adjustment",
    platforms: ["shopify"],
    available: false,
    blocked: true,
    requiredScopes: ["write_inventory", "read_inventory"],
  },
  {
    type: "create_email_campaign",
    label: "Create Email Campaign",
    description: "Launch a Klaviyo campaign or flow for a segment",
    platforms: ["shopify"],
    available: false,
    requiredScopes: ["klaviyo:campaigns:write"],
  },
];

export function getActionCapability(type: FutureActionType): ActionCapability | undefined {
  return ACTION_CAPABILITIES.find((c) => c.type === type);
}

export function isExecutableAction(type: FutureActionType): boolean {
  const cap = getActionCapability(type);
  return Boolean(cap?.available && !cap.blocked);
}
