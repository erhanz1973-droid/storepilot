-- Pilot catch-up: recommendation columns required by the app (run after initial_schema).
-- Safe to run if you skipped intermediate migrations; uses IF NOT EXISTS throughout.

-- Enum values used by the recommendation domain
ALTER TYPE recommendation_status ADD VALUE IF NOT EXISTS 'implemented';
ALTER TYPE recommendation_status ADD VALUE IF NOT EXISTS 'measured';
ALTER TYPE recommendation_status ADD VALUE IF NOT EXISTS 'rejected';
ALTER TYPE recommendation_status ADD VALUE IF NOT EXISTS 'dismissed';
ALTER TYPE recommendation_status ADD VALUE IF NOT EXISTS 'expired';

-- Domain + closed-loop columns
ALTER TABLE recommendations
  ADD COLUMN IF NOT EXISTS recommendation_type TEXT,
  ADD COLUMN IF NOT EXISTS reason TEXT,
  ADD COLUMN IF NOT EXISTS evidence_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS implemented_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS actual_impact TEXT,
  ADD COLUMN IF NOT EXISTS prediction_accuracy NUMERIC(5, 2),
  ADD COLUMN IF NOT EXISTS measurement_window_days INTEGER NOT NULL DEFAULT 7,
  ADD COLUMN IF NOT EXISTS measured_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS baseline_metrics JSONB,
  ADD COLUMN IF NOT EXISTS outcome_metrics JSONB,
  ADD COLUMN IF NOT EXISTS outcome_summary TEXT,
  ADD COLUMN IF NOT EXISTS ignore_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_ignored_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS suppressed_until TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS positive_outcome_count INTEGER NOT NULL DEFAULT 0;

-- Intelligence / upsert columns (fixes estimated_cost_saving error)
ALTER TABLE recommendations
  ADD COLUMN IF NOT EXISTS validation_score NUMERIC(5, 2),
  ADD COLUMN IF NOT EXISTS ai_confidence NUMERIC(4, 3),
  ADD COLUMN IF NOT EXISTS validation_confidence NUMERIC(4, 3),
  ADD COLUMN IF NOT EXISTS estimated_revenue_gain NUMERIC(12, 2),
  ADD COLUMN IF NOT EXISTS estimated_cost_saving NUMERIC(12, 2),
  ADD COLUMN IF NOT EXISTS lifecycle_stage TEXT NOT NULL DEFAULT 'created',
  ADD COLUMN IF NOT EXISTS displayed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS rejected_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS executed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS closed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS reason_detail TEXT,
  ADD COLUMN IF NOT EXISTS validation_evidence JSONB NOT NULL DEFAULT '[]'::jsonb;

-- Backfill domain columns from legacy fields
UPDATE recommendations
SET
  recommendation_type = COALESCE(recommendation_type, category),
  reason = COALESCE(reason, description),
  evidence_json = CASE
    WHEN evidence_json = '{}'::jsonb AND evidence IS NOT NULL AND evidence <> '[]'::jsonb
      THEN jsonb_build_object('supportingMetrics', evidence)
    ELSE evidence_json
  END
WHERE recommendation_type IS NULL OR reason IS NULL;

-- Lifecycle check (add only if missing)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'recommendations_lifecycle_stage_check'
  ) THEN
    ALTER TABLE recommendations
      ADD CONSTRAINT recommendations_lifecycle_stage_check
      CHECK (lifecycle_stage IN (
        'created', 'displayed', 'approved', 'rejected', 'snoozed',
        'executed', 'observing', 'measured', 'closed'
      ));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_recommendations_lifecycle
  ON recommendations (store_id, lifecycle_stage, created_at DESC);

-- Event log (appendEvent in repository)
CREATE TABLE IF NOT EXISTS recommendation_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recommendation_id UUID NOT NULL REFERENCES recommendations(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL CHECK (event_type IN (
    'RecommendationCreated',
    'RecommendationViewed',
    'RecommendationApproved',
    'RecommendationRejected',
    'RecommendationDismissed'
  )),
  payload_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_recommendation_events_rec
  ON recommendation_events (recommendation_id, created_at ASC);
