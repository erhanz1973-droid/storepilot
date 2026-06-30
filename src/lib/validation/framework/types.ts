/** Provider identifiers for the enterprise validation framework. */
export type ValidationProviderId = "meta" | "google" | "shopify" | "ga4" | "ai";

export type DiffSeverity = "green" | "yellow" | "red";

export type ComparisonStatus = "pass" | "warn" | "fail";

/** Normalized metric snapshot used for dashboard vs API comparison. */
export type ValidationSnapshot = {
  spend: number;
  roas: number;
  revenue: number;
  purchases: number;
  campaigns: number;
  currency: string;
  dateRange: string;
};

export type MetricComparisonRow = {
  metric: string;
  dashboard: number | string;
  api: number | string;
  differencePct: number | null;
  status: ComparisonStatus;
  severity: DiffSeverity;
};

export type MatchScoreResult = {
  percent: number;
  status: DiffSeverity;
  emoji: string;
  label: string;
  passedMetrics: number;
  totalMetrics: number;
};

export type ValidationHealthCheck = {
  id: string;
  label: string;
  passed: boolean;
  detail?: string;
};

export type ValidationLogEntry = {
  id: string;
  timestamp: string;
  message: string;
  level: "info" | "success" | "error";
};

export type ValidationApiLogEntry = {
  id: string;
  timestamp: string;
  method: string;
  endpoint: string;
  context?: string;
  dateRange?: string;
};

export type ValidationCacheInfo = {
  cacheKey: string;
  createdAt: string | null;
  expiresAt: string | null;
  lastHitAt: string | null;
  lastMissAt: string | null;
  hitCount: number;
  missCount: number;
};

export type ValidationConnectionInfo = {
  businessName: string | null;
  businessId: string | null;
  accountName: string | null;
  accountId: string | null;
  connectionStatus: string;
  tokenExpiresAt: string | null;
  lastSyncAt: string | null;
  apiVersion: string | null;
  timezone: string | null;
  scopes: string[];
};

export type ValidationHistoryEntry = {
  id: string;
  timestamp: string;
  provider: ValidationProviderId;
  user: string;
  storeId: string;
  businessName: string | null;
  accountId: string | null;
  matchScore: number;
  passedChecks: number;
  failedChecks: number;
  durationMs: number;
  comparisons: MetricComparisonRow[];
};

export type ProviderValidationResult = {
  enabled: true;
  provider: ValidationProviderId;
  providerLabel: string;
  storeId: string;
  connection: ValidationConnectionInfo;
  dashboardSnapshot: ValidationSnapshot;
  apiSnapshot: ValidationSnapshot;
  comparisons: MetricComparisonRow[];
  matchScore: MatchScoreResult;
  healthChecks: ValidationHealthCheck[];
  syncLogs: ValidationLogEntry[];
  apiLogs: ValidationApiLogEntry[];
  cache: ValidationCacheInfo;
  history: ValidationHistoryEntry[];
  trendScores: number[];
  durationMs: number;
  lastValidatedAt: string | null;
  /** Cross-provider readiness for AI Recommendation Engine */
  integrationGate?: import("@/lib/recommendations/validation/types").ValidationGateReport;
};

export type ValidationExportReport = {
  exportedAt: string;
  provider: ValidationProviderId;
  providerLabel: string;
  storeId: string;
  validationDurationMs: number;
  matchScore: MatchScoreResult;
  connection: ValidationConnectionInfo;
  dashboardSnapshot: ValidationSnapshot;
  apiSnapshot: ValidationSnapshot;
  comparisons: MetricComparisonRow[];
  healthChecks: ValidationHealthCheck[];
  failedChecks: ValidationHealthCheck[];
  syncLogs: ValidationLogEntry[];
  apiLogs: ValidationApiLogEntry[];
  cache: ValidationCacheInfo;
  history: ValidationHistoryEntry[];
};

export type RunValidationOptions = {
  runFresh?: boolean;
  user?: string;
  bypassCache?: boolean;
};

export type ValidationEvidenceItem = {
  id: string;
  label: string;
  passed: boolean;
};

export type ValidationEvidenceBundle = {
  providers: ValidationProviderId[];
  items: ValidationEvidenceItem[];
  overallMatchPercent: number | null;
  cacheFresh: boolean;
  apiVerified: boolean;
  allPassed: boolean;
};
