import type { ProviderValidationResult, ValidationExportReport } from "./types";

export function buildExportReport(result: ProviderValidationResult): ValidationExportReport {
  const failedChecks = result.healthChecks.filter((c) => !c.passed);

  return {
    exportedAt: new Date().toISOString(),
    provider: result.provider,
    providerLabel: result.providerLabel,
    storeId: result.storeId,
    validationDurationMs: result.durationMs,
    matchScore: result.matchScore,
    connection: result.connection,
    dashboardSnapshot: result.dashboardSnapshot,
    apiSnapshot: result.apiSnapshot,
    comparisons: result.comparisons,
    healthChecks: result.healthChecks,
    failedChecks,
    syncLogs: result.syncLogs,
    apiLogs: result.apiLogs,
    cache: result.cache,
    history: result.history,
  };
}

export function exportReportAsJson(report: ValidationExportReport): string {
  return JSON.stringify(report, null, 2);
}

/** Printable HTML report (save as PDF via browser print). */
export function exportReportAsHtml(report: ValidationExportReport): string {
  const rows = report.comparisons
    .map(
      (c) =>
        `<tr><td>${c.metric}</td><td>${c.dashboard}</td><td>${c.api}</td><td>${c.differencePct ?? "—"}%</td><td>${c.status.toUpperCase()}</td></tr>`,
    )
    .join("");

  const health = report.healthChecks
    .map((h) => `<li>${h.passed ? "✓" : "✗"} ${h.label}${h.detail ? ` — ${h.detail}` : ""}</li>`)
    .join("");

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>Validation Report — ${report.providerLabel}</title>
<style>
  body { font-family: system-ui, sans-serif; max-width: 900px; margin: 2rem auto; padding: 0 1rem; }
  h1 { font-size: 1.4rem; } table { width: 100%; border-collapse: collapse; font-size: 0.9rem; }
  th, td { border: 1px solid #ddd; padding: 6px 8px; text-align: left; }
  th { background: #f5f5f5; } .score { font-size: 1.2rem; font-weight: bold; }
</style></head><body>
<h1>StorePilot Validation Report</h1>
<p>Provider: <strong>${report.providerLabel}</strong> · Store: <strong>${report.storeId}</strong></p>
<p>Exported: ${report.exportedAt} · Duration: ${(report.validationDurationMs / 1000).toFixed(1)}s</p>
<p class="score">${report.matchScore.emoji} ${report.matchScore.label}</p>
<h2>Connection</h2>
<ul>
  <li>Business: ${report.connection.businessName ?? "—"} (${report.connection.businessId ?? "—"})</li>
  <li>Account: ${report.connection.accountName ?? "—"} (${report.connection.accountId ?? "—"})</li>
  <li>Status: ${report.connection.connectionStatus}</li>
</ul>
<h2>Metric Comparison</h2>
<table><thead><tr><th>Metric</th><th>Dashboard</th><th>API</th><th>Diff %</th><th>Status</th></tr></thead>
<tbody>${rows}</tbody></table>
<h2>Health Checks</h2><ul>${health}</ul>
<h2>Cache</h2>
<p>Key: ${report.cache.cacheKey} · Hits/Misses: ${report.cache.hitCount}/${report.cache.missCount}</p>
</body></html>`;
}
