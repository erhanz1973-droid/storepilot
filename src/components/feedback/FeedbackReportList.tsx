"use client";

import { FEEDBACK_TYPE_LABELS } from "@/lib/feedback/constants";
import type { FeedbackReport } from "@/lib/feedback/types";
import { FeedbackStatusBadge } from "./FeedbackStatusBadge";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString();
}

export function FeedbackReportList({
  reports,
  emptyMessage,
  showVotes = false,
  onVote,
}: {
  reports: FeedbackReport[];
  emptyMessage: string;
  showVotes?: boolean;
  onVote?: (id: string) => void;
}) {
  if (reports.length === 0) {
    return <p className="muted">{emptyMessage}</p>;
  }

  return (
    <ul className="fb-report-list">
      {reports.map((report) => (
        <li key={report.id} className="fb-report-item">
          <header className="fb-report-head">
            <div>
              <span className="fb-type-tag">{FEEDBACK_TYPE_LABELS[report.type]}</span>
              <h4>{report.title}</h4>
            </div>
            <FeedbackStatusBadge status={report.status} />
          </header>
          <p className="fb-report-desc">{report.description}</p>
          {report.type === "ai_recommendation" && report.helpful != null && (
            <p className="muted fb-ai-verdict">
              {report.helpful ? "Marked helpful" : "Marked not helpful"}
              {report.reason ? ` — ${report.reason}` : ""}
            </p>
          )}
          <footer className="fb-report-foot">
            <span className="muted">{formatDate(report.createdAt)}</span>
            {showVotes && report.type === "feature_request" && (
              <button
                type="button"
                className={`btn btn-ghost fb-vote-btn ${report.votedByStore ? "voted" : ""}`}
                disabled={report.votedByStore}
                onClick={() => onVote?.(report.id)}
              >
                ▲ {report.voteCount} {report.votedByStore ? "Voted" : "Vote"}
              </button>
            )}
          </footer>
          {report.screenshotDataUrl && (
            <details className="fb-screenshot-details">
              <summary>Screenshot</summary>
              <img src={report.screenshotDataUrl} alt="Attached screenshot" className="fb-screenshot-preview" />
            </details>
          )}
        </li>
      ))}
    </ul>
  );
}
