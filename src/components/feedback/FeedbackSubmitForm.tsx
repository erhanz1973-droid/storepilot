"use client";

import { FEEDBACK_TYPE_LABELS } from "@/lib/feedback/constants";
import { MAX_SCREENSHOT_BYTES } from "@/lib/feedback/constants";
import type { FeedbackContext, FeedbackReportType } from "@/lib/feedback/types";
import { usePathname, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

const TYPE_OPTIONS: { id: FeedbackReportType; hint: string }[] = [
  { id: "bug", hint: "Something broken or incorrect" },
  { id: "ai_recommendation", hint: "Rate an AI suggestion" },
  { id: "feature_request", hint: "Request a new capability" },
  { id: "general", hint: "Share thoughts or praise" },
];

export function FeedbackSubmitForm({ onSubmitted }: { onSubmitted: () => void }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const initialType = (searchParams.get("type") as FeedbackReportType) || "general";
  const initialRecId = searchParams.get("recommendationId");

  const [type, setType] = useState<FeedbackReportType>(
    TYPE_OPTIONS.some((t) => t.id === initialType) ? initialType : "general",
  );
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [helpful, setHelpful] = useState<boolean | null>(null);
  const [reason, setReason] = useState("");
  const [screenshot, setScreenshot] = useState<string | null>(null);
  const [context, setContext] = useState<FeedbackContext | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const loadContext = useCallback(async () => {
    const params = new URLSearchParams({ page: pathname });
    if (initialRecId) params.set("recommendationId", initialRecId);
    const res = await fetch(`/api/feedback/context?${params}`);
    if (res.ok) {
      setContext((await res.json()) as FeedbackContext);
    }
  }, [pathname, initialRecId]);

  useEffect(() => {
    void loadContext();
  }, [loadContext]);

  useEffect(() => {
    if (type === "ai_recommendation" && initialRecId) {
      setTitle("AI recommendation feedback");
    }
  }, [type, initialRecId]);

  async function handleScreenshot(file: File | null) {
    if (!file) {
      setScreenshot(null);
      return;
    }
    if (file.size > MAX_SCREENSHOT_BYTES) {
      setError("Screenshot must be under 500KB.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setScreenshot(reader.result as string);
    reader.readAsDataURL(file);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type,
          title,
          description,
          helpful: type === "ai_recommendation" ? helpful : undefined,
          reason: type === "ai_recommendation" && helpful === false ? reason : undefined,
          recommendationId: initialRecId,
          screenshotDataUrl: screenshot,
          context: {
            page: pathname,
            browser: typeof navigator !== "undefined" ? navigator.userAgent : "unknown",
            recommendationId: initialRecId,
          },
        }),
      });
      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        throw new Error(typeof data.error === "string" ? data.error : "Submit failed");
      }
      setSuccess(true);
      setTitle("");
      setDescription("");
      setHelpful(null);
      setReason("");
      setScreenshot(null);
      onSubmitted();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Submit failed");
    } finally {
      setLoading(false);
    }
  }

  if (success) {
    return (
      <div className="card fb-success-card">
        <h3>Thank you</h3>
        <p>Your feedback was submitted. It helps improve StorePilot and our AI models.</p>
        <button type="button" className="btn btn-secondary" onClick={() => setSuccess(false)}>
          Submit another
        </button>
      </div>
    );
  }

  return (
    <form className="card fb-submit-form" onSubmit={(e) => void handleSubmit(e)}>
      <h3>Submit Feedback</h3>
      <div className="fb-type-grid">
        {TYPE_OPTIONS.map((opt) => (
          <button
            key={opt.id}
            type="button"
            className={`fb-type-btn ${type === opt.id ? "active" : ""}`}
            onClick={() => setType(opt.id)}
          >
            <strong>{FEEDBACK_TYPE_LABELS[opt.id]}</strong>
            <span className="muted">{opt.hint}</span>
          </button>
        ))}
      </div>

      <label className="fb-field">
        <span>Title</span>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={
            type === "bug"
              ? "e.g. Profit page shows wrong ROAS"
              : type === "feature_request"
                ? "e.g. Export weekly report to PDF"
                : "Brief summary"
          }
          required
          minLength={3}
        />
      </label>

      <label className="fb-field">
        <span>Details</span>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={5}
          placeholder="What happened? What did you expect? Steps to reproduce if applicable."
          required
          minLength={10}
        />
      </label>

      {type === "ai_recommendation" && (
        <div className="fb-ai-rating">
          <span>Was the recommendation helpful?</span>
          <div className="actions-row">
            <button
              type="button"
              className={`btn btn-secondary ${helpful === true ? "active" : ""}`}
              onClick={() => setHelpful(true)}
            >
              Helpful
            </button>
            <button
              type="button"
              className={`btn btn-secondary ${helpful === false ? "active" : ""}`}
              onClick={() => setHelpful(false)}
            >
              Not Helpful
            </button>
          </div>
          {helpful === false && (
            <label className="fb-field">
              <span>What was wrong?</span>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={3}
                required
                minLength={3}
                placeholder="Numbers didn't match, not actionable, already tried this…"
              />
            </label>
          )}
        </div>
      )}

      <label className="fb-field">
        <span>Screenshot (optional)</span>
        <input
          type="file"
          accept="image/png,image/jpeg,image/webp"
          onChange={(e) => void handleScreenshot(e.target.files?.[0] ?? null)}
        />
        {screenshot && (
          <img src={screenshot} alt="Screenshot preview" className="fb-screenshot-preview" />
        )}
      </label>

      {context && (
        <details className="fb-context-details">
          <summary>Automatic context captured</summary>
          <ul className="fb-context-list">
            <li>Page: {context.page}</li>
            <li>App version: {context.appVersion}</li>
            <li>Timestamp: {new Date(context.timestamp).toLocaleString()}</li>
            {context.recommendationId && <li>Recommendation: {context.recommendationId}</li>}
            <li>
              Integrations:{" "}
              {context.integrations
                .filter((i) => i.status === "connected" || i.status === "demo")
                .map((i) => i.label)
                .join(", ") || "None connected"}
            </li>
            <li className="fb-browser">Browser: {context.browser.slice(0, 80)}…</li>
          </ul>
        </details>
      )}

      {error && <p className="fb-error">{error}</p>}

      <button
        type="submit"
        className="btn btn-primary"
        disabled={
          loading ||
          (type === "ai_recommendation" && helpful === null) ||
          (type === "ai_recommendation" && helpful === false && reason.trim().length < 3)
        }
      >
        {loading ? "Submitting…" : "Submit Feedback"}
      </button>
    </form>
  );
}
