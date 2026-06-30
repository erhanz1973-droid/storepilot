import { cookies } from "next/headers";
import { isDevValidationEnabled } from "@/lib/validation/dev-gate";
import { ACTIVE_STORE_COOKIE } from "@/lib/store/context";
import { listSimulationStores } from "@/lib/simulation-stores/db";
import {
  regenerateSimulationStore,
  seedSimulationScenario,
  regenerateAllSimulationStores,
} from "@/lib/simulation-stores/regenerate";
import { advanceSimulationTime } from "@/lib/simulation-stores/time-travel";
import { clearSimulationStoreData } from "@/lib/simulation-stores/persist";
import { exportSimulationStore } from "@/lib/simulation-stores/export";
import { SIMULATION_SEED_LIBRARY } from "@/lib/simulation-stores/seeds";
import { auditSimulationStore } from "@/lib/simulation-stores/audit";
import { buildSimulationExecutiveSummary } from "@/lib/simulation-stores/executive-summary";
import { buildDashboard } from "@/lib/services/dashboard";
import { getVerifiedStoreData } from "@/lib/recommendations/validation";
import { runSimulationRegressionSuite } from "@/lib/simulation-lab/regression";
import { generateSimulationDataset, runSimulationPipeline } from "@/lib/simulation-lab/runner";
import { loadSimulationSnapshot } from "@/lib/simulation-stores/load";
import type { SimulationScenarioId } from "@/lib/simulation-lab/types";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

function devOnly() {
  if (!isDevValidationEnabled()) {
    return NextResponse.json({ error: "Simulation stores are development-only" }, { status: 404 });
  }
  return null;
}

export async function GET(req: Request) {
  const blocked = devOnly();
  if (blocked) return blocked;

  const url = new URL(req.url);
  const exportStoreId = url.searchParams.get("export");

  if (exportStoreId) {
    const payload = await exportSimulationStore(exportStoreId);
    return NextResponse.json(payload);
  }

  const stores = await listSimulationStores();
  return NextResponse.json({
    stores,
    seeds: SIMULATION_SEED_LIBRARY,
  });
}

type StoreAction =
  | "regenerate"
  | "regenerate_all"
  | "seed"
  | "advance_time"
  | "reset"
  | "delete_data"
  | "switch"
  | "run_audit"
  | "get_summary"
  | "run_decision_engine"
  | "run_validation"
  | "run_regression";

export async function POST(req: Request) {
  const blocked = devOnly();
  if (blocked) return blocked;

  const body = (await req.json()) as {
    action: StoreAction;
    storeId?: string;
    slug?: string;
    scenarioId?: SimulationScenarioId;
    days?: number;
  };

  const { action, storeId, slug, scenarioId, days } = body;

  async function attachExecutiveSummary(storeId: string) {
    try {
      const executiveSummary = await buildSimulationExecutiveSummary(storeId);
      return { executiveSummary };
    } catch (err) {
      return {
        executiveSummaryError:
          err instanceof Error ? err.message : "Executive summary unavailable",
      };
    }
  }

  if (action === "regenerate") {
    const result = await regenerateSimulationStore({ storeId, slug, scenarioId });
    return NextResponse.json({ result, ...(await attachExecutiveSummary(result.storeId)) });
  }

  if (action === "regenerate_all") {
    const results = await regenerateAllSimulationStores();
    const summaries = await Promise.all(
      results.map(async (r) => {
        try {
          return await buildSimulationExecutiveSummary(r.storeId);
        } catch {
          return null;
        }
      }),
    );
    return NextResponse.json({ results, count: results.length, executiveSummaries: summaries.filter(Boolean) });
  }

  if (action === "seed") {
    if (!scenarioId) {
      return NextResponse.json({ error: "scenarioId required" }, { status: 400 });
    }
    const result = await seedSimulationScenario(scenarioId, storeId);
    return NextResponse.json({ result, ...(await attachExecutiveSummary(result.storeId)) });
  }

  if (action === "advance_time") {
    if (!storeId) {
      return NextResponse.json({ error: "storeId required" }, { status: 400 });
    }
    const advanceDays = days ?? 7;
    const result = await advanceSimulationTime(storeId, advanceDays);
    return NextResponse.json({ result, ...(await attachExecutiveSummary(storeId)) });
  }

  if (action === "reset" || action === "delete_data") {
    if (!storeId) {
      return NextResponse.json({ error: "storeId required" }, { status: 400 });
    }
    if (action === "delete_data") {
      await clearSimulationStoreData(storeId);
      return NextResponse.json({ ok: true });
    }
    const stores = await listSimulationStores();
    const store = stores.find((s) => s.storeId === storeId);
    if (!store) {
      return NextResponse.json({ error: "Store not found" }, { status: 404 });
    }
    const result = await regenerateSimulationStore({
      storeId,
      scenarioId: store.scenarioId,
      businessModel: store.businessModel,
    });
    return NextResponse.json({ result, ...(await attachExecutiveSummary(result.storeId)) });
  }

  if (action === "switch") {
    if (!storeId) {
      return NextResponse.json({ error: "storeId required" }, { status: 400 });
    }
    const cookieStore = await cookies();
    cookieStore.set(ACTIVE_STORE_COOKIE, storeId, {
      path: "/",
      httpOnly: true,
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 30,
    });
    return NextResponse.json({ ok: true, storeId, redirect: "/" });
  }

  if (action === "run_audit") {
    if (!storeId) {
      return NextResponse.json({ error: "storeId required" }, { status: 400 });
    }
    const audit = await auditSimulationStore(storeId);
    return NextResponse.json({ audit });
  }

  if (action === "get_summary") {
    if (!storeId) {
      return NextResponse.json({ error: "storeId required" }, { status: 400 });
    }
    return NextResponse.json(await attachExecutiveSummary(storeId));
  }

  if (action === "run_validation") {
    if (!storeId) {
      return NextResponse.json({ error: "storeId required" }, { status: 400 });
    }
    const verified = await getVerifiedStoreData(storeId);
    return NextResponse.json({
      gate: verified.gate,
      productCount: verified.snapshot.products.length,
      campaignCount: verified.snapshot.campaigns.length,
    });
  }

  if (action === "run_decision_engine") {
    if (!storeId) {
      return NextResponse.json({ error: "storeId required" }, { status: 400 });
    }
    const snapshot = await loadSimulationSnapshot(storeId);
    if (!snapshot) {
      return NextResponse.json({ error: "No persisted data — regenerate first" }, { status: 422 });
    }
    const stores = await listSimulationStores();
    const store = stores.find((s) => s.storeId === storeId);
    const record = generateSimulationDataset({
      scenarioId: store?.scenarioId ?? "healthy_store",
      businessModel: store?.businessModel,
    });
    record.storeId = storeId;
    record.snapshot = snapshot;
    const pipeline = await runSimulationPipeline(record);
    const dashboard = await buildDashboard(storeId);
    return NextResponse.json({
      pipeline: {
        verdict: pipeline.verdict,
        decisionCount: pipeline.decisions.length,
        passCount: pipeline.passCount,
        failCount: pipeline.failCount,
      },
      dashboard: {
        healthScore: dashboard.storeHealth?.score,
        decisionCount: dashboard.decisionCenter?.length ?? 0,
        recommendationCount: dashboard.revenueOpportunities?.length ?? 0,
      },
    });
  }

  if (action === "run_regression") {
    const report = await runSimulationRegressionSuite();
    return NextResponse.json({ report });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
