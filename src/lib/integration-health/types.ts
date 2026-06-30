export type ConnectionState = "connected" | "disconnected" | "error" | "waiting" | "demo";

export type Severity = "critical" | "warning" | "info";

export type EntityCheck = {
  label: string;
  value: string;
  status: "synced" | "partial" | "missing" | "unknown";
};

export type ProviderHealthDetail = {
  id: string;
  label: string;
  connectionStatus: ConnectionState;
  tokenValid: boolean;
  lastSuccessfulSync: string | null;
  apiLatencyMs: number | null;
  rateLimitStatus: "ok" | "warning" | "unknown";
  lastApiError: string | null;
  recordsSynced: number | null;
  missingFields: string[];
  dataFreshness: "fresh" | "stale" | "unknown";
  dataQualityPct: number | null;
  aiReadyPct: number;
  aiReady: boolean;
  entityChecks: EntityCheck[];
  connectHref?: string;
  syncEndpoint?: string;
};

export type ModuleReadiness = {
  id: string;
  label: string;
  readinessPct: number;
  status: "ready" | "partial" | "locked";
  blockers: string[];
};

export type DataQualityIssue = {
  id: string;
  severity: Severity;
  message: string;
  source: string;
};

export type AiCapabilityTest = {
  id: string;
  label: string;
  passed: boolean;
  detail: string;
};

export type CapabilityMatrixRow = {
  feature: string;
  status: "ready" | "partial" | "waiting";
  reason: string;
};

export type MissingDataBlock = {
  module: string;
  headline: string;
  explanation: string;
  required: { label: string; met: boolean }[];
  estimatedSetupMinutes: number | null;
};

export type SyncMonitoringRow = {
  provider: string;
  lastSync: string | null;
  nextScheduledSync: string | null;
  avgDurationMs: number | null;
  failedSyncCount: number;
  queueStatus: string;
  progressLabel: string | null;
};

export type IntegrationTestResult = {
  id: string;
  label: string;
  passed: boolean;
  durationMs: number;
  detail?: string;
};

export type SystemSummary = {
  systemStatus: "operational" | "degraded" | "attention";
  dataQualityPct: number;
  connectedProviders: number;
  totalProviders: number;
  aiFeaturesAvailable: number;
  totalAiFeatures: number;
  lastValidationAt: string;
};

export type AiTrustSummary = {
  aiTrustScorePct: number;
  narrative: string;
  confidenceReductions: string[];
};

export type IntegrationHealthDashboard = {
  generatedAt: string;
  storeId: string;
  aiTrust: AiTrustSummary;
  systemSummary: SystemSummary;
  overallAiReadinessPct: number;
  dataQualityPct: number;
  canAiTrustData: boolean;
  providers: ProviderHealthDetail[];
  moduleReadiness: ModuleReadiness[];
  dataQualityIssues: DataQualityIssue[];
  aiCapabilityTests: AiCapabilityTest[];
  capabilityMatrix: CapabilityMatrixRow[];
  missingDataBlocks: MissingDataBlock[];
  syncMonitoring: SyncMonitoringRow[];
  testSuite: IntegrationTestResult[];
  testSuiteRanAt: string | null;
};
