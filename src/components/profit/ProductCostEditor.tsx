"use client";

import { useState } from "react";
import type { ProfitDashboard } from "@/lib/profit/types";

export function ProductCostEditor({
  products,
}: {
  products: { productId: string; title: string; unitCost: number | null; costSource: string }[];
}) {
  const [saving, setSaving] = useState<string | null>(null);
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      products.map((p) => [p.productId, p.unitCost != null ? String(p.unitCost) : ""]),
    ),
  );

  async function save(productId: string) {
    const unitCost = parseFloat(values[productId] ?? "0");
    if (Number.isNaN(unitCost) || unitCost < 0) return;
    setSaving(productId);
    try {
      await fetch("/api/product-costs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ shopifyProductId: productId, unitCost }),
      });
    } finally {
      setSaving(null);
    }
  }

  const estimated = products.filter((p) => p.costSource === "estimated");

  if (estimated.length === 0) return null;

  return (
    <div className="card" style={{ marginBottom: 16 }}>
      <h3>Product Costs</h3>
      <p className="muted" style={{ margin: "0 0 12px", fontSize: "0.9rem" }}>
        {estimated.length} product{estimated.length === 1 ? "" : "s"} use estimated costs.
        Add real COGS for accurate net profit.
      </p>
      <div className="stack">
        {estimated.slice(0, 6).map((p) => (
          <div key={p.productId} className="product-cost-row">
            <span style={{ flex: 1, fontSize: "0.9rem" }}>{p.title}</span>
            <input
              type="number"
              min={0}
              step={0.01}
              className="shop-input product-cost-input"
              placeholder="Enter cost"
              value={values[p.productId]}
              onChange={(e) =>
                setValues((v) => ({ ...v, [p.productId]: e.target.value }))
              }
            />
            <button
              type="button"
              className="btn btn-ghost"
              disabled={saving === p.productId}
              onClick={() => save(p.productId)}
            >
              {saving === p.productId ? "…" : "Save"}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

export function ProfitAssumptionsNote({ dashboard }: { dashboard: ProfitDashboard }) {
  const a = dashboard.assumptions;
  return (
    <p className="muted profit-assumptions" style={{ fontSize: "0.8rem", margin: 0 }}>
      Estimates: transaction fees {(a.transactionFeeRate * 100).toFixed(1)}% + $
      {a.transactionFeeFixed.toFixed(2)}/order
      {a.adSpendScaled && " · Meta ad spend scaled from 7-day data"}
      {a.productsWithEstimatedCost > 0 &&
        ` · ${a.productsWithEstimatedCost} products with estimated COGS`}
    </p>
  );
}
