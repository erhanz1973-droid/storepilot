"use client";

import { useCallback, useEffect, useState } from "react";
import type { DemoGeneratorAction, DemoMetricsSnapshot } from "@/lib/dev/demo-generator";

type ShopInfo = {
  shopId: string;
  shopDomain: string;
  shopName: string;
  currencyCode: string;
  storeId: string;
};

type ActionResult = {
  action: DemoGeneratorAction;
  inserted?: number;
  refunded?: number;
  customersDeleted?: number;
  ordersDeleted?: number;
  variantsAdjusted?: number;
  lowStockProducts?: number;
  outOfStockProducts?: number;
  metrics: DemoMetricsSnapshot;
};

const ACTIONS: Array<{
  action: DemoGeneratorAction;
  label: string;
  description: string;
  tone?: "danger";
}> = [
  {
    action: "generate-customers",
    label: "Generate Customers",
    description: "Insert 50 demo customers with random names, countries (in email/name), and emails.",
  },
  {
    action: "generate-orders",
    label: "Generate Orders",
    description:
      "Insert 100 paid demo orders using catalog variants, random quantities, discounts, shipping, and dates in the last 90 days.",
  },
  {
    action: "generate-refunds",
    label: "Generate Refunds",
    description: "Refund about 10% of demo orders (partial or full).",
  },
  {
    action: "generate-inventory",
    label: "Generate Inventory Changes",
    description:
      "Reduce stock for sold demo products, set 3 products low stock, and 2 products out of stock.",
  },
  {
    action: "clear",
    label: "Clear Demo Data",
    description: "Delete demo customers/orders and restore inventory snapshot.",
    tone: "danger",
  },
];

export function DemoGeneratorClient() {
  const [shop, setShop] = useState<ShopInfo | null>(null);
  const [metrics, setMetrics] = useState<DemoMetricsSnapshot | null>(null);
  const [busyAction, setBusyAction] = useState<DemoGeneratorAction | null>(null);
  const [lastResult, setLastResult] = useState<ActionResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadStatus = useCallback(async () => {
    setError(null);
    const res = await fetch("/api/dev/demo-generator");
    const data = await res.json();
    if (!res.ok || !data.ok) {
      setError(data.error ?? "Failed to load shop context");
      return;
    }
    setShop(data.shop as ShopInfo);
    setMetrics(data.metrics as DemoMetricsSnapshot);
  }, []);

  useEffect(() => {
    void loadStatus();
  }, [loadStatus]);

  async function runAction(action: DemoGeneratorAction) {
    setBusyAction(action);
    setError(null);
    try {
      const res = await fetch("/api/dev/demo-generator", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error ?? "Action failed");
      }
      setLastResult(data as ActionResult);
      setMetrics(data.metrics as DemoMetricsSnapshot);
      await loadStatus();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Action failed");
    } finally {
      setBusyAction(null);
    }
  }

  return (
    <div className="demo-generator">
      <div className="card" style={{ marginBottom: 16 }}>
        <h3 style={{ marginTop: 0 }}>Shop context</h3>
        {shop ? (
          <ul className="muted" style={{ margin: 0, paddingLeft: 18 }}>
            <li>
              <strong>{shop.shopName}</strong> ({shop.shopDomain})
            </li>
            <li>Shop ID: {shop.shopId}</li>
            <li>Store ID: {shop.storeId}</li>
            <li>Currency: {shop.currencyCode}</li>
          </ul>
        ) : (
          <p className="muted" style={{ margin: 0 }}>
            {error ?? "Loading shop context…"}
          </p>
        )}
      </div>

      {metrics ? (
        <div className="card" style={{ marginBottom: 16 }}>
          <h3 style={{ marginTop: 0 }}>Dashboard metrics (refreshed)</h3>
          <div className="demo-generator-metrics">
            <Metric label="Customers" value={metrics.customers} sub={`${metrics.demoCustomers} demo`} />
            <Metric label="Orders" value={metrics.orders} sub={`${metrics.demoOrders} demo`} />
            <Metric label="Products" value={metrics.products} />
            <Metric label="30d revenue" value={`$${metrics.revenue30d.toLocaleString()}`} />
            <Metric label="30d orders" value={metrics.orders30d} />
            <Metric label="Low stock" value={metrics.lowStockProducts} />
            <Metric label="Variants w/ cost" value={metrics.variantsWithCost} />
          </div>
          <p className="muted" style={{ marginBottom: 0, fontSize: "0.85rem" }}>
            Last refresh: {new Date(metrics.refreshedAt).toLocaleString()}
          </p>
        </div>
      ) : null}

      <div className="demo-generator-actions">
        {ACTIONS.map((item) => (
          <div key={item.action} className="card demo-generator-action-card">
            <h4 style={{ marginTop: 0 }}>{item.label}</h4>
            <p className="muted" style={{ minHeight: 48 }}>
              {item.description}
            </p>
            <button
              type="button"
              className={item.tone === "danger" ? "btn btn-danger-ghost" : "btn btn-primary"}
              disabled={Boolean(busyAction) || !shop}
              onClick={() => void runAction(item.action)}
            >
              {busyAction === item.action ? "Working…" : item.label}
            </button>
          </div>
        ))}
      </div>

      {lastResult ? (
        <div className="card" style={{ marginTop: 16 }}>
          <h3 style={{ marginTop: 0 }}>Last action result</h3>
          <pre style={{ margin: 0, whiteSpace: "pre-wrap" }}>{JSON.stringify(lastResult, null, 2)}</pre>
        </div>
      ) : null}

      {error ? (
        <div className="card" style={{ marginTop: 16, borderColor: "var(--critical)" }}>
          <p style={{ margin: 0 }}>{error}</p>
        </div>
      ) : null}

      <style jsx>{`
        .demo-generator-actions {
          display: grid;
          gap: 16px;
          grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
        }
        .demo-generator-metrics {
          display: grid;
          gap: 12px;
          grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
          margin-bottom: 12px;
        }
      `}</style>
    </div>
  );
}

function Metric({
  label,
  value,
  sub,
}: {
  label: string;
  value: string | number;
  sub?: string;
}) {
  return (
    <div>
      <div className="muted" style={{ fontSize: "0.8rem" }}>
        {label}
      </div>
      <div style={{ fontSize: "1.25rem", fontWeight: 600 }}>{value}</div>
      {sub ? (
        <div className="muted" style={{ fontSize: "0.75rem" }}>
          {sub}
        </div>
      ) : null}
    </div>
  );
}
