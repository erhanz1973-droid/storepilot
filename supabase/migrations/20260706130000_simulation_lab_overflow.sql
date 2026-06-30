-- Overflow simulation store for seed library scenarios without a dedicated permanent store.

INSERT INTO stores (id, name, shopify_domain, is_simulation)
VALUES
  ('00000000-0000-4000-8001-000000000099', 'Simulation — Lab Overflow', 'lab.simulation.local', true)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  shopify_domain = EXCLUDED.shopify_domain,
  is_simulation = true;

INSERT INTO simulation_stores (store_id, slug, label, scenario_id, business_model)
VALUES
  ('00000000-0000-4000-8001-000000000099', 'simulation_lab', 'Simulation Lab (overflow)', 'healthy_store', 'own_inventory')
ON CONFLICT (store_id) DO UPDATE SET
  slug = EXCLUDED.slug,
  label = EXCLUDED.label,
  updated_at = now();
