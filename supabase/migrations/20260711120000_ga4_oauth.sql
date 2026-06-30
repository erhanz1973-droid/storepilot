-- GA4 OAuth: pending sessions + per-store property installations + sync cache

CREATE TYPE ga4_install_status AS ENUM ('active', 'disconnected', 'error');

CREATE TABLE IF NOT EXISTS ga4_oauth_pending (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  google_user_id TEXT NOT NULL,
  google_user_email TEXT,
  access_token_encrypted TEXT NOT NULL,
  refresh_token_encrypted TEXT NOT NULL,
  token_expires_at TIMESTAMPTZ,
  scopes TEXT[] NOT NULL DEFAULT '{}',
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ga4_oauth_pending_store ON ga4_oauth_pending (store_id);
CREATE INDEX IF NOT EXISTS idx_ga4_oauth_pending_expires ON ga4_oauth_pending (expires_at);

CREATE TABLE IF NOT EXISTS ga4_installations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  google_user_id TEXT NOT NULL,
  google_user_email TEXT,
  account_id TEXT NOT NULL,
  account_name TEXT,
  property_id TEXT NOT NULL,
  property_name TEXT,
  data_stream_id TEXT,
  data_stream_name TEXT,
  measurement_id TEXT,
  access_token_encrypted TEXT NOT NULL,
  refresh_token_encrypted TEXT NOT NULL,
  token_expires_at TIMESTAMPTZ,
  scopes TEXT[] NOT NULL DEFAULT '{}',
  status ga4_install_status NOT NULL DEFAULT 'active',
  connection_health TEXT NOT NULL DEFAULT 'healthy' CHECK (
    connection_health IN ('healthy', 'degraded', 'error', 'disconnected')
  ),
  error_message TEXT,
  installed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  disconnected_at TIMESTAMPTZ,
  last_sync_at TIMESTAMPTZ,
  sync_stats JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (store_id, property_id)
);

CREATE INDEX IF NOT EXISTS idx_ga4_installations_store ON ga4_installations (store_id);
CREATE INDEX IF NOT EXISTS idx_ga4_installations_status ON ga4_installations (status) WHERE status = 'active';

CREATE TABLE IF NOT EXISTS ga4_sync_cache (
  store_id UUID PRIMARY KEY REFERENCES stores(id) ON DELETE CASCADE,
  snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  sync_window_days INT NOT NULL DEFAULT 30,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS trg_ga4_installations_updated_at ON ga4_installations;
CREATE TRIGGER trg_ga4_installations_updated_at
  BEFORE UPDATE ON ga4_installations FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_ga4_sync_cache_updated_at ON ga4_sync_cache;
CREATE TRIGGER trg_ga4_sync_cache_updated_at
  BEFORE UPDATE ON ga4_sync_cache FOR EACH ROW EXECUTE FUNCTION set_updated_at();
