-- Phase 4 — Merchant DNA & Adaptive AI

CREATE TYPE growth_stage AS ENUM (
  'startup',
  'growing',
  'scaling',
  'mature',
  'declining'
);

CREATE TYPE traffic_mix AS ENUM (
  'meta_first',
  'google_first',
  'organic_first',
  'email_first',
  'marketplace_first',
  'tiktok_first',
  'hybrid'
);

CREATE TYPE product_dna AS ENUM (
  'single_product',
  'hero_product',
  'general_store',
  'large_catalog',
  'luxury',
  'low_ticket',
  'high_ticket',
  'subscription',
  'seasonal'
);

CREATE TYPE merchant_personality AS ENUM ('aggressive', 'conservative', 'balanced');

CREATE TYPE automation_preference AS ENUM (
  'manual',
  'approval_required',
  'semi_automatic',
  'full_autopilot'
);

CREATE TYPE risk_tolerance AS ENUM ('low', 'medium', 'high');

CREATE TABLE IF NOT EXISTS merchant_dna_profiles (
  store_id UUID PRIMARY KEY REFERENCES stores(id) ON DELETE CASCADE,
  dna_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  manual_overrides JSONB NOT NULL DEFAULT '{}'::jsonb,
  learned_signals JSONB NOT NULL DEFAULT '{}'::jsonb,
  benchmark_cohort TEXT,
  version INT NOT NULL DEFAULT 1,
  inferred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_merchant_dna_cohort
  ON merchant_dna_profiles (benchmark_cohort);
