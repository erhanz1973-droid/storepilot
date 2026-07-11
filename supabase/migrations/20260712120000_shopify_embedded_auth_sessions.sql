-- Embedded Shopify auth (Phase 1): transient OAuth/online sessions.
-- Offline access tokens remain in shopify_installations (single source of truth).

CREATE TABLE IF NOT EXISTS shopify_auth_sessions (
  id TEXT PRIMARY KEY,
  shop TEXT NOT NULL,
  session_json JSONB NOT NULL,
  is_online BOOLEAN NOT NULL DEFAULT false,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_shopify_auth_sessions_shop
  ON shopify_auth_sessions (shop);

CREATE INDEX IF NOT EXISTS idx_shopify_auth_sessions_expires
  ON shopify_auth_sessions (expires_at)
  WHERE expires_at IS NOT NULL;

DROP TRIGGER IF EXISTS trg_shopify_auth_sessions_updated_at ON shopify_auth_sessions;
CREATE TRIGGER trg_shopify_auth_sessions_updated_at
  BEFORE UPDATE ON shopify_auth_sessions
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE shopify_installations
  ADD COLUMN IF NOT EXISTS refresh_token_encrypted TEXT,
  ADD COLUMN IF NOT EXISTS refresh_token_expires_at TIMESTAMPTZ;
