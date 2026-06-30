import Link from "next/link";

export function CommerceEmptyState({ entity }: { entity: string }) {
  return (
    <div className="card">
      <p className="muted" style={{ margin: 0 }}>
        Connect a commerce platform to view {entity}. All providers normalize into the same data
        model — Shopify, Amazon, WooCommerce, and more.{" "}
        <Link href="/connections?tab=commerce">Connect a store</Link>
      </p>
    </div>
  );
}
