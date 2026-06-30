import { hasLiveShopifyConnection, resolveActiveStoreId } from "@/lib/store/context";
import { PEAK_OUTFITTERS } from "@/lib/demo/peak-outfitters/constants";

/** Persistent banner when viewing fictional Peak Outfitters demo data. */
export async function DemoDataBadge() {
  const storeId = await resolveActiveStoreId();
  const live = await hasLiveShopifyConnection(storeId);
  if (live) return null;

  return (
    <div className="demo-data-banner" role="status">
      <span className="demo-data-badge">Demo Data</span>
      <span>
        <strong>{PEAK_OUTFITTERS.name}</strong> — fictional outdoor store for demonstrations. Not
        connected to a live Shopify account.
      </span>
    </div>
  );
}
