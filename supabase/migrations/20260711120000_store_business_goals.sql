-- Store-level business goals for goal-aware decision engine

CREATE TYPE business_goal AS ENUM (
  'increase_revenue',
  'increase_profit',
  'acquire_new_customers',
  'increase_returning_customers',
  'build_brand_awareness',
  'launch_new_product',
  'clear_inventory',
  'grow_email_list'
);

CREATE TABLE IF NOT EXISTS store_business_goals (
  store_id UUID PRIMARY KEY REFERENCES stores(id) ON DELETE CASCADE,
  goals business_goal[] NOT NULL DEFAULT ARRAY['increase_revenue']::business_goal[],
  primary_goal business_goal NOT NULL DEFAULT 'increase_revenue',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_store_business_goals_primary
  ON store_business_goals (primary_goal);

DROP TRIGGER IF EXISTS trg_store_business_goals_updated_at ON store_business_goals;
CREATE TRIGGER trg_store_business_goals_updated_at
  BEFORE UPDATE ON store_business_goals
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

INSERT INTO store_business_goals (store_id, goals, primary_goal)
VALUES (
  '00000000-0000-4000-8000-000000000001',
  ARRAY['increase_revenue', 'build_brand_awareness']::business_goal[],
  'increase_revenue'
)
ON CONFLICT (store_id) DO NOTHING;
