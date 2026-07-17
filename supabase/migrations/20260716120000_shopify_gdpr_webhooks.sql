-- Optional audit + webhook idempotency for Shopify GDPR / compliance webhooks.
-- Handlers degrade gracefully if these tables are absent.

create table if not exists public.shopify_webhook_deliveries (
  webhook_id text primary key,
  topic text not null,
  shop_domain text,
  processed_at timestamptz not null default now()
);

create index if not exists shopify_webhook_deliveries_processed_at_idx
  on public.shopify_webhook_deliveries (processed_at);

create table if not exists public.shopify_gdpr_requests (
  id uuid primary key default gen_random_uuid(),
  topic text not null,
  shop_domain text not null,
  action text not null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists shopify_gdpr_requests_shop_domain_idx
  on public.shopify_gdpr_requests (shop_domain);

create index if not exists shopify_gdpr_requests_created_at_idx
  on public.shopify_gdpr_requests (created_at);
