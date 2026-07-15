-- Alpha first-run funnel events (product analytics, not merchant dashboards)

CREATE TABLE IF NOT EXISTS alpha_funnel_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  event TEXT NOT NULL,
  props JSONB NOT NULL DEFAULT '{}'::jsonb,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_alpha_funnel_store_event_occurred
  ON alpha_funnel_events (store_id, event, occurred_at DESC);

CREATE INDEX IF NOT EXISTS idx_alpha_funnel_event_occurred
  ON alpha_funnel_events (event, occurred_at DESC);
