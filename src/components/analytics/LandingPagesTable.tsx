"use client";

import { DataTable } from "@/components/analytics/DataTable";
import type { TableColumn } from "@/lib/analytics/types";

export type LandingPageRow = {
  id: string;
  path: string;
  sessions: number;
  revenue: number;
};

const COLUMNS: TableColumn<LandingPageRow>[] = [
  { id: "path", header: "Page", accessor: (r) => r.path },
  { id: "sessions", header: "Sessions", accessor: (r) => r.sessions, format: "number", align: "right" },
  { id: "revenue", header: "Revenue", accessor: (r) => r.revenue, format: "currency", align: "right" },
];

type Props = {
  rows: LandingPageRow[];
};

export function LandingPagesTable({ rows }: Props) {
  return (
    <DataTable
      title="Top Landing Pages"
      rows={rows}
      columns={COLUMNS}
      exportFilename="landing-pages"
    />
  );
}
