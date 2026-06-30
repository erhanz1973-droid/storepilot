-- Google Ads OAuth: pending sessions + per-store customer installations

CREATE TYPE google_ads_install_status AS ENUM ('active', 'disconnected', 'error');

CREATE TABLE IF NOT EXISTS google_oauth_pending (
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

CREATE INDEX IF NOT EXISTS idx_google_oauth_pending_store
  ON google_oauth_pending (store_id);
CREATE INDEX IF NOT EXISTS idx_google_oauth_pending_expires
  ON google_oauth_pending (expires_at);

CREATE TABLE IF NOT EXISTS google_ads_installations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  google_user_id TEXT NOT NULL,
  google_user_email TEXT,
  customer_id TEXT NOT NULL,
  customer_name TEXT,
  access_token_encrypted TEXT NOT NULL,
  refresh_token_encrypted TEXT NOT NULL,
  token_expires_at TIMESTAMPTZ,
  scopes TEXT[] NOT NULL DEFAULT '{}',
  status google_ads_install_status NOT NULL DEFAULT 'active',
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
  UNIQUE (store_id, customer_id)
);

CREATE INDEX IF NOT EXISTS idx_google_ads_installations_store
  ON google_ads_installations (store_id);
CREATE INDEX IF NOT EXISTS idx_google_ads_installations_status
  ON google_ads_installations (status) WHERE status = 'active';

DROP TRIGGER IF EXISTS trg_google_ads_installations_updated_at ON google_ads_installations;
CREATE TRIGGER trg_google_ads_installations_updated_at
  BEFORE UPDATE ON google_ads_installations FOR EACH ROW EXECUTE FUNCTION set_updated_at();
