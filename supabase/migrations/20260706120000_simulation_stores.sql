-- Phase 4.2 — Persistent Simulation Stores
-- Isolated QA stores that behave like real merchants but never touch production data.

ALTER TABLE stores
  ADD COLUMN IF NOT EXISTS is_simulation BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_stores_is_simulation ON stores (is_simulation)
  WHERE is_simulation = true;

CREATE TABLE IF NOT EXISTS simulation_stores (
  store_id UUID PRIMARY KEY REFERENCES stores(id) ON DELETE CASCADE,
  slug TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL,
  scenario_id TEXT NOT NULL,
  business_model TEXT NOT NULL DEFAULT 'own_inventory',
  simulated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  generated_at TIMESTAMPTZ,
  seed_params JSONB NOT NULL DEFAULT '{}'::jsonb,
  meta JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_simulation_stores_slug ON simulation_stores (slug);

-- ---------------------------------------------------------------------------
-- Seed permanent simulation stores (8001 namespace — never overlaps demo 8000)
-- ---------------------------------------------------------------------------
INSERT INTO stores (id, name, shopify_domain, is_simulation)
VALUES
  ('00000000-0000-4000-8001-000000000010', 'Simulation — Healthy Store', 'healthy.simulation.local', true),
  ('00000000-0000-4000-8001-000000000001', 'Simulation — Dead Inventory', 'inventory.simulation.local', true),
  ('00000000-0000-4000-8001-000000000011', 'Simulation — Advertising Disaster', 'roas.simulation.local', true),
  ('00000000-0000-4000-8001-000000000002', 'Simulation — Dropshipping', 'dropship.simulation.local', true),
  ('00000000-0000-4000-8001-000000000012', 'Simulation — Scaling Opportunity', 'scaling.simulation.local', true),
  ('00000000-0000-4000-8001-000000000003', 'Simulation — Subscription Business', 'subscription.simulation.local', true),
  ('00000000-0000-4000-8001-000000000005', 'Simulation — Digital Products', 'digital.simulation.local', true)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  shopify_domain = EXCLUDED.shopify_domain,
  is_simulation = true;

INSERT INTO simulation_stores (store_id, slug, label, scenario_id, business_model)
VALUES
  ('00000000-0000-4000-8001-000000000010', 'simulation_healthy', 'Healthy Store', 'healthy_store', 'own_inventory'),
  ('00000000-0000-4000-8001-000000000001', 'simulation_inventory', 'Dead Inventory Store', 'dead_inventory', 'own_inventory'),
  ('00000000-0000-4000-8001-000000000011', 'simulation_roas', 'Advertising Disaster', 'roas_collapse', 'dropshipping'),
  ('00000000-0000-4000-8001-000000000002', 'simulation_dropshipping', 'Dropshipping Store', 'winning_product', 'dropshipping'),
  ('00000000-0000-4000-8001-000000000012', 'simulation_scaling', 'Scaling Opportunity', 'scaling_opportunity', 'own_inventory'),
  ('00000000-0000-4000-8001-000000000003', 'simulation_subscription', 'Subscription Business', 'subscription_churn', 'subscription'),
  ('00000000-0000-4000-8001-000000000005', 'simulation_digital', 'Digital Products', 'organic_growth', 'digital_products')
ON CONFLICT (store_id) DO UPDATE SET
  slug = EXCLUDED.slug,
  label = EXCLUDED.label,
  scenario_id = EXCLUDED.scenario_id,
  business_model = EXCLUDED.business_model,
  updated_at = now();
