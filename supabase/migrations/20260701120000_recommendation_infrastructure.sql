-- Phase 2.1: Recommendation Infrastructure (domain foundation)

ALTER TYPE recommendation_status ADD VALUE IF NOT EXISTS 'rejected';
ALTER TYPE recommendation_status ADD VALUE IF NOT EXISTS 'dismissed';
ALTER TYPE recommendation_status ADD VALUE IF NOT EXISTS 'expired';

ALTER TABLE recommendations
  ADD COLUMN IF NOT EXISTS recommendation_type TEXT,
  ADD COLUMN IF NOT EXISTS reason TEXT,
  ADD COLUMN IF NOT EXISTS evidence_json JSONB NOT NULL DEFAULT '{}'::jsonb;

-- Backfill domain columns from existing data
UPDATE recommendations
SET
  recommendation_type = COALESCE(recommendation_type, category),
  reason = COALESCE(reason, description),
  evidence_json = CASE
    WHEN evidence_json = '{}'::jsonb AND evidence IS NOT NULL AND evidence <> '[]'::jsonb
      THEN jsonb_build_object('supportingMetrics', evidence)
    ELSE evidence_json
  END
WHERE recommendation_type IS NULL OR reason IS NULL OR evidence_json = '{}'::jsonb;

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

CREATE INDEX IF NOT EXISTS idx_recommendation_events_type
  ON recommendation_events (event_type, created_at DESC);
