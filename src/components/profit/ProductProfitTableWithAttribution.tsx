"use client";

import type { EnrichedProductProfitRow } from "@/lib/profit/profit-page-view";
import type { ProductAttributionDashboard } from "@/lib/attribution/product-types";
import { ProductAttributionDetailDrawer } from "@/components/profit/ProductAttributionDetailDrawer";
import { ProductProfitTableSortable } from "@/components/profit/ProductProfitTableSortable";
import { useState } from "react";

export function ProductProfitTableWithAttribution({
  rows,
  attribution,
  title,
}: {
  rows: EnrichedProductProfitRow[];
  attribution: ProductAttributionDashboard | null;
  title?: string;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = selectedId ? attribution?.byProductId[selectedId] ?? null : null;

  return (
    <>
      <ProductProfitTableSortable
        rows={rows}
        title={title}
        onSelectProduct={attribution ? (id) => setSelectedId(id) : undefined}
      />
      <ProductAttributionDetailDrawer
        product={selected}
        open={selectedId != null}
        onClose={() => setSelectedId(null)}
      />
    </>
  );
}
