-- Phase 6A — recommendation feedback for AI quality loop

CREATE TABLE IF NOT EXISTS recommendation_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recommendation_id UUID NOT NULL REFERENCES recommendations(id) ON DELETE CASCADE,
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  helpful BOOLEAN NOT NULL,
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_feedback_store_created
  ON recommendation_feedback (store_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_feedback_recommendation
  ON recommendation_feedback (recommendation_id);

-- Pilot program weekly merchant feedback
CREATE TABLE IF NOT EXISTS pilot_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  week_start DATE NOT NULL,
  helped_decisions BOOLEAN,
  notes TEXT,
  industry TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (store_id, week_start)
);

CREATE INDEX IF NOT EXISTS idx_pilot_feedback_week
  ON pilot_feedback (week_start DESC);
