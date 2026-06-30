import Link from "next/link";
import type { ConnectionCatalogItem, ConnectionCategory } from "@/lib/connections/catalog";
import { CONNECTION_CATEGORY_LABELS } from "@/lib/connections/catalog";

const STATUS_BADGE: Record<ConnectionCatalogItem["status"], { label: string; className: string }> = {
  available: { label: "Available", className: "confidence-high" },
  beta: { label: "Beta", className: "confidence-medium" },
  planned: { label: "Coming soon", className: "confidence-low" },
};

type ConnectionState = {
  connected?: boolean;
  detail?: string;
};

export function ConnectionCategoryGrid({
  byCategory,
  connectionStates = {},
}: {
  byCategory: Record<ConnectionCategory, ConnectionCatalogItem[]>;
  connectionStates?: Record<string, ConnectionState>;
}) {
  const categoryOrder: ConnectionCategory[] = [
    "commerce",
    "marketplaces",
    "advertising",
    "analytics",
    "marketing",
    "finance",
    "business_systems",
  ];

  return (
    <div className="stack" style={{ gap: 28 }}>
      {categoryOrder.map((category) => {
        const items = byCategory[category];
        if (!items?.length) return null;

        return (
          <section key={category}>
            <h3 style={{ marginBottom: 12 }}>{CONNECTION_CATEGORY_LABELS[category]}</h3>
            <div className="grid-2">
              {items.map((item) => {
                const state = connectionStates[item.id];
                const badge = STATUS_BADGE[item.status];
                const isConnected = state?.connected === true;

                return (
                  <div className="card" key={item.id}>
                    <div className="breakdown-row" style={{ marginBottom: 8 }}>
                      <strong>{item.label}</strong>
                      <span
                        className={`confidence-level-pill ${
                          isConnected ? "confidence-high" : badge.className
                        }`}
                      >
                        {isConnected ? "Connected" : badge.label}
                      </span>
                    </div>
                    <p className="muted" style={{ margin: "0 0 10px", fontSize: "0.875rem" }}>
                      {item.description}
                    </p>
                    {state?.detail && (
                      <p style={{ margin: "0 0 10px", fontSize: "0.875rem" }}>
                        <strong>{state.detail}</strong>
                      </p>
                    )}
                    {item.status === "available" && item.connectHref && !isConnected && (
                      <Link href={item.connectHref} className="btn btn-secondary" style={{ fontSize: "0.875rem" }}>
                        Connect
                      </Link>
                    )}
                    {item.status === "planned" && (
                      <p className="muted" style={{ margin: 0, fontSize: "0.8rem" }}>
                        Planned — provider adapter not yet enabled
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}
