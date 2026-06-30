-- Phase 2: Recommendation Intelligence & Outcome Tracking

-- Extend recommendations with validation + intelligence fields
ALTER TABLE recommendations
  ADD COLUMN IF NOT EXISTS validation_score NUMERIC(5, 2),
  ADD COLUMN IF NOT EXISTS ai_confidence NUMERIC(4, 3),
  ADD COLUMN IF NOT EXISTS validation_confidence NUMERIC(4, 3),
  ADD COLUMN IF NOT EXISTS estimated_revenue_gain NUMERIC(12, 2),
  ADD COLUMN IF NOT EXISTS estimated_cost_saving NUMERIC(12, 2),
  ADD COLUMN IF NOT EXISTS lifecycle_stage TEXT NOT NULL DEFAULT 'created'
    CHECK (lifecycle_stage IN (
      'created', 'displayed', 'approved', 'rejected', 'snoozed',
      'executed', 'observing', 'measured', 'closed'
    )),
  ADD COLUMN IF NOT EXISTS displayed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS rejected_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS executed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS closed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS reason_detail TEXT,
  ADD COLUMN IF NOT EXISTS validation_evidence JSONB NOT NULL DEFAULT '[]'::jsonb;

CREATE INDEX IF NOT EXISTS idx_recommendations_lifecycle
  ON recommendations (store_id, lifecycle_stage, created_at DESC);

-- Merchant decisions (Approve / Reject / Later)
CREATE TABLE IF NOT EXISTS recommendation_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recommendation_id UUID NOT NULL REFERENCES recommendations(id) ON DELETE CASCADE,
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('pending', 'approved', 'rejected', 'executed', 'expired', 'snoozed')),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  user_label TEXT NOT NULL DEFAULT 'Merchant',
  note TEXT,
  approved_at TIMESTAMPTZ,
  rejected_at TIMESTAMPTZ,
  executed_at TIMESTAMPTZ,
  snoozed_until TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_recommendation_actions_rec
  ON recommendation_actions (recommendation_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_recommendation_actions_store_status
  ON recommendation_actions (store_id, status, created_at DESC);

-- Full lifecycle timeline (audit trail)
CREATE TABLE IF NOT EXISTS recommendation_lifecycle_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recommendation_id UUID NOT NULL REFERENCES recommendations(id) ON DELETE CASCADE,
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL CHECK (event_type IN (
    'created', 'displayed', 'approved', 'rejected', 'snoozed',
    'executed', 'observation_started', 'outcome_measured', 'closed', 'expired'
  )),
  label TEXT NOT NULL,
  detail TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_lifecycle_events_rec
  ON recommendation_lifecycle_events (recommendation_id, created_at ASC);

CREATE INDEX IF NOT EXISTS idx_lifecycle_events_store
  ON recommendation_lifecycle_events (store_id, created_at DESC);

-- Structured outcome measurements (before/after)
CREATE TABLE IF NOT EXISTS recommendation_outcome_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recommendation_id UUID NOT NULL REFERENCES recommendations(id) ON DELETE CASCADE,
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  outcome_record_id UUID REFERENCES outcome_records(id) ON DELETE SET NULL,
  measurement_start TIMESTAMPTZ NOT NULL,
  measurement_end TIMESTAMPTZ NOT NULL,
  observation_days INTEGER NOT NULL DEFAULT 7,
  revenue_before NUMERIC(14, 2),
  revenue_after NUMERIC(14, 2),
  profit_before NUMERIC(14, 2),
  profit_after NUMERIC(14, 2),
  roas_before NUMERIC(8, 4),
  roas_after NUMERIC(8, 4),
  conversion_before NUMERIC(8, 4),
  conversion_after NUMERIC(8, 4),
  aov_before NUMERIC(12, 2),
  aov_after NUMERIC(12, 2),
  traffic_before NUMERIC(14, 2),
  traffic_after NUMERIC(14, 2),
  success BOOLEAN,
  revenue_delta_pct NUMERIC(8, 2),
  roas_delta_pct NUMERIC(8, 2),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_outcome_metrics_rec
  ON recommendation_outcome_metrics (recommendation_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_outcome_metrics_store
  ON recommendation_outcome_metrics (store_id, created_at DESC);

-- Aggregated success rates by recommendation type
CREATE TABLE IF NOT EXISTS recommendation_type_stats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID REFERENCES stores(id) ON DELETE CASCADE,
  category TEXT NOT NULL,
  success_rate_pct NUMERIC(5, 2) NOT NULL DEFAULT 0,
  avg_revenue_improvement_pct NUMERIC(8, 2) NOT NULL DEFAULT 0,
  avg_roas_improvement_pct NUMERIC(8, 2) NOT NULL DEFAULT 0,
  evaluated_count INTEGER NOT NULL DEFAULT 0,
  approved_count INTEGER NOT NULL DEFAULT 0,
  rejected_count INTEGER NOT NULL DEFAULT 0,
  executed_count INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (store_id, category)
);

CREATE INDEX IF NOT EXISTS idx_type_stats_category
  ON recommendation_type_stats (category, evaluated_count DESC);

-- AI learning dataset (structured records for future ML)
CREATE TABLE IF NOT EXISTS recommendation_learning_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  recommendation_id UUID REFERENCES recommendations(id) ON DELETE SET NULL,
  category TEXT NOT NULL,
  industry TEXT,
  store_size TEXT,
  confidence NUMERIC(4, 3),
  validation_score NUMERIC(5, 2),
  approved BOOLEAN NOT NULL DEFAULT false,
  successful BOOLEAN,
  revenue_impact_pct NUMERIC(8, 2),
  roas_impact_pct NUMERIC(8, 2),
  profit_impact_pct NUMERIC(8, 2),
  observation_days INTEGER,
  evidence JSONB NOT NULL DEFAULT '[]'::jsonb,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_learning_records_store
  ON recommendation_learning_records (store_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_learning_records_category
  ON recommendation_learning_records (category, successful);
