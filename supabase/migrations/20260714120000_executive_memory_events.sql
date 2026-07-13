-- Persistent Executive Memory events (Learning Loop Sprint)
-- Derived memory remains a fallback when no events exist.

CREATE TABLE IF NOT EXISTS executive_memory_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL
    CHECK (event_type IN (
      'approved',
      'rejected',
      'executed',
      'measured',
      'milestone',
      'learned'
    )),
  title TEXT NOT NULL,
  context_message TEXT,
  recommendation_id UUID REFERENCES recommendations(id) ON DELETE SET NULL,
  estimated_impact_monthly NUMERIC,
  measured_impact_monthly NUMERIC,
  outcome_rating TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_executive_memory_store_occurred
  ON executive_memory_events (store_id, occurred_at DESC);

CREATE INDEX IF NOT EXISTS idx_executive_memory_store_type
  ON executive_memory_events (store_id, event_type, occurred_at DESC);
