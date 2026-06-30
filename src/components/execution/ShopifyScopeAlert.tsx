import Link from "next/link";
import type { DecisionItem } from "@/lib/decisions/center";

type Props = {
  item: Pick<
    DecisionItem,
    "missingShopifyScopes" | "executionBlocker" | "shopifyReconnectUrl" | "futureAction"
  >;
};

export function ShopifyScopeAlert({ item }: Props) {
  if (!item.missingShopifyScopes?.length) return null;

  return (
    <div className="shopify-scope-alert" role="alert">
      <p style={{ margin: "0 0 8px", fontSize: "0.9rem", lineHeight: 1.45 }}>
        {item.executionBlocker ??
          `Missing Shopify scopes: ${item.missingShopifyScopes.join(", ")}. Reconnect Shopify to grant write access.`}
      </p>
      {item.shopifyReconnectUrl ? (
        <a href={item.shopifyReconnectUrl} className="btn btn-secondary">
          Reconnect Shopify
        </a>
      ) : (
        <Link href="/connections" className="btn btn-secondary">
          Open Connections
        </Link>
      )}
    </div>
  );
}
