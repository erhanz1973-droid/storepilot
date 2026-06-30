export type ValidationStatus = "pass" | "fail" | "warn" | "skip";

export type ValidationCheck = {
  id: string;
  suite: string;
  name: string;
  status: ValidationStatus;
  expected?: string;
  actual?: string;
  message: string;
  durationMs?: number;
};

export type PerformanceBenchmark = {
  orderCount: number;
  syncTimeMs: number;
  snapshotTimeMs: number;
  profitEngineMs: number;
  roasEngineMs: number;
  attributionEngineMs: number;
  memoryEstimateMb: number;
};

export type ValidationReport = {
  runAt: string;
  durationMs: number;
  checks: ValidationCheck[];
  passed: number;
  failed: number;
  warned: number;
  skipped: number;
  goNoGo: GoNoGoChecklist;
  performance: PerformanceBenchmark[];
};

export type GoNoGoChecklist = {
  profitAccurate: boolean;
  roasAccurate: boolean;
  attributionConfidenceCorrect: boolean;
  aiEvidenceBased: boolean;
  performanceAcceptable: boolean;
  readyForLaunch: boolean;
  blockers: string[];
};

export type ValidationMetrics = {
  activeStores: number;
  totalRecommendations: number;
  measuredRecommendations: number;
  feedbackHelpful: number;
  feedbackNotHelpful: number;
  acceptanceRatePct: number;
  accuracyRatePct: number;
  avgProfitGenerated: number;
  falsePositiveRatePct: number;
  askAiSessionsEstimate: number;
  avgSyncDurationMs: number | null;
  apiErrorRatePct: number;
  lastValidationRun: string | null;
  goNoGo: GoNoGoChecklist | null;
};
