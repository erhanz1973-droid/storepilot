export type FeedbackReportType = "bug" | "ai_recommendation" | "feature_request" | "general";

export type FeedbackReportStatus =
  | "new"
  | "investigating"
  | "planned"
  | "in_progress"
  | "fixed"
  | "released";

export type FeedbackContext = {
  page: string;
  appVersion: string;
  browser: string;
  timestamp: string;
  integrations: { id: string; label: string; status: string }[];
  recommendationId?: string | null;
};

export type FeedbackReport = {
  id: string;
  storeId: string;
  type: FeedbackReportType;
  status: FeedbackReportStatus;
  title: string;
  description: string;
  helpful: boolean | null;
  reason: string | null;
  recommendationId: string | null;
  context: FeedbackContext;
  screenshotDataUrl: string | null;
  voteCount: number;
  createdAt: string;
  updatedAt: string;
  votedByStore?: boolean;
};

export type SubmitFeedbackInput = {
  type: FeedbackReportType;
  title: string;
  description: string;
  helpful?: boolean | null;
  reason?: string | null;
  recommendationId?: string | null;
  screenshotDataUrl?: string | null;
  context: Partial<FeedbackContext> & { page: string; browser: string };
};

export type FeedbackCenterView = {
  myReports: FeedbackReport[];
  featureRequests: FeedbackReport[];
  stats: {
    totalSubmitted: number;
    openCount: number;
    resolvedCount: number;
  };
};
