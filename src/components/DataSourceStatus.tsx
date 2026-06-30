import type { DataSourceStatus as DataSourceStatusType } from "@/lib/types";

export function DataSourceStatus({ sources }: { sources: DataSourceStatusType[] }) {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
      {sources.map((source) => (
        <span key={source.id} className="source-pill">
          <span className={`source-dot ${source.status}`} />
          {source.label}
          {source.status === "demo" && " (demo)"}
        </span>
      ))}
    </div>
  );
}
