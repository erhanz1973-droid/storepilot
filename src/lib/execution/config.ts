export type ExecutionMode = "dry_run" | "live";

/** Default: dry_run — no external API mutations until explicitly enabled. */
export function getExecutionMode(): ExecutionMode {
  const raw =
    process.env.STOREPILOT_EXECUTION_MODE ??
    process.env.EXECUTION_MODE ??
    "dry_run";
  return raw === "live" ? "live" : "dry_run";
}

export function isLiveExecutionEnabled(): boolean {
  return getExecutionMode() === "live";
}
