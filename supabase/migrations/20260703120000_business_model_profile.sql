-- Phase 3 — Business Model Aware Decision Engine

CREATE TYPE business_model AS ENUM (
  'own_inventory',
  'dropshipping',
  'private_label',
  'print_on_demand',
  'digital_products',
  'subscription',
  'hybrid'
);

CREATE TYPE business_model_source AS ENUM ('manual', 'detected', 'default');

CREATE TYPE sales_channel AS ENUM (
  'shopify',
  'amazon',
  'etsy',
  'woocommerce',
  'direct',
  'marketplace',
  'other'
);

CREATE TYPE inventory_strategy AS ENUM (
  'tracked',
  'untracked',
  'just_in_time',
  'dropship',
  'digital',
  'mixed'
);

CREATE TABLE IF NOT EXISTS store_business_profiles (
  store_id UUID PRIMARY KEY REFERENCES stores(id) ON DELETE CASCADE,
  business_model business_model NOT NULL DEFAULT 'own_inventory',
  business_model_source business_model_source NOT NULL DEFAULT 'default',
  detected_business_model business_model,
  detection_confidence NUMERIC(5, 2),
  detection_signals JSONB NOT NULL DEFAULT '[]'::jsonb,
  primary_sales_channel sales_channel DEFAULT 'shopify',
  average_order_value NUMERIC(12, 2),
  typical_margin_pct NUMERIC(5, 2),
  inventory_strategy inventory_strategy DEFAULT 'tracked',
  advertising_channels TEXT[] NOT NULL DEFAULT '{}',
  primary_acquisition_channel TEXT,
  hybrid_model_weights JSONB,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_store_business_profiles_model
  ON store_business_profiles (business_model);
