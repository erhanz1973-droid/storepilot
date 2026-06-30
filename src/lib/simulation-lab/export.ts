import type { SimulationRegressionReport, SimulationRunResult } from "./types";

export function exportSimulationJson(
  result: SimulationRunResult | SimulationRegressionReport,
): string {
  return JSON.stringify(result, null, 2);
}

export function exportSimulationCsv(result: SimulationRunResult): string {
  const headers = [
    "scenario",
    "business_model",
    "verdict",
    "expected",
    "actual",
    "confidence",
    "quality",
    "reason",
  ];
  const rows = result.decisionMatches.map((m) => [
    result.scenarioLabel,
    result.businessModel,
    m.verdict.toUpperCase(),
    m.expectedLabel,
    m.actualSummary ?? "",
    m.confidencePct?.toString() ?? "",
    m.qualityScorePct?.toString() ?? "",
    m.reason,
  ]);
  return [headers.join(","), ...rows.map((r) => r.map(csvEscape).join(","))].join("\n");
}

function csvEscape(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function exportSimulationHtml(
  result: SimulationRunResult | SimulationRegressionReport,
): string {
  const isRegression = "results" in result;
  const title = isRegression ? "Simulation Regression Report" : "Simulation Run Report";
  const rows = isRegression
    ? result.results.flatMap((r) =>
        r.decisionMatches.map((m) => ({ run: r, match: m })),
      )
  : result.decisionMatches.map((m) => ({ run: result, match: m }));

  const body = rows
    .map(
      ({ run, match }) => `
    <tr>
      <td>${run.scenarioLabel}</td>
      <td>${run.businessModel}</td>
      <td class="${match.verdict}">${match.verdict.toUpperCase()}</td>
      <td>${match.expectedLabel}</td>
      <td>${match.actualSummary ?? "—"}</td>
      <td>${match.confidencePct ?? "—"}</td>
      <td>${match.reason}</td>
    </tr>`,
    )
    .join("");

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>${title}</title>
<style>
  body { font-family: system-ui, sans-serif; padding: 24px; background: #0f172a; color: #e2e8f0; }
  table { border-collapse: collapse; width: 100%; }
  th, td { border: 1px solid #334155; padding: 8px; text-align: left; font-size: 14px; }
  th { background: #1e293b; }
  .pass { color: #22c55e; } .warn { color: #eab308; } .fail { color: #ef4444; }
</style></head>
<body>
  <h1>${title}</h1>
  <p>Generated ${result.generatedAt}</p>
  <table>
    <thead><tr>
      <th>Scenario</th><th>Business Model</th><th>Verdict</th>
      <th>Expected</th><th>Actual</th><th>Confidence</th><th>Reason</th>
    </tr></thead>
    <tbody>${body}</tbody>
  </table>
</body></html>`;
}
