import { isDevValidationEnabled } from "@/lib/validation/dev-gate";
import {
  SIMULATION_SCENARIOS,
  generateSimulationDataset,
  runFullSimulation,
  runSimulationRegressionSuite,
  clearSimulationCache,
  cacheSimulationRecord,
  setLastSimulationRun,
  getLastSimulationRun,
  getLastRegressionReport,
  setLastRegressionReport,
  listCachedStores,
  exportSimulationJson,
  exportSimulationCsv,
  exportSimulationHtml,
  customInputFromPartial,
} from "@/lib/simulation-lab";
import type { CustomScenarioInput, SimulationScenarioId } from "@/lib/simulation-lab/types";
import type { BusinessModel } from "@/lib/business-model/types";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

function devOnly() {
  if (!isDevValidationEnabled()) {
    return NextResponse.json({ error: "Simulation Lab is development-only" }, { status: 404 });
  }
  return null;
}

export async function GET(req: Request) {
  const blocked = devOnly();
  if (blocked) return blocked;

  const url = new URL(req.url);
  const format = url.searchParams.get("format");
  const runId = url.searchParams.get("runId");

  if (format) {
    const last = getLastSimulationRun();
    const regression = getLastRegressionReport();
    const payload = runId && regression?.results.find((r) => r.runId === runId)
      ? regression.results.find((r) => r.runId === runId)!
      : last;
    if (!payload) {
      return NextResponse.json({ error: "No simulation results to export" }, { status: 404 });
    }
    if (format === "json") {
      return new NextResponse(exportSimulationJson(payload), {
        headers: { "Content-Type": "application/json" },
      });
    }
    if (format === "csv" && !("results" in payload)) {
      return new NextResponse(exportSimulationCsv(payload), {
        headers: { "Content-Type": "text/csv" },
      });
    }
    if (format === "html") {
      return new NextResponse(exportSimulationHtml(payload), {
        headers: { "Content-Type": "text/html" },
      });
    }
    return NextResponse.json({ error: "Invalid format" }, { status: 400 });
  }

  return NextResponse.json({
    scenarios: SIMULATION_SCENARIOS.map((s) => ({
      id: s.id,
      label: s.label,
      description: s.description,
      defaultBusinessModel: s.defaultBusinessModel,
      expectedCount: s.expectedDecisions.length,
    })),
    cachedStores: listCachedStores().map((s) => ({
      storeId: s.storeId,
      scenarioId: s.scenarioId,
      businessModel: s.businessModel,
      generatedAt: s.generatedAt,
    })),
    lastRun: getLastSimulationRun(),
    lastRegression: getLastRegressionReport(),
  });
}

type SimulationAction =
  | "generate"
  | "run"
  | "validate"
  | "regression"
  | "clear";

export async function POST(req: Request) {
  const blocked = devOnly();
  if (blocked) return blocked;

  const body = (await req.json()) as {
    action: SimulationAction;
    scenarioId?: SimulationScenarioId;
    businessModel?: BusinessModel;
    customParams?: Record<string, unknown>;
    customInput?: Partial<CustomScenarioInput> & { businessModel: BusinessModel };
  };

  const scenarioId = body.scenarioId ?? "healthy_store";
  const businessModel = body.businessModel;

  if (body.action === "clear") {
    clearSimulationCache();
    return NextResponse.json({ ok: true });
  }

  if (body.action === "generate") {
    const customInput =
      scenarioId === "custom" && body.customInput
        ? customInputFromPartial(body.customInput)
        : undefined;
    const record = generateSimulationDataset({
      scenarioId,
      businessModel,
      customParams: body.customParams as never,
      customInput,
    });
    cacheSimulationRecord(record);
    return NextResponse.json({ record: { ...record, snapshot: undefined, gate: record.gate } });
  }

  if (body.action === "run" || body.action === "validate") {
    const customInput =
      scenarioId === "custom" && body.customInput
        ? customInputFromPartial(body.customInput)
        : undefined;
    const result = await runFullSimulation({
      scenarioId,
      businessModel,
      customParams: body.customParams as never,
      customInput,
    });
    setLastSimulationRun(result);
    return NextResponse.json({ result });
  }

  if (body.action === "regression") {
    const report = await runSimulationRegressionSuite();
    setLastRegressionReport(report);
    return NextResponse.json({ report });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
