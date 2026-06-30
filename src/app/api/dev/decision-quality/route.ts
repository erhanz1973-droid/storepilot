import { isDevValidationEnabled } from "@/lib/validation/dev-gate";
import {
  runQualitySimulation,
  runLargeRegressionSuite,
  runReplayQuality,
  approveDriftBaseline,
  getDriftBaseline,
  listQualityBenchmarks,
  getLatestQualityLabReport,
  getLastEnrichedRun,
  listMemoryQualityRuns,
  listMemoryIntentEvaluations,
} from "@/lib/decision-quality-lab";
import type { BusinessModel } from "@/lib/business-model/types";
import type { SimulationScenarioId } from "@/lib/simulation-lab/types";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

function devOnly() {
  if (!isDevValidationEnabled()) {
    return NextResponse.json({ error: "Decision Quality Lab is development-only" }, { status: 404 });
  }
  return null;
}

export async function GET() {
  const blocked = devOnly();
  if (blocked) return blocked;

  return NextResponse.json({
    report: getLatestQualityLabReport(),
    benchmarks: listQualityBenchmarks(),
    recentRuns: listMemoryQualityRuns(30),
    intentEvaluations: listMemoryIntentEvaluations(20),
  });
}

export async function POST(req: Request) {
  const blocked = devOnly();
  if (blocked) return blocked;

  const body = (await req.json()) as {
    action:
      | "run"
      | "regression"
      | "replay"
      | "approve_baseline"
      | "monte_carlo";
    scenarioId?: SimulationScenarioId;
    businessModel?: BusinessModel;
    days?: number;
    randomStoreCount?: number;
    releaseVersion?: string;
  };

  if (body.action === "run") {
    const result = await runQualitySimulation({
      scenarioId: body.scenarioId ?? "dead_inventory",
      businessModel: body.businessModel,
    });
    return NextResponse.json({ result });
  }

  if (body.action === "regression") {
    const report = await runLargeRegressionSuite({
      randomStoreCount: body.randomStoreCount ?? 10,
      releaseVersion: body.releaseVersion,
    });
    return NextResponse.json({ report });
  }

  if (body.action === "replay") {
    const results = await runReplayQuality({
      scenarioId: body.scenarioId ?? "dead_inventory",
      businessModel: body.businessModel ?? "own_inventory",
      days: body.days ?? 14,
    });
    return NextResponse.json({ results: results.map((r) => r.summary) });
  }

  if (body.action === "approve_baseline") {
    const enriched = getLastEnrichedRun();
    if (!enriched?.scenarioId || !enriched.businessModel) {
      return NextResponse.json({ error: "No recent run to baseline" }, { status: 400 });
    }
    approveDriftBaseline({
      scenarioId: enriched.scenarioId,
      businessModel: enriched.businessModel,
      decisions: enriched.qualityRecords.map((q) => q.decision),
      releaseVersion: body.releaseVersion,
    });
    return NextResponse.json({
      baseline: getDriftBaseline(enriched.scenarioId, enriched.businessModel),
    });
  }

  if (body.action === "monte_carlo") {
    const report = await runLargeRegressionSuite({
      randomStoreCount: body.randomStoreCount ?? 100,
      businessModels: body.businessModel ? [body.businessModel] : undefined,
    });
    return NextResponse.json({ report });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
