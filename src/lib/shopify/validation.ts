import type { ShopifyCollection, ShopifyProduct } from "@/lib/connectors/types";
import type { ShopifyInstallation } from "@/lib/db/shopify";

export function installationHasScopes(
  installation: Pick<ShopifyInstallation, "scopes">,
  required: string[],
): boolean {
  const granted = new Set(installation.scopes);
  return required.every((scope) => granted.has(scope));
}

export function resolveProductFromSnapshot(
  products: ShopifyProduct[],
  productId: string,
): ShopifyProduct | undefined {
  return products.find((p) => p.id === productId);
}

export function resolveCollectionFromSnapshot(
  collections: ShopifyCollection[],
  collectionId: string,
): ShopifyCollection | undefined {
  return collections.find((c) => c.id === collectionId);
}

export function findCollectionByName(
  collections: ShopifyCollection[],
  name: string,
): ShopifyCollection | undefined {
  const needle = name.toLowerCase();
  return collections.find((c) => c.title.toLowerCase().includes(needle));
}

export function ensureShopifyGid(resource: "Product" | "Collection", id: string): string {
  if (id.startsWith("gid://")) return id;
  return `gid://shopify/${resource}/${id}`;
}
