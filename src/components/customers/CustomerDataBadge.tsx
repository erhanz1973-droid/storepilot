import type { CustomerDataStatus } from "@/lib/customers/types";

const LABELS: Record<CustomerDataStatus, string> = {
  verified: "Verified",
  estimated: "Estimated",
  unavailable: "Not Available",
};

const CLASS: Record<CustomerDataStatus, string> = {
  verified: "customer-badge-verified",
  estimated: "customer-badge-estimated",
  unavailable: "customer-badge-unavailable",
};

export function CustomerDataBadge({
  status,
  notice,
  label,
}: {
  status: CustomerDataStatus;
  notice?: string;
  label?: string;
}) {
  return (
    <span className={`customer-data-badge ${CLASS[status]}`} title={notice}>
      {label ?? LABELS[status]}
    </span>
  );
}
