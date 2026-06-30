-- Phase 2.2: Decision Engine — rejection feedback

CREATE TABLE IF NOT EXISTS decision_rejection_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  recommendation_id UUID REFERENCES recommendations(id) ON DELETE SET NULL,
  decision_id TEXT,
  opportunity_key TEXT,
  reason TEXT NOT NULL CHECK (reason IN (
    'too_aggressive',
    'need_more_evidence',
    'will_execute_later',
    'already_doing',
    'business_preference',
    'other'
  )),
  note TEXT,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_decision_rejection_feedback_store
  ON decision_rejection_feedback (store_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_decision_rejection_feedback_rec
  ON decision_rejection_feedback (recommendation_id, created_at DESC);
