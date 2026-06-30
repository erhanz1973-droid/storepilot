-- Step 2: Closed-loop learning schema (run after enum migration is committed)

ALTER TABLE recommendations
  ADD COLUMN IF NOT EXISTS implemented_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS actual_impact TEXT,
  ADD COLUMN IF NOT EXISTS prediction_accuracy NUMERIC(5, 2),
  ADD COLUMN IF NOT EXISTS measurement_window_days INTEGER NOT NULL DEFAULT 7,
  ADD COLUMN IF NOT EXISTS measured_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS baseline_metrics JSONB,
  ADD COLUMN IF NOT EXISTS outcome_metrics JSONB,
  ADD COLUMN IF NOT EXISTS outcome_summary TEXT;

-- Index by timestamp columns (avoids enum literal in same txn as ADD VALUE)
CREATE INDEX IF NOT EXISTS idx_recommendations_store_implemented
  ON recommendations (store_id, implemented_at)
  WHERE implemented_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_recommendations_store_measured
  ON recommendations (store_id, measured_at DESC)
  WHERE measured_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_recommendations_store_status_implemented
  ON recommendations (store_id, status, implemented_at)
  WHERE status = 'implemented';

CREATE INDEX IF NOT EXISTS idx_recommendations_store_status_measured
  ON recommendations (store_id, measured_at DESC)
  WHERE status = 'measured';

-- Historical outcome archive (memory layer for AI learning)
CREATE TABLE IF NOT EXISTS recommendation_outcomes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recommendation_id UUID NOT NULL REFERENCES recommendations(id) ON DELETE CASCADE,
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  category TEXT NOT NULL,
  expected_monthly_impact NUMERIC(12, 2) NOT NULL DEFAULT 0,
  actual_monthly_impact NUMERIC(12, 2) NOT NULL DEFAULT 0,
  prediction_accuracy NUMERIC(5, 2) NOT NULL DEFAULT 0,
  baseline_metrics JSONB NOT NULL DEFAULT '{}'::jsonb,
  outcome_metrics JSONB NOT NULL DEFAULT '{}'::jsonb,
  outcome_summary TEXT,
  measurement_window_days INTEGER NOT NULL DEFAULT 7,
  measured_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_outcomes_store_category
  ON recommendation_outcomes (store_id, category, measured_at DESC);

CREATE INDEX IF NOT EXISTS idx_outcomes_store_measured
  ON recommendation_outcomes (store_id, measured_at DESC);

-- Weekly AI performance reports
CREATE TABLE IF NOT EXISTS weekly_ai_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  week_start DATE NOT NULL,
  report_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (store_id, week_start)
);

CREATE INDEX IF NOT EXISTS idx_weekly_reports_store
  ON weekly_ai_reports (store_id, week_start DESC);
