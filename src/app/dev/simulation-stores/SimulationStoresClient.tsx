"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { SimulationStoreRow } from "@/lib/simulation-stores/types";
import type { SimulationAuditReport } from "@/lib/simulation-stores/audit-types";
import type { SimulationExecutiveSummary } from "@/lib/simulation-stores/executive-summary-types";
import { SimulationAuditPanel } from "./SimulationAuditPanel";
import { SimulationExecutiveSummaryPanel } from "./SimulationExecutiveSummaryPanel";
import { SimulationScenarioCard } from "./SimulationScenarioCard";

type Props = {
  initialStores: SimulationStoreRow[];
  showDeveloperTools: boolean;
};

function scrollToSummary(ref: React.RefObject<HTMLDivElement | null>) {
  requestAnimationFrame(() => {
    ref.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  });
}

export function SimulationStoresClient({ initialStores, showDeveloperTools }: Props) {
  const [stores, setStores] = useState<SimulationStoreRow[]>(initialStores);
  const [loading, setLoading] = useState(false);
  const [loadingStoreId, setLoadingStoreId] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastAudit, setLastAudit] = useState<SimulationAuditReport | null>(null);
  const [executiveSummary, setExecutiveSummary] = useState<SimulationExecutiveSummary | null>(null);
  const [summaryByStore, setSummaryByStore] = useState<Record<string, SimulationExecutiveSummary>>({});
  const summaryPanelRef = useRef<HTMLDivElement>(null);

  const uninitializedCount = stores.filter((s) => !s.generatedAt).length;
  const allUninitialized = stores.length > 0 && uninitializedCount === stores.length;

  const load = useCallback(async () => {
    setLoadError(null);
    try {
      const res = await fetch("/api/dev/simulation-stores");
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `Failed to load stores (${res.status})`);
      }
      const data = await res.json();
      if (Array.isArray(data.stores) && data.stores.length > 0) {
        setStores(data.stores);
      }
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "Could not refresh store list");
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const prefetchSummaries = useCallback(async (storeList: SimulationStoreRow[]) => {
    const ready = storeList.filter((s) => s.generatedAt);
    for (const store of ready.slice(0, 8)) {
      try {
        const res = await fetch("/api/dev/simulation-stores", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "get_summary", storeId: store.storeId }),
        });
        const data = await res.json();
        if (res.ok && data.executiveSummary) {
          const summary = data.executiveSummary as SimulationExecutiveSummary;
          setSummaryByStore((prev) => {
            if (prev[store.storeId]) return prev;
            return { ...prev, [store.storeId]: summary };
          });
        }
      } catch {
        /* best-effort prefetch */
      }
    }
  }, []);

  useEffect(() => {
    if (stores.some((s) => s.generatedAt)) {
      void prefetchSummaries(stores);
    }
  }, [stores, prefetchSummaries]);

  function applyExecutiveSummary(summary: SimulationExecutiveSummary) {
    setExecutiveSummary(summary);
    setSummaryByStore((prev) => ({ ...prev, [summary.storeId]: summary }));
    setLastAudit(null);
  }

  async function post(action: string, extra?: Record<string, unknown>) {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/dev/simulation-stores", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ...extra }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Request failed");
      await load();

      if (data.executiveSummary) {
        applyExecutiveSummary(data.executiveSummary as SimulationExecutiveSummary);
      } else if (Array.isArray(data.executiveSummaries) && data.executiveSummaries[0]) {
        applyExecutiveSummary(data.executiveSummaries[0] as SimulationExecutiveSummary);
      } else if (data.executiveSummaryError) {
        setError(`Analysis unavailable: ${data.executiveSummaryError}`);
      }

      return data;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setLoading(false);
      setLoadingStoreId(null);
    }
  }

  async function openDashboard(storeId: string) {
    await post("switch", { storeId });
    window.location.href = "/";
  }

  async function exportStore(storeId: string) {
    const res = await fetch(`/api/dev/simulation-stores?export=${storeId}`);
    const data = await res.json();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `simulation-store-${storeId.slice(-8)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function runAudit(storeId: string) {
    setLoadingStoreId(storeId);
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/dev/simulation-stores", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "run_audit", storeId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Audit failed");
      setLastAudit(data.audit);
      setExecutiveSummary(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Audit failed");
    } finally {
      setLoading(false);
      setLoadingStoreId(null);
    }
  }

  async function viewAnalysis(storeId: string) {
    setLoadingStoreId(storeId);
    const store = stores.find((s) => s.storeId === storeId);
    const cached = summaryByStore[storeId];

    if (cached) {
      applyExecutiveSummary(cached);
      scrollToSummary(summaryPanelRef);
      setLoadingStoreId(null);
      return;
    }

    if (!store?.generatedAt) {
      const data = await post("regenerate", { storeId });
      if (data?.executiveSummary) {
        scrollToSummary(summaryPanelRef);
      }
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/dev/simulation-stores", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "get_summary", storeId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Analysis failed");
      if (data.executiveSummary) {
        applyExecutiveSummary(data.executiveSummary as SimulationExecutiveSummary);
        scrollToSummary(summaryPanelRef);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Analysis failed");
    } finally {
      setLoading(false);
      setLoadingStoreId(null);
    }
  }

  return (
    <div className="sim-lab-layout">
      {loadError ? (
        <div className="card sim-lab-notice sim-lab-notice-warn">
          <p>Could not refresh scenarios. Showing cached list. {loadError}</p>
        </div>
      ) : null}

      {error ? (
        <div className="card sim-lab-notice sim-lab-notice-error">
          <p>{error}</p>
        </div>
      ) : null}

      {allUninitialized ? (
        <div className="card sim-lab-welcome">
          <h3>See StorePilot in action — with simulated data</h3>
          <p>
            These are <strong>not real stores</strong>. Each scenario is generated by the
            StorePilot Simulation Engine so you can see how AI analyzes problems and recommends
            actions — without connecting Shopify or ad accounts.
          </p>
          <button
            type="button"
            className="btn primary"
            disabled={loading}
            onClick={() => post("regenerate_all")}
          >
            Prepare all {stores.length} scenarios
          </button>
        </div>
      ) : null}

      <div className="sim-scenario-grid">
        {stores.map((store) => (
          <SimulationScenarioCard
            key={store.storeId}
            store={store}
            summary={summaryByStore[store.storeId] ?? null}
            loading={loading && loadingStoreId === store.storeId}
            showDeveloperTools={showDeveloperTools}
            onViewAnalysis={() => viewAnalysis(store.storeId)}
            onOpenDashboard={() => openDashboard(store.storeId)}
            onAdvanceTime={(days) => post("advance_time", { storeId: store.storeId, days })}
            onAudit={() => runAudit(store.storeId)}
            onReset={() => post("reset", { storeId: store.storeId })}
            onDeleteData={() => post("delete_data", { storeId: store.storeId })}
            onExport={() => exportStore(store.storeId)}
          />
        ))}
      </div>

      {executiveSummary ? (
        <div ref={summaryPanelRef}>
          <SimulationExecutiveSummaryPanel
            summary={executiveSummary}
            onOpenDashboard={() => openDashboard(executiveSummary.storeId)}
          />
        </div>
      ) : null}

      {showDeveloperTools && lastAudit ? (
        <div className="card sim-lab-dev-panel">
          <SimulationAuditPanel audit={lastAudit} />
        </div>
      ) : null}

      {showDeveloperTools ? (
        <details className="card sim-lab-dev-details">
          <summary>Developer tools</summary>
          <div className="sim-lab-dev-tools">
            {uninitializedCount > 0 && !allUninitialized ? (
              <button
                type="button"
                className="btn"
                disabled={loading}
                onClick={() => post("regenerate_all")}
              >
                Initialize remaining ({uninitializedCount})
              </button>
            ) : null}
            <button type="button" className="btn" disabled={loading} onClick={() => load()}>
              Refresh store list
            </button>
            <button
              type="button"
              className="btn"
              disabled={loading}
              onClick={() => post("run_regression")}
            >
              Run full regression
            </button>
          </div>
        </details>
      ) : null}
    </div>
  );
}
