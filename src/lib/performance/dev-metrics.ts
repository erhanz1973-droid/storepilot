/**
 * Dev-only performance marks. No-op in production builds.
 */
export function markPerf(label: string): void {
  if (process.env.NODE_ENV !== "development") return;
  if (typeof performance !== "undefined" && "mark" in performance) {
    performance.mark(`storepilot:${label}`);
  }
}

export function measurePerf(name: string, startMark: string, endMark: string): void {
  if (process.env.NODE_ENV !== "development") return;
  if (typeof performance !== "undefined" && "measure" in performance) {
    try {
      performance.measure(`storepilot:${name}`, `storepilot:${startMark}`, `storepilot:${endMark}`);
    } catch {
      /* marks may be missing */
    }
  }
}
