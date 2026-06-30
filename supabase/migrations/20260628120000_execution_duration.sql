-- Add execution duration to audit log for pipeline observability

ALTER TABLE action_executions
  ADD COLUMN IF NOT EXISTS duration_ms INTEGER;
