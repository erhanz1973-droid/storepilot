-- Meta Ads OAuth: pending sessions + per-store ad account installations

CREATE TYPE meta_ads_install_status AS ENUM ('active', 'disconnected', 'error');

CREATE TABLE IF NOT EXISTS meta_oauth_pending (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  meta_user_id TEXT NOT NULL,
  meta_user_name TEXT,
  access_token_encrypted TEXT NOT NULL,
  token_expires_at TIMESTAMPTZ,
  scopes TEXT[] NOT NULL DEFAULT '{}',
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_meta_oauth_pending_store
  ON meta_oauth_pending (store_id);
CREATE INDEX IF NOT EXISTS idx_meta_oauth_pending_expires
  ON meta_oauth_pending (expires_at);

CREATE TABLE IF NOT EXISTS meta_ads_installations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  meta_user_id TEXT NOT NULL,
  meta_user_name TEXT,
  business_id TEXT NOT NULL,
  business_name TEXT,
  ad_account_id TEXT NOT NULL,
  ad_account_name TEXT,
  access_token_encrypted TEXT NOT NULL,
  token_expires_at TIMESTAMPTZ,
  scopes TEXT[] NOT NULL DEFAULT '{}',
  status meta_ads_install_status NOT NULL DEFAULT 'active',
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
  UNIQUE (store_id, ad_account_id)
);

CREATE INDEX IF NOT EXISTS idx_meta_ads_installations_store
  ON meta_ads_installations (store_id);
CREATE INDEX IF NOT EXISTS idx_meta_ads_installations_status
  ON meta_ads_installations (status) WHERE status = 'active';

DROP TRIGGER IF EXISTS trg_meta_ads_installations_updated_at ON meta_ads_installations;
CREATE TRIGGER trg_meta_ads_installations_updated_at
  BEFORE UPDATE ON meta_ads_installations FOR EACH ROW EXECUTE FUNCTION set_updated_at();
