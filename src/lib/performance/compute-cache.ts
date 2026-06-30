type CacheEntry<T> = {
  value: T;
  hash: string;
  expiresAt: number;
};

const store = new Map<string, CacheEntry<unknown>>();

/** Stable hash from serializable inputs (sync data fingerprint). */
export function fingerprintData(input: unknown): string {
  return JSON.stringify(input);
}

/**
 * Reuse expensive computed results when source data fingerprint is unchanged.
 * In-memory per server instance; suitable for AI/analysis rebuilds within a request lifecycle.
 */
export function getOrCompute<T>(
  key: string,
  dataFingerprint: string,
  ttlMs: number,
  compute: () => T,
): T {
  const now = Date.now();
  const hit = store.get(key) as CacheEntry<T> | undefined;
  if (hit && hit.hash === dataFingerprint && hit.expiresAt > now) {
    return hit.value;
  }
  const value = compute();
  store.set(key, { value, hash: dataFingerprint, expiresAt: now + ttlMs });
  return value;
}

export function invalidateComputeCache(prefix?: string): void {
  if (!prefix) {
    store.clear();
    return;
  }
  for (const key of store.keys()) {
    if (key.startsWith(prefix)) store.delete(key);
  }
}
