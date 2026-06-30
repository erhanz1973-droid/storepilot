-- StorePilot AI — production SaaS foundation
-- Run in Supabase SQL editor or via CLI

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ---------------------------------------------------------------------------
-- stores
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS stores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  shopify_domain TEXT,
  timezone TEXT NOT NULL DEFAULT 'UTC',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- users
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT,
  role TEXT NOT NULL DEFAULT 'owner' CHECK (role IN ('owner', 'admin', 'member')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (store_id, email)
);

-- ---------------------------------------------------------------------------
-- recommendations
-- ---------------------------------------------------------------------------
CREATE TYPE recommendation_status AS ENUM (
  'pending',
  'approved',
  'ignored',
  'snoozed',
  'completed'
);

CREATE TABLE IF NOT EXISTS recommendations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  dedupe_key TEXT NOT NULL,
  category TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  priority TEXT NOT NULL CHECK (priority IN ('critical', 'high', 'medium', 'low')),
  expected_impact TEXT NOT NULL,
  confidence_score NUMERIC(4, 3) NOT NULL CHECK (confidence_score >= 0 AND confidence_score <= 1),
  action_label TEXT NOT NULL DEFAULT 'Review',
  entity_type TEXT,
  entity_id TEXT,
  evidence JSONB NOT NULL DEFAULT '[]'::jsonb,
  actions JSONB NOT NULL DEFAULT '[]'::jsonb,
  status recommendation_status NOT NULL DEFAULT 'pending',
  snoozed_until TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  approved_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (store_id, dedupe_key)
);

CREATE INDEX IF NOT EXISTS idx_recommendations_store_status
  ON recommendations (store_id, status);
CREATE INDEX IF NOT EXISTS idx_recommendations_store_category
  ON recommendations (store_id, category);
CREATE INDEX IF NOT EXISTS idx_recommendations_store_priority
  ON recommendations (store_id, priority);

-- ---------------------------------------------------------------------------
-- approvals (decision audit trail)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS approvals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recommendation_id UUID NOT NULL REFERENCES recommendations(id) ON DELETE CASCADE,
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  status recommendation_status NOT NULL,
  note TEXT,
  snoozed_until TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_approvals_recommendation
  ON approvals (recommendation_id, created_at DESC);

-- ---------------------------------------------------------------------------
-- recommendation_history (status transitions)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS recommendation_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recommendation_id UUID NOT NULL REFERENCES recommendations(id) ON DELETE CASCADE,
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  from_status recommendation_status,
  to_status recommendation_status NOT NULL,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_recommendation_history_rec
  ON recommendation_history (recommendation_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_recommendation_history_store
  ON recommendation_history (store_id, created_at DESC);

-- ---------------------------------------------------------------------------
-- connectors
-- ---------------------------------------------------------------------------
CREATE TYPE connector_health AS ENUM ('connected', 'demo', 'disconnected', 'error');

CREATE TABLE IF NOT EXISTS connectors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  connector_type TEXT NOT NULL,
  label TEXT NOT NULL,
  status connector_health NOT NULL DEFAULT 'disconnected',
  config JSONB NOT NULL DEFAULT '{}'::jsonb,
  last_sync_at TIMESTAMPTZ,
  connected_at TIMESTAMPTZ,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (store_id, connector_type)
);

-- ---------------------------------------------------------------------------
-- daily_snapshots
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS daily_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  snapshot_date DATE NOT NULL DEFAULT CURRENT_DATE,
  health_score INTEGER NOT NULL CHECK (health_score >= 0 AND health_score <= 100),
  health_breakdown JSONB NOT NULL DEFAULT '{}'::jsonb,
  brief_summary JSONB,
  snapshot_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (store_id, snapshot_date)
);

-- ---------------------------------------------------------------------------
-- seed demo store (idempotent)
-- ---------------------------------------------------------------------------
INSERT INTO stores (id, name, shopify_domain)
VALUES (
  '00000000-0000-4000-8000-000000000001',
  'Demo Skincare Store',
  'demo-skincare.myshopify.com'
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO users (store_id, email, full_name, role)
SELECT
  '00000000-0000-4000-8000-000000000001',
  'owner@storepilot.demo',
  'Demo Owner',
  'owner'
WHERE NOT EXISTS (
  SELECT 1 FROM users
  WHERE store_id = '00000000-0000-4000-8000-000000000001'
    AND email = 'owner@storepilot.demo'
);

-- updated_at trigger
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_stores_updated_at ON stores;
CREATE TRIGGER trg_stores_updated_at
  BEFORE UPDATE ON stores FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_recommendations_updated_at ON recommendations;
CREATE TRIGGER trg_recommendations_updated_at
  BEFORE UPDATE ON recommendations FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_connectors_updated_at ON connectors;
CREATE TRIGGER trg_connectors_updated_at
  BEFORE UPDATE ON connectors FOR EACH ROW EXECUTE FUNCTION set_updated_at();
