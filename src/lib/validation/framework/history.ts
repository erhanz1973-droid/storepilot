import type { ValidationHistoryEntry, ValidationProviderId } from "./types";

const MAX_HISTORY = 100;

const historyByProvider = new Map<ValidationProviderId, ValidationHistoryEntry[]>();

export function recordValidationHistory(entry: ValidationHistoryEntry): void {
  const list = historyByProvider.get(entry.provider) ?? [];
  list.unshift(entry);
  if (list.length > MAX_HISTORY) list.length = MAX_HISTORY;
  historyByProvider.set(entry.provider, list);
}

export function getValidationHistory(
  provider: ValidationProviderId,
  storeId?: string,
): ValidationHistoryEntry[] {
  const list = historyByProvider.get(provider) ?? [];
  if (!storeId) return [...list];
  return list.filter((e) => e.storeId === storeId);
}

export function getTrendScores(
  provider: ValidationProviderId,
  storeId?: string,
  limit = 20,
): number[] {
  return getValidationHistory(provider, storeId)
    .slice(0, limit)
    .reverse()
    .map((e) => e.matchScore);
}

export function clearValidationHistory(provider?: ValidationProviderId): void {
  if (provider) {
    historyByProvider.delete(provider);
    return;
  }
  historyByProvider.clear();
}
