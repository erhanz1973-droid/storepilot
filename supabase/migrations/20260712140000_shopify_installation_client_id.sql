-- Track which Shopify Partner app (client_id / API key) issued the stored access token.

ALTER TABLE shopify_installations
  ADD COLUMN IF NOT EXISTS client_id TEXT;

CREATE INDEX IF NOT EXISTS idx_shopify_installations_client_id
  ON shopify_installations (client_id)
  WHERE client_id IS NOT NULL;
