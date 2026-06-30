-- Phase 8-15: Opportunity history, learning fatigue, enhanced snapshots

-- Opportunity lifecycle tracking
CREATE TABLE IF NOT EXISTS opportunity_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  opportunity_key TEXT NOT NULL,
  title TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'general',
  status TEXT NOT NULL DEFAULT 'detected'
    CHECK (status IN ('detected', 'viewed', 'ignored', 'resolved', 'expired')),
  estimated_monthly_revenue NUMERIC(12, 2) NOT NULL DEFAULT 0,
  estimated_monthly_profit NUMERIC(12, 2) NOT NULL DEFAULT 0,
  confidence_pct INTEGER NOT NULL DEFAULT 0,
  ignore_count INTEGER NOT NULL DEFAULT 0,
  detected_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  viewed_at TIMESTAMPTZ,
  resolved_at TIMESTAMPTZ,
  expired_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (store_id, opportunity_key)
);

CREATE INDEX IF NOT EXISTS idx_opportunity_history_store_status
  ON opportunity_history (store_id, status, detected_at DESC);

CREATE INDEX IF NOT EXISTS idx_opportunity_history_store_detected
  ON opportunity_history (store_id, detected_at DESC);

-- Recommendation fatigue tracking
ALTER TABLE recommendations
  ADD COLUMN IF NOT EXISTS ignore_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_ignored_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS suppressed_until TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS positive_outcome_count INTEGER NOT NULL DEFAULT 0;

-- Enhanced daily snapshot factor scores for health score deltas
ALTER TABLE daily_snapshots
  ADD COLUMN IF NOT EXISTS factor_scores JSONB NOT NULL DEFAULT '{}'::jsonb;
