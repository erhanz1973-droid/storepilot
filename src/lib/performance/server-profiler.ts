type PerfEntry = {
  module: string;
  ms: number;
  at: number;
};

const recentEntries: PerfEntry[] = [];
const MAX_ENTRIES = 200;

function shouldLog(): boolean {
  return process.env.NODE_ENV === "development" || process.env.STOREPILOT_PERF_LOG === "1";
}

/** Time an async server operation and log module duration in dev. */
export async function profileServerAsync<T>(
  module: string,
  fn: () => Promise<T>,
): Promise<T> {
  const start = performance.now();
  try {
    return await fn();
  } finally {
    const ms = Math.round(performance.now() - start);
    recentEntries.push({ module, ms, at: Date.now() });
    if (recentEntries.length > MAX_ENTRIES) {
      recentEntries.splice(0, recentEntries.length - MAX_ENTRIES);
    }
    if (shouldLog()) {
      console.log(`[StorePilot:perf] ${module} ${ms} ms`);
    }
  }
}

/** Log a grouped summary for a page load (dev / STOREPILOT_PERF_LOG). */
export function logPerfSummary(label: string, timings: Record<string, number>): void {
  if (!shouldLog()) return;
  const sorted = Object.entries(timings).sort((a, b) => b[1] - a[1]);
  const total = sorted.reduce((s, [, ms]) => s + ms, 0);
  console.log(`[StorePilot:perf] ${label} total ${total} ms`);
  for (const [module, ms] of sorted) {
    console.log(`  ${module}: ${ms} ms`);
  }
}

export function getRecentPerfEntries(): readonly PerfEntry[] {
  return recentEntries;
}
