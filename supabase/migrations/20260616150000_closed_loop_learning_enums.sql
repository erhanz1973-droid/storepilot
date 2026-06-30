-- Step 1: Add lifecycle enum values (must commit before use in indexes/constraints)
-- Run this migration first; the next migration uses these values.

ALTER TYPE recommendation_status ADD VALUE IF NOT EXISTS 'implemented';
ALTER TYPE recommendation_status ADD VALUE IF NOT EXISTS 'measured';
