"use client";

import { useMemo, useState } from "react";
import type { TableColumn } from "@/lib/analytics/types";

function formatCell(value: string | number, format?: TableColumn<unknown>["format"]): string {
  if (typeof value === "string") return value;
  switch (format) {
    case "currency":
      return `$${value.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
    case "percent":
      return `${value.toFixed(2)}%`;
    case "ratio":
      return value.toFixed(2);
    case "number":
      return value.toLocaleString();
    default:
      return String(value);
  }
}

type Props<T> = {
  title?: string;
  rows: T[];
  columns: TableColumn<T>[];
  pageSize?: number;
  exportFilename?: string;
  searchPlaceholder?: string;
};

export function DataTable<T extends { id?: string }>({
  title,
  rows,
  columns,
  pageSize = 10,
  exportFilename = "export",
  searchPlaceholder = "Search…",
}: Props<T>) {
  const [search, setSearch] = useState("");
  const [sortCol, setSortCol] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(0);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = rows;
    if (q) {
      list = rows.filter((row) =>
        columns.some((col) => String(col.accessor(row)).toLowerCase().includes(q)),
      );
    }
    if (sortCol) {
      const col = columns.find((c) => c.id === sortCol);
      if (col) {
        list = [...list].sort((a, b) => {
          const av = col.accessor(a);
          const bv = col.accessor(b);
          if (typeof av === "number" && typeof bv === "number") {
            return sortDir === "asc" ? av - bv : bv - av;
          }
          return sortDir === "asc"
            ? String(av).localeCompare(String(bv))
            : String(bv).localeCompare(String(av));
        });
      }
    }
    return list;
  }, [rows, columns, search, sortCol, sortDir]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const pageRows = filtered.slice(page * pageSize, (page + 1) * pageSize);

  function toggleSort(id: string) {
    if (sortCol === id) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortCol(id);
      setSortDir("desc");
    }
  }

  function exportCsv() {
    const header = columns.map((c) => c.header).join(",");
    const body = filtered
      .map((row) =>
        columns
          .map((c) => {
            const v = c.accessor(row);
            const s = String(v).replace(/"/g, '""');
            return `"${s}"`;
          })
          .join(","),
      )
      .join("\n");
    const blob = new Blob([`${header}\n${body}`], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${exportFilename}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="analytics-table-wrap card">
      {title && <h3 className="analytics-table-title">{title}</h3>}
      <div className="analytics-table-toolbar">
        <input
          type="search"
          className="analytics-table-search"
          placeholder={searchPlaceholder}
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(0);
          }}
        />
        <button type="button" className="btn btn-ghost" onClick={exportCsv}>
          Export CSV
        </button>
      </div>
      <div className="analytics-table-scroll">
        <table className="analytics-table">
          <thead>
            <tr>
              {columns.map((col) => (
                <th
                  key={col.id}
                  className={col.align === "right" ? "align-right" : ""}
                  style={{ cursor: col.sortable !== false ? "pointer" : "default" }}
                  onClick={() => col.sortable !== false && toggleSort(col.id)}
                >
                  {col.header}
                  {sortCol === col.id && (sortDir === "asc" ? " ↑" : " ↓")}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {pageRows.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="muted">
                  No rows match your search.
                </td>
              </tr>
            ) : (
              pageRows.map((row, i) => (
                <tr key={(row as { id?: string }).id ?? i}>
                  {columns.map((col) => (
                    <td
                      key={col.id}
                      className={col.align === "right" ? "align-right" : ""}
                    >
                      {formatCell(col.accessor(row), col.format)}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <div className="analytics-table-footer">
        <span className="muted">
          {filtered.length} row{filtered.length !== 1 ? "s" : ""}
        </span>
        <div className="analytics-table-pagination">
          <button
            type="button"
            className="btn btn-ghost"
            disabled={page === 0}
            onClick={() => setPage((p) => p - 1)}
          >
            Previous
          </button>
          <span className="muted">
            Page {page + 1} of {totalPages}
          </span>
          <button
            type="button"
            className="btn btn-ghost"
            disabled={page >= totalPages - 1}
            onClick={() => setPage((p) => p + 1)}
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}
