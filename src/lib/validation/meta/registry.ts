import type { MetaApiLogEntry, MetaSyncLogEntry } from "./types";

const MAX_SYNC_LOGS = 20;
const MAX_API_LOGS = 50;

const syncLogs: MetaSyncLogEntry[] = [];
const apiLogs: MetaApiLogEntry[] = [];
let lastValidatedAt: string | null = null;

export function pushMetaSyncLog(entry: MetaSyncLogEntry): void {
  syncLogs.unshift(entry);
  if (syncLogs.length > MAX_SYNC_LOGS) syncLogs.length = MAX_SYNC_LOGS;
  if (process.env.NODE_ENV === "development") {
    console.log(entry.text);
  }
}

export function pushMetaApiLog(entry: Omit<MetaApiLogEntry, "id" | "timestamp">): void {
  const row: MetaApiLogEntry = {
    ...entry,
    id: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
  };
  apiLogs.unshift(row);
  if (apiLogs.length > MAX_API_LOGS) apiLogs.length = MAX_API_LOGS;
  if (process.env.NODE_ENV === "development") {
    const range = row.dateRange ? ` (${row.dateRange})` : "";
    console.log(`[Meta API] ${row.method} ${row.endpoint}${range} · ${row.adAccountId}`);
  }
}

export function getMetaSyncLogs(): MetaSyncLogEntry[] {
  return [...syncLogs];
}

export function getMetaApiLogs(): MetaApiLogEntry[] {
  return [...apiLogs];
}

export function setLastValidatedAt(iso: string): void {
  lastValidatedAt = iso;
}

export function getLastValidatedAt(): string | null {
  return lastValidatedAt;
}

export function clearMetaValidationLogs(): void {
  syncLogs.length = 0;
  apiLogs.length = 0;
  lastValidatedAt = null;
}
