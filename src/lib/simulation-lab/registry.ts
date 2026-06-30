import type { SimulationStoreRecord, SimulationRunResult, SimulationRegressionReport } from "./types";

const storeCache = new Map<string, SimulationStoreRecord>();
let lastRun: SimulationRunResult | null = null;
let lastRegression: SimulationRegressionReport | null = null;

export function cacheSimulationRecord(record: SimulationStoreRecord): void {
  storeCache.set(record.storeId, record);
}

export function getCachedSimulationRecord(storeId: string): SimulationStoreRecord | undefined {
  return storeCache.get(storeId);
}

export function clearSimulationCache(): void {
  storeCache.clear();
  lastRun = null;
}

export function setLastSimulationRun(result: SimulationRunResult): void {
  lastRun = result;
}

export function getLastSimulationRun(): SimulationRunResult | null {
  return lastRun;
}

export function setLastRegressionReport(report: SimulationRegressionReport): void {
  lastRegression = report;
}

export function getLastRegressionReport(): SimulationRegressionReport | null {
  return lastRegression;
}

export function listCachedStores(): SimulationStoreRecord[] {
  return [...storeCache.values()];
}
