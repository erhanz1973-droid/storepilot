"use client";

import { InventoryAiInsights, InventoryOpportunitiesSection } from "@/components/inventory/InventoryOpportunitiesSection";
import { InventoryDetailDrawer, InventoryRiskTable } from "@/components/inventory/InventoryRiskTable";
import { InventoryExecutiveSummaryCard } from "@/components/inventory/InventoryExecutiveSummaryCard";
import { InventoryHealthScorePanel } from "@/components/inventory/InventoryHealthScorePanel";
import { InventorySegmentCards } from "@/components/inventory/InventorySegmentCards";
import type { InventoryPageView, InventorySkuRow } from "@/lib/inventory/types";
import Link from "next/link";
import { useState } from "react";

export function InventoryPageClient({ view }: { view: InventoryPageView }) {
  const [drawerRow, setDrawerRow] = useState<InventorySkuRow | null>(null);

  return (
    <div className="inventory-page">
      <InventoryExecutiveSummaryCard
        summary={view.executiveSummary}
        limitedInventoryNotice={view.limitedInventoryNotice}
      />
      <InventoryHealthScorePanel breakdown={view.healthBreakdown} />
      <InventorySegmentCards segments={view.segments} />
      <InventoryAiInsights insights={view.aiInsights} />
      <InventoryOpportunitiesSection
        opportunities={view.opportunities}
        recoveryPotential={view.recoveryPotential}
        allHealthy={view.allHealthy}
      />
      <InventoryRiskTable rows={view.riskTable} onSelect={setDrawerRow} />
      <p className="muted">
        <Link href="/commerce/inventory">Full inventory table →</Link>
      </p>
      <InventoryDetailDrawer
        row={drawerRow}
        open={drawerRow != null}
        onClose={() => setDrawerRow(null)}
      />
    </div>
  );
}
