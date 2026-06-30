-- Outcome tracking: measure business impact after approved actions
-- Depends on action_executions — created here if that migration was not run yet.

CREATE TABLE IF NOT EXISTS action_executions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  decision_id TEXT,
  recommendation_id UUID,
  opportunity_key TEXT,
  action_type TEXT NOT NULL,
  platform TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  entity_name TEXT NOT NULL,
  execution_mode TEXT NOT NULL CHECK (execution_mode IN ('dry_run', 'live')),
  status TEXT NOT NULL CHECK (status IN ('validated', 'ready', 'success', 'failed', 'skipped')),
  approved_by TEXT NOT NULL DEFAULT 'Merchant',
  request_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  response_payload JSONB,
  error_message TEXT,
  executed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_action_executions_store_executed
  ON action_executions (store_id, executed_at DESC);

CREATE INDEX IF NOT EXISTS idx_action_executions_entity
  ON action_executions (store_id, entity_id, action_type);

DO $$ BEGIN
  CREATE TYPE outcome_rating AS ENUM ('successful', 'neutral', 'needs_improvement');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE outcome_measure_status AS ENUM ('scheduled', 'completed', 'failed', 'skipped');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS outcome_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  recommendation_id UUID REFERENCES recommendations(id) ON DELETE SET NULL,
  action_execution_id UUID REFERENCES action_executions(id) ON DELETE SET NULL,
  opportunity_key TEXT,
  decision_id TEXT,
  title TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'promotion_opportunity',
  action_type TEXT,
  entity_type TEXT,
  entity_id TEXT,
  entity_name TEXT,
  baseline_captured_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  measure_due_at TIMESTAMPTZ NOT NULL,
  measured_at TIMESTAMPTZ,
  measurement_window_days INTEGER NOT NULL DEFAULT 7,
  measure_status outcome_measure_status NOT NULL DEFAULT 'scheduled',
  expected_monthly_impact NUMERIC(12, 2) NOT NULL DEFAULT 0,
  actual_monthly_impact NUMERIC(12, 2),
  prediction_accuracy NUMERIC(5, 2),
  outcome_rating outcome_rating,
  confidence_label TEXT,
  baseline_metrics JSONB NOT NULL DEFAULT '{}'::jsonb,
  outcome_metrics JSONB,
  kpi_deltas JSONB,
  outcome_summary TEXT,
  ai_verdict TEXT,
  score_breakdown JSONB NOT NULL DEFAULT '{}'::jsonb,
  failure_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_outcome_records_store_due
  ON outcome_records (store_id, measure_due_at)
  WHERE measure_status = 'scheduled';

CREATE INDEX IF NOT EXISTS idx_outcome_records_store_measured
  ON outcome_records (store_id, measured_at DESC)
  WHERE measure_status = 'completed';

CREATE INDEX IF NOT EXISTS idx_outcome_records_opportunity
  ON outcome_records (store_id, opportunity_key)
  WHERE opportunity_key IS NOT NULL;
