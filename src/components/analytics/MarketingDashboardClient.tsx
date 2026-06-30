"use client";

import { useMemo, useState } from "react";
import type { MarketingCampaignRow } from "@/lib/analytics/types";
import type { TableColumn } from "@/lib/analytics/types";
import { AnalyticsTabs } from "./AnalyticsTabs";
import { DataTable } from "./DataTable";
import { filterMarketingByChannel } from "@/lib/analytics/marketing";

const TABS = [
  { id: "meta", label: "Meta Ads" },
  { id: "google", label: "Google Ads" },
  { id: "tiktok", label: "TikTok" },
  { id: "pinterest", label: "Pinterest" },
] as const;

const COLUMNS: TableColumn<MarketingCampaignRow>[] = [
  { id: "campaign", header: "Campaign", accessor: (r) => r.campaign },
  { id: "status", header: "Status", accessor: (r) => r.status },
  { id: "spend", header: "Spend", accessor: (r) => r.spend, format: "currency", align: "right" },
  { id: "impressions", header: "Impressions", accessor: (r) => r.impressions, format: "number", align: "right" },
  { id: "reach", header: "Reach", accessor: (r) => r.reach, format: "number", align: "right" },
  { id: "clicks", header: "Clicks", accessor: (r) => r.clicks, format: "number", align: "right" },
  { id: "ctr", header: "CTR", accessor: (r) => r.ctr, format: "percent", align: "right" },
  { id: "cpc", header: "CPC", accessor: (r) => r.cpc, format: "currency", align: "right" },
  { id: "cpm", header: "CPM", accessor: (r) => r.cpm, format: "currency", align: "right" },
  { id: "purchases", header: "Purchases", accessor: (r) => r.purchases, format: "number", align: "right" },
  { id: "cpa", header: "CPA", accessor: (r) => r.cpa, format: "currency", align: "right" },
  { id: "revenue", header: "Revenue", accessor: (r) => r.revenue, format: "currency", align: "right" },
  { id: "roas", header: "ROAS", accessor: (r) => r.roas, format: "ratio", align: "right" },
  { id: "profit", header: "Profit", accessor: (r) => (r.profitEstimated ? "—" : r.profit), format: "currency", align: "right" },
  { id: "margin", header: "Margin", accessor: (r) => (r.profitEstimated ? "—" : r.margin), format: "percent", align: "right" },
];

export function MarketingDashboardClient({ campaigns }: { campaigns: MarketingCampaignRow[] }) {
  const [tab, setTab] = useState<string>("meta");

  const rows = useMemo(
    () => filterMarketingByChannel(campaigns, tab as "meta" | "google" | "tiktok" | "pinterest"),
    [campaigns, tab],
  );

  return (
    <>
      <AnalyticsTabs tabs={[...TABS]} active={tab} onChange={setTab} />
      {rows.length === 0 ? (
        <div className="card">
          <p className="muted" style={{ margin: 0 }}>
            No {TABS.find((t) => t.id === tab)?.label} campaigns synced. Connect the channel in Settings → Connections.
          </p>
        </div>
      ) : (
        <DataTable
          title={`${TABS.find((t) => t.id === tab)?.label} Campaigns`}
          rows={rows}
          columns={COLUMNS}
          exportFilename={`marketing-${tab}`}
          searchPlaceholder="Search campaigns…"
        />
      )}
    </>
  );
}
