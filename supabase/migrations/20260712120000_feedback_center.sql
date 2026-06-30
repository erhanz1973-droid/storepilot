-- Feedback Center — bugs, feature requests, AI feedback, general feedback

CREATE TYPE feedback_report_type AS ENUM (
  'bug',
  'ai_recommendation',
  'feature_request',
  'general'
);

CREATE TYPE feedback_report_status AS ENUM (
  'new',
  'investigating',
  'planned',
  'in_progress',
  'fixed',
  'released'
);

CREATE TABLE IF NOT EXISTS feedback_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  type feedback_report_type NOT NULL,
  status feedback_report_status NOT NULL DEFAULT 'new',
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  helpful BOOLEAN,
  reason TEXT,
  recommendation_id UUID REFERENCES recommendations(id) ON DELETE SET NULL,
  context JSONB NOT NULL DEFAULT '{}'::jsonb,
  screenshot_data_url TEXT,
  vote_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_feedback_reports_store_created
  ON feedback_reports (store_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_feedback_reports_type_status
  ON feedback_reports (type, status);

CREATE INDEX IF NOT EXISTS idx_feedback_reports_feature_votes
  ON feedback_reports (type, vote_count DESC)
  WHERE type = 'feature_request';

CREATE TABLE IF NOT EXISTS feedback_votes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  feedback_id UUID NOT NULL REFERENCES feedback_reports(id) ON DELETE CASCADE,
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (feedback_id, store_id)
);

CREATE INDEX IF NOT EXISTS idx_feedback_votes_feedback
  ON feedback_votes (feedback_id);
