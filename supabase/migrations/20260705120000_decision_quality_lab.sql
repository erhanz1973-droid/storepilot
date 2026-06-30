-- Phase 5 — Decision Quality Lab persistence

CREATE TABLE IF NOT EXISTS decision_quality_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  decision_id TEXT NOT NULL,
  run_id UUID,
  scenario_id TEXT,
  business_model TEXT,
  problem_key TEXT,
  summary TEXT NOT NULL,
  category TEXT,
  overall_quality_pct NUMERIC(5,2) NOT NULL,
  validation_quality_pct NUMERIC(5,2),
  explainability_pct NUMERIC(5,2),
  business_logic_pct NUMERIC(5,2),
  strategy_comparison_pct NUMERIC(5,2),
  evidence_completeness_pct NUMERIC(5,2),
  intent_match_pct NUMERIC(5,2),
  business_model_compliance_pct NUMERIC(5,2),
  confidence_pct NUMERIC(5,2),
  detected_intents JSONB NOT NULL DEFAULT '[]',
  self_assessment JSONB,
  breakdown JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_decision_quality_scores_store_created
  ON decision_quality_scores (store_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_decision_quality_scores_run
  ON decision_quality_scores (run_id) WHERE run_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS decision_intent_evaluations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID NOT NULL,
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  scenario_id TEXT,
  business_model TEXT,
  expected_intent TEXT NOT NULL,
  actual_intents JSONB NOT NULL DEFAULT '[]',
  verdict TEXT NOT NULL CHECK (verdict IN ('pass', 'warn', 'fail')),
  matched_decision_summary TEXT,
  confidence_pct NUMERIC(5,2),
  quality_score_pct NUMERIC(5,2),
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_decision_intent_evaluations_run
  ON decision_intent_evaluations (run_id, created_at DESC);

CREATE TABLE IF NOT EXISTS decision_quality_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_type TEXT NOT NULL CHECK (run_type IN ('simulation', 'regression', 'monte_carlo', 'replay', 'release_gate')),
  release_version TEXT,
  scenario_id TEXT,
  business_model TEXT,
  store_id UUID REFERENCES stores(id) ON DELETE SET NULL,
  verdict TEXT NOT NULL CHECK (verdict IN ('pass', 'warn', 'fail')),
  accuracy_pct NUMERIC(5,2),
  avg_quality_pct NUMERIC(5,2),
  avg_confidence_pct NUMERIC(5,2),
  avg_explainability_pct NUMERIC(5,2),
  avg_validation_pct NUMERIC(5,2),
  pass_count INTEGER NOT NULL DEFAULT 0,
  warn_count INTEGER NOT NULL DEFAULT 0,
  fail_count INTEGER NOT NULL DEFAULT 0,
  forbidden_hits JSONB NOT NULL DEFAULT '[]',
  drift_flags JSONB NOT NULL DEFAULT '[]',
  performance JSONB NOT NULL DEFAULT '{}',
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_decision_quality_runs_type_created
  ON decision_quality_runs (run_type, created_at DESC);

CREATE TABLE IF NOT EXISTS decision_quality_benchmarks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  release_version TEXT NOT NULL,
  accuracy_pct NUMERIC(5,2) NOT NULL,
  pass_count INTEGER NOT NULL DEFAULT 0,
  warn_count INTEGER NOT NULL DEFAULT 0,
  fail_count INTEGER NOT NULL DEFAULT 0,
  avg_confidence_pct NUMERIC(5,2),
  avg_explainability_pct NUMERIC(5,2),
  avg_validation_pct NUMERIC(5,2),
  avg_quality_pct NUMERIC(5,2),
  leaderboard JSONB NOT NULL DEFAULT '[]',
  thresholds JSONB NOT NULL DEFAULT '{}',
  gate_passed BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_decision_quality_benchmarks_version
  ON decision_quality_benchmarks (release_version);

CREATE TABLE IF NOT EXISTS decision_drift_baselines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scenario_id TEXT NOT NULL,
  business_model TEXT NOT NULL,
  expected_intents JSONB NOT NULL DEFAULT '[]',
  sample_decision_summary TEXT,
  release_version TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (scenario_id, business_model)
);
