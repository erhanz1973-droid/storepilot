-- Recommendation validation audit trail + outcome linkage for closed-loop learning

CREATE TABLE IF NOT EXISTS recommendation_validation_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  recommendation_dedupe_key TEXT NOT NULL,
  recommendation_id UUID REFERENCES recommendations(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'promotion_opportunity',
  ai_confidence NUMERIC(4, 3) NOT NULL DEFAULT 0,
  validation_confidence NUMERIC(4, 3) NOT NULL DEFAULT 0,
  final_confidence NUMERIC(4, 3) NOT NULL DEFAULT 0,
  validation_score NUMERIC(5, 2),
  providers_used JSONB NOT NULL DEFAULT '[]'::jsonb,
  providers_blocked JSONB NOT NULL DEFAULT '[]'::jsonb,
  evidence JSONB NOT NULL DEFAULT '[]'::jsonb,
  calculation_basis JSONB NOT NULL DEFAULT '[]'::jsonb,
  outcome_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (outcome_status IN ('pending', 'approved', 'rejected', 'measured', 'no_outcome')),
  outcome_summary TEXT,
  outcome_metrics JSONB,
  duration_ms INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_rec_validation_audit_store_created
  ON recommendation_validation_audit (store_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_rec_validation_audit_dedupe
  ON recommendation_validation_audit (store_id, recommendation_dedupe_key, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_rec_validation_audit_rec_id
  ON recommendation_validation_audit (recommendation_id)
  WHERE recommendation_id IS NOT NULL;

-- Link outcome_records to validation audit when available
ALTER TABLE outcome_records
  ADD COLUMN IF NOT EXISTS validation_audit_id UUID REFERENCES recommendation_validation_audit(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_outcome_records_validation_audit
  ON outcome_records (validation_audit_id)
  WHERE validation_audit_id IS NOT NULL;
