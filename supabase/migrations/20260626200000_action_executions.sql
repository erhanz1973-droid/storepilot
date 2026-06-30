-- Action execution audit log (Approve → Execute)

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
