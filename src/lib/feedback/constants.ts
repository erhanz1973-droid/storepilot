import type { FeedbackReportStatus, FeedbackReportType } from "./types";

export const APP_VERSION = process.env.NEXT_PUBLIC_APP_VERSION ?? "0.1.0";

export const FEEDBACK_TYPE_LABELS: Record<FeedbackReportType, string> = {
  bug: "Bug Report",
  ai_recommendation: "AI Recommendation",
  feature_request: "Feature Request",
  general: "General Feedback",
};

export const FEEDBACK_STATUS_LABELS: Record<FeedbackReportStatus, string> = {
  new: "New",
  investigating: "Investigating",
  planned: "Planned",
  in_progress: "In Progress",
  fixed: "Fixed",
  released: "Released",
};

export const FEEDBACK_STATUS_ORDER: FeedbackReportStatus[] = [
  "new",
  "investigating",
  "planned",
  "in_progress",
  "fixed",
  "released",
];

export const MAX_SCREENSHOT_BYTES = 500_000;
