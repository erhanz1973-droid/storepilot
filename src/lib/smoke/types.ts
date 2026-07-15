export type SmokeStatus = "PASS" | "FAIL" | "WARNING";

export type SmokeCheckResult = {
  name: string;
  status: SmokeStatus;
  message: string;
  details?: Record<string, unknown>;
  durationMs: number;
};

export type SmokeSuiteReport = {
  ok: boolean;
  final: "PASS" | "FAIL";
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  deploymentId: string | null;
  commitHash: string | null;
  baseUrl: string | null;
  checks: SmokeCheckResult[];
  failures: SmokeCheckResult[];
  warnings: SmokeCheckResult[];
};
