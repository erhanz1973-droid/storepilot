import { EmptyState } from "@/components/ui/EmptyState";

export function CommerceEmptyState({ entity }: { entity: string }) {
  return (
    <div className="card">
      <EmptyState
        title={`We're still setting up ${entity}`}
        reason="Commerce data appears after Shopify (or another storefront) is connected and synced."
        nextStep="Once connected, StorePilot analyzes products, orders, and inventory for executive recommendations."
        cta={{ href: "/connections?tab=commerce", label: "Connect your store" }}
      />
    </div>
  );
}
