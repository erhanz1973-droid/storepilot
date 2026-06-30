import type { InventoryDataStatus } from "@/lib/inventory/types";

const LABELS: Record<InventoryDataStatus, string> = {
  verified: "Verified",
  estimated: "Estimated",
  unavailable: "Not Available",
};

const CLASS: Record<InventoryDataStatus, string> = {
  verified: "inventory-badge-verified",
  estimated: "inventory-badge-estimated",
  unavailable: "inventory-badge-unavailable",
};

export function InventoryDataBadge({
  status,
  notice,
}: {
  status: InventoryDataStatus;
  notice?: string;
}) {
  return (
    <span className={`inventory-data-badge ${CLASS[status]}`} title={notice}>
      {LABELS[status]}
    </span>
  );
}
