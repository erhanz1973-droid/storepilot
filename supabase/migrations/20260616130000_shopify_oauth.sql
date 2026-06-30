-- Shopify OAuth installations + sync cache (multi-store)

CREATE TYPE shopify_install_status AS ENUM ('active', 'uninstalled', 'error');

CREATE TABLE IF NOT EXISTS shopify_installations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  shop_domain TEXT NOT NULL,
  access_token_encrypted TEXT NOT NULL,
  scopes TEXT[] NOT NULL DEFAULT '{}',
  shop_name TEXT,
  shopify_plan TEXT,
  status shopify_install_status NOT NULL DEFAULT 'active',
  connection_health TEXT NOT NULL DEFAULT 'healthy' CHECK (
    connection_health IN ('healthy', 'degraded', 'error', 'disconnected')
  ),
  error_message TEXT,
  installed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  uninstalled_at TIMESTAMPTZ,
  last_sync_at TIMESTAMPTZ,
  sync_stats JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (shop_domain)
);

CREATE INDEX IF NOT EXISTS idx_shopify_installations_store
  ON shopify_installations (store_id);
CREATE INDEX IF NOT EXISTS idx_shopify_installations_status
  ON shopify_installations (status) WHERE status = 'active';

CREATE TABLE IF NOT EXISTS shopify_sync_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (store_id)
);

DROP TRIGGER IF EXISTS trg_shopify_installations_updated_at ON shopify_installations;
CREATE TRIGGER trg_shopify_installations_updated_at
  BEFORE UPDATE ON shopify_installations FOR EACH ROW EXECUTE FUNCTION set_updated_at();
