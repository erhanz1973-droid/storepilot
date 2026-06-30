export type MetaApiLogEntry = {
  id: string;
  timestamp: string;
  adAccountId: string;
  method: string;
  endpoint: string;
  dateRange?: string;
  url: string;
};

export type MetaSyncLogEntry = {
  id: string;
  timestamp: string;
  storeId: string;
  storeLabel?: string;
  businessId?: string;
  businessName?: string;
  adAccountId: string;
  adAccountName?: string;
  campaignCount: number;
  spend30d: number;
  currency: string;
  dateRange: string;
  durationMs: number;
  success: boolean;
  error?: string;
  text: string;
};

export type MetaCacheDebugInfo = {
  cacheKey: string;
  createdAt: string | null;
  expiresAt: string | null;
  lastHitAt: string | null;
  lastMissAt: string | null;
  hitCount: number;
  missCount: number;
  campaignCount: number;
};

export type MetaMetricComparison = {
  metric: string;
  dashboard: number | null;
  api: number | null;
  match: boolean;
  delta?: number;
};

export type MetaHealthCheck = {
  id: string;
  label: string;
  passed: boolean;
  detail?: string;
};

export type MetaValidationPanelData = {
  enabled: true;
  connection: {
    businessName: string | null;
    businessId: string | null;
    adAccountName: string | null;
    adAccountId: string | null;
    connectionStatus: string;
    tokenExpiresAt: string | null;
    lastSyncAt: string | null;
    apiVersion: string;
    campaignCount: number;
    currency: string | null;
    timezone: string | null;
    scopes: string[];
  };
  syncLogs: MetaSyncLogEntry[];
  apiLogs: MetaApiLogEntry[];
  cache: MetaCacheDebugInfo;
  metricComparison: MetaMetricComparison[];
  healthChecks: MetaHealthCheck[];
  lastValidatedAt: string | null;
};
