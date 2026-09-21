-- ============================================
-- RoutineX • Weekly Routine Migration
-- Run this in Supabase → SQL Editor → New Query → Run
-- Safe to run multiple times (IF NOT EXISTS)
-- ============================================

-- 1) Add columns for weekly routines (if your table is old)
-- Original table only had: id, username, name, slots (jsonb), is_active, created_at
ALTER TABLE routines ADD COLUMN IF NOT EXISTS weekly_slots JSONB;
ALTER TABLE routines ADD COLUMN IF NOT EXISTS routine_type TEXT DEFAULT 'daily';

-- 2) Add constraint (optional but recommended) - allows only 'daily' | 'weekly'
-- Will fail silently if constraint already exists, so we wrap in DO block
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'routines_routine_type_check') THEN
    ALTER TABLE routines ADD CONSTRAINT routines_routine_type_check CHECK (routine_type IN ('daily','weekly'));
  END IF;
END $$;

-- 3) Backfill existing rows: set daily as default
UPDATE routines SET routine_type = 'daily' WHERE routine_type IS NULL;
UPDATE routines SET weekly_slots = NULL WHERE routine_type = 'daily' AND weekly_slots IS NOT NULL;

-- 4) OPTIONAL: Fix data created BEFORE this migration
-- If you already created weekly routines before running (1), they were stored
-- via fallback as slots = {"sat":[...],"sun":[...]} + localStorage.
-- This moves them to the proper columns:
UPDATE routines
SET weekly_slots = slots,
    slots = '[]'::jsonb,
    routine_type = 'weekly'
WHERE weekly_slots IS NULL
  AND jsonb_typeof(slots) = 'object'
  AND slots ? 'sat';

-- 5) Verify
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'routines'
ORDER BY ordinal_position;

-- Expected result: you should see -> weekly_slots (jsonb) and routine_type (text)
-- Sample check: see one weekly routine
-- SELECT id, name, routine_type, jsonb_typeof(slots), jsonb_typeof(weekly_slots) FROM routines LIMIT 5;
