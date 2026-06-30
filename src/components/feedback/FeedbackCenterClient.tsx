"use client";

import type { FeedbackCenterView } from "@/lib/feedback/types";
import { useCallback, useState } from "react";
import { FeedbackReportList } from "./FeedbackReportList";
import { FeedbackSubmitForm } from "./FeedbackSubmitForm";

type Tab = "submit" | "mine" | "features";

export function FeedbackCenterClient({ initial }: { initial: FeedbackCenterView }) {
  const [view, setView] = useState(initial);
  const [tab, setTab] = useState<Tab>("submit");

  const refresh = useCallback(async () => {
    const res = await fetch("/api/feedback");
    if (res.ok) {
      setView((await res.json()) as FeedbackCenterView);
      setTab("mine");
    }
  }, []);

  const handleVote = useCallback(async (id: string) => {
    const res = await fetch(`/api/feedback/${id}/vote`, { method: "POST" });
    if (res.ok) {
      await refresh();
      setTab("features");
    }
  }, [refresh]);

  return (
    <div className="fb-center">
      <section className="fb-stats-row">
        <div className="card fb-stat">
          <span className="muted">Submitted</span>
          <strong>{view.stats.totalSubmitted}</strong>
        </div>
        <div className="card fb-stat">
          <span className="muted">Open</span>
          <strong>{view.stats.openCount}</strong>
        </div>
        <div className="card fb-stat">
          <span className="muted">Resolved</span>
          <strong>{view.stats.resolvedCount}</strong>
        </div>
      </section>

      <div className="fb-tabs">
        <button
          type="button"
          className={tab === "submit" ? "active" : ""}
          onClick={() => setTab("submit")}
        >
          Submit
        </button>
        <button
          type="button"
          className={tab === "mine" ? "active" : ""}
          onClick={() => setTab("mine")}
        >
          My Feedback ({view.myReports.length})
        </button>
        <button
          type="button"
          className={tab === "features" ? "active" : ""}
          onClick={() => setTab("features")}
        >
          Feature Ideas
        </button>
      </div>

      {tab === "submit" && <FeedbackSubmitForm onSubmitted={() => void refresh()} />}

      {tab === "mine" && (
        <section className="card">
          <h3>My Feedback</h3>
          <p className="muted fb-status-legend">
            Status: New → Investigating → Planned → In Progress → Fixed → Released
          </p>
          <FeedbackReportList
            reports={view.myReports}
            emptyMessage="No feedback submitted yet. Use the Submit tab to report a bug or request a feature."
          />
        </section>
      )}

      {tab === "features" && (
        <section className="card">
          <h3>Feature Ideas</h3>
          <p className="muted">Vote on ideas from the StorePilot community. One vote per store.</p>
          <FeedbackReportList
            reports={view.featureRequests}
            emptyMessage="No feature requests yet. Be the first to suggest one."
            showVotes
            onVote={(id) => void handleVote(id)}
          />
        </section>
      )}
    </div>
  );
}
