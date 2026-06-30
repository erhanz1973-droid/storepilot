import { computeProfitDashboard } from "@/lib/profit/engine";
import { computeBlendedRoasDashboard } from "@/lib/profit/roas";
import { buildAttributionDashboard } from "@/lib/attribution/engine";
import {
  ORDER_SCALE_TARGETS,
  buildScaledStoreSnapshot,
  MANUAL_PROFIT_FIXTURES,
} from "./fixtures/orders";
import { compareProfitValues, manualNetProfit } from "./profit";
import { compareRoas, manualRoas } from "./roas";
import type { PerformanceBenchmark, ValidationCheck } from "./types";

const PERF_BUDGET_MS = {
  profitEngine: 500,
  roasEngine: 300,
  attributionEngine: 800,
  snapshot: 2000,
};

function memoryEstimateMb(): number {
  if (typeof process !== "undefined" && process.memoryUsage) {
    return Math.round((process.memoryUsage().heapUsed / 1024 / 1024) * 10) / 10;
  }
  return 0;
}

function operationalCostsFromTotal(total: number) {
  const support = Math.round(total * 0.35);
  const warehouse = total - support;
  return { supportCost30d: support, warehouseCost30d: warehouse, packingCost30d: 0 };
}

export function validateProfitEngine(): ValidationCheck[] {
  const checks: ValidationCheck[] = [];

  for (const fixture of MANUAL_PROFIT_FIXTURES) {
    const bucket = fixture.rollups.last30d;
    const ops = operationalCostsFromTotal(fixture.operationalCost30d);

    const snapshot = buildScaledStoreSnapshot(bucket.orders);
    snapshot.profitRollups = fixture.rollups;
    if (snapshot.adSpendSnapshot) {
      snapshot.adSpendSnapshot.totalRollups.last30d.spend = fixture.adSpend30d;
    }
    snapshot.operationalCosts = {
      shippingCost30d: 0,
      ...ops,
      actualCogs30d: null,
      sources: ["validation"],
    };

    const expected = manualNetProfit(
      bucket,
      fixture.adSpend30d,
      ops.supportCost30d + ops.warehouseCost30d + ops.packingCost30d,
    );

    const dashboard = computeProfitDashboard(snapshot, []);
    const actual = dashboard?.primary.netProfit ?? 0;

    checks.push(compareProfitValues(fixture.label, expected, actual, 0));
  }

  return checks;
}

export function validateRoasEngine(): ValidationCheck[] {
  const snapshot = buildScaledStoreSnapshot(612);
  const roas = computeBlendedRoasDashboard(snapshot);
  if (!roas) {
    return [
      {
        id: "roas-unavailable",
        suite: "roas",
        name: "Blended ROAS dashboard",
        status: "fail",
        message: "Could not compute Blended ROAS dashboard",
      },
    ];
  }

  const checks: ValidationCheck[] = [];
  for (const period of roas.periods) {
    const expected = manualRoas(period.revenue, period.adSpend);
    checks.push(compareRoas(period.window, expected, period.roas));
  }

  return checks;
}

export function runPerformanceBenchmarks(): {
  benchmarks: PerformanceBenchmark[];
  checks: ValidationCheck[];
} {
  const benchmarks: PerformanceBenchmark[] = [];
  const checks: ValidationCheck[] = [];

  for (const orderCount of ORDER_SCALE_TARGETS) {
    const t0 = performance.now();
    const snapshot = buildScaledStoreSnapshot(orderCount);
    const snapshotMs = Math.round(performance.now() - t0);

    const t1 = performance.now();
    const profit = computeProfitDashboard(snapshot, []);
    const profitMs = Math.round(performance.now() - t1);

    const t2 = performance.now();
    computeBlendedRoasDashboard(snapshot);
    const roasMs = Math.round(performance.now() - t2);

    const t3 = performance.now();
    buildAttributionDashboard(snapshot, profit);
    const attrMs = Math.round(performance.now() - t3);

    const memMb = memoryEstimateMb();

    benchmarks.push({
      orderCount,
      syncTimeMs: snapshotMs,
      snapshotTimeMs: snapshotMs,
      profitEngineMs: profitMs,
      roasEngineMs: roasMs,
      attributionEngineMs: attrMs,
      memoryEstimateMb: memMb,
    });

    const pass =
      profitMs <= PERF_BUDGET_MS.profitEngine &&
      roasMs <= PERF_BUDGET_MS.roasEngine &&
      attrMs <= PERF_BUDGET_MS.attributionEngine;

    checks.push({
      id: `perf-${orderCount}-orders`,
      suite: "performance",
      name: `${orderCount.toLocaleString()} orders — engine timing`,
      status: pass ? "pass" : "warn",
      expected: `profit ≤${PERF_BUDGET_MS.profitEngine}ms, roas ≤${PERF_BUDGET_MS.roasEngine}ms`,
      actual: `profit ${profitMs}ms, roas ${roasMs}ms, attr ${attrMs}ms`,
      message: pass
        ? `Performance acceptable at ${orderCount.toLocaleString()} orders`
        : `Slow at ${orderCount.toLocaleString()} orders — review before launch`,
      durationMs: snapshotMs + profitMs + roasMs + attrMs,
    });
  }

  return { benchmarks, checks };
}
