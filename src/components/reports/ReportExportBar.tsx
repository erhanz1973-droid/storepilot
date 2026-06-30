"use client";

import type { WeeklyBriefingReport } from "@/lib/reports/types";

function toCsv(report: WeeklyBriefingReport): string {
  const rows: string[][] = [
    ["Weekly Executive Summary"],
    ["Week", `${report.weekStart} – ${report.weekEnd}`],
    ["Revenue", String(report.executive.revenue)],
    ["Net Profit", String(report.executive.netProfit)],
    ["Business Status", report.executive.businessStatus],
    ["Executive Narrative", report.executive.narrativeParagraph],
    ["Biggest Problem", report.executive.biggestProblem],
    ["Biggest Opportunity", report.executive.biggestOpportunity],
    [],
    ["Scorecard", "Change %", "Status"],
    ...report.scorecard.map((s) => [
      s.label,
      s.changePct != null ? `${s.changePct}%` : "",
      s.unavailableReason ?? "Available",
    ]),
    [],
    ["Biggest Wins"],
    ...report.wins.map((w) => [w.label, w.value]),
    [],
    ["Biggest Problems", "Urgency"],
    ...report.problems.map((p) => [p.label, p.value, p.urgency ?? ""]),
    [],
    ["AI Outcomes"],
    ["Generated", String(report.aiOutcomes.generated)],
    ["Approved", String(report.aiOutcomes.approved)],
    ["Completed", String(report.aiOutcomes.completed)],
    ["Estimated Recovery", String(report.aiOutcomes.estimatedRecovery)],
    ["Actual Recovery", String(report.aiOutcomes.actualRecovery)],
    [
      "Accuracy",
      report.aiOutcomes.accuracyAvailable
        ? `${report.aiOutcomes.accuracyPct}%`
        : report.aiOutcomes.measurementStatus,
    ],
    [],
    ["Financial Impact", "Estimated/mo", "Measured/mo"],
    ...report.financialImpact.lines.map((l) => [
      l.label,
      String(l.estimatedMonthly),
      l.measuredMonthly != null ? String(l.measuredMonthly) : "Not available yet",
    ]),
    [],
    ["Next Week Priorities"],
    ...report.nextWeekPlan.map((p) => [
      `Priority ${p.priority}`,
      p.title,
      p.metricLabel ? `${p.metricLabel}: ${p.metricValue}` : "",
      p.impactLabel,
    ]),
  ];
  return rows.map((r) => r.map((c) => `"${c.replace(/"/g, '""')}"`).join(",")).join("\n");
}

function toExecutiveSummary(report: WeeklyBriefingReport): string {
  return [
    `Weekly Executive Summary (${report.weekStart} – ${report.weekEnd})`,
    "",
    `Revenue: $${report.executive.revenue.toLocaleString()}`,
    `Net Profit: $${report.executive.netProfit.toLocaleString()}`,
    `Status: ${report.executive.businessStatus}`,
    "",
    report.executive.narrativeParagraph,
    "",
    `Needs attention: ${report.executive.biggestProblem}`,
    `Highest-impact action: ${report.executive.biggestOpportunity} (~$${report.executive.opportunityImpactMonthly.toLocaleString()}/mo)`,
    "",
    "Next week priorities:",
    ...report.nextWeekPlan.map((p) => {
      const metric =
        p.metricLabel && p.metricValue ? ` (${p.metricLabel}: ${p.metricValue})` : "";
      return `${p.priority}. ${p.title}${metric} — ${p.impactLabel}`;
    }),
  ].join("\n");
}

export function ReportExportBar({ report }: { report: WeeklyBriefingReport }) {
  function downloadCsv() {
    const blob = new Blob([toCsv(report)], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `storepilot-weekly-${report.weekStart}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function downloadSummary() {
    const blob = new Blob([toExecutiveSummary(report)], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `storepilot-executive-summary-${report.weekStart}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function printPdf() {
    window.print();
  }

  return (
    <div className="reports-export-bar card">
      <span className="reports-section-icon" aria-hidden>
        ⬇
      </span>
      <div className="reports-export-copy">
        <h3>Export Report</h3>
        <p className="muted">PDF, CSV, or executive summary for agencies and stakeholders.</p>
      </div>
      <div className="reports-export-actions">
        <button type="button" className="btn btn-primary" onClick={printPdf}>
          PDF
        </button>
        <button type="button" className="btn btn-secondary" onClick={downloadCsv}>
          CSV
        </button>
        <button type="button" className="btn btn-ghost" onClick={downloadSummary}>
          Executive Summary
        </button>
      </div>
    </div>
  );
}
