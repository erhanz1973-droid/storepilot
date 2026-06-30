-- Phase 1: merchant-editable unit costs (COGS) per Shopify product
create table if not exists product_costs (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references stores(id) on delete cascade,
  shopify_product_id text not null,
  unit_cost numeric(12, 2) not null check (unit_cost >= 0),
  source text not null default 'manual' check (source in ('manual', 'shopify', 'csv_import')),
  updated_at timestamptz not null default now(),
  unique (store_id, shopify_product_id)
);

create index if not exists product_costs_store_id_idx on product_costs(store_id);

alter table product_costs enable row level security;
