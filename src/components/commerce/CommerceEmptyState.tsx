import { EmptyState } from "@/components/ui/EmptyState";

const COPY: Record<string, { title: string; reason: string; nextStep: string }> = {
  products: {
    title: "No products imported",
    reason: "Your Shopify catalog has not synced yet, or this shop has no products.",
    nextStep: "Sync your Shopify data from Connections to populate the catalog.",
  },
  orders: {
    title: "No orders yet",
    reason: "There are no orders in the synced window for this merchant.",
    nextStep: "Once orders exist in Shopify, revenue and AOV update automatically.",
  },
  collections: {
    title: "No collections yet",
    reason: "No Shopify collections are available for this shop.",
    nextStep: "Sync your Shopify data after collections exist in Admin.",
  },
};

export function CommerceEmptyState({ entity }: { entity: string }) {
  const copy = COPY[entity] ?? {
    title: `No ${entity} yet`,
    reason: "Live Shopify data appears after the authenticated shop is synced.",
    nextStep: "Sync your Shopify data from Connections.",
  };

  return (
    <div className="card">
      <EmptyState
        title={copy.title}
        reason={copy.reason}
        nextStep={copy.nextStep}
        cta={{ href: "/connections?tab=commerce", label: "Sync Shopify data" }}
      />
    </div>
  );
}
