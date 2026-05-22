-- Fix field_activity and staff_accounts schema.
--
-- The original add_field_operations.sql declared officer_id as UUID but
-- staff_accounts.id is TEXT, causing a FK type mismatch that prevented the
-- migration from running at all.  When that migration fails, the columns
-- current_field_status / last_location_lat / last_location_lng /
-- last_status_update are never added to staff_accounts, so every query that
-- selects them returns an error and officers appear empty everywhere.
--
-- Run this instead of (or after) add_field_operations.sql.

-- 1. Add the field-status columns to staff_accounts (safe to run multiple times)
ALTER TABLE staff_accounts
  ADD COLUMN IF NOT EXISTS current_field_status  TEXT        DEFAULT 'Off Duty',
  ADD COLUMN IF NOT EXISTS last_location_lat     NUMERIC(10, 7),
  ADD COLUMN IF NOT EXISTS last_location_lng     NUMERIC(10, 7),
  ADD COLUMN IF NOT EXISTS last_status_update    TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS tracking_active       BOOLEAN     DEFAULT false;

-- 2. Drop the broken field_activity table if it was partially created
DROP TABLE IF EXISTS field_activity CASCADE;

-- 3. Re-create field_activity with officer_id as TEXT to match staff_accounts.id
CREATE TABLE IF NOT EXISTS field_activity (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  officer_id        TEXT        NOT NULL REFERENCES staff_accounts(id) ON DELETE CASCADE,
  officer_name      TEXT        NOT NULL,
  officer_badge     TEXT,
  status            TEXT        NOT NULL,
  location_lat      NUMERIC(10, 7),
  location_lng      NUMERIC(10, 7),
  location_label    TEXT,
  call_id           TEXT,
  call_number       TEXT,
  notes             TEXT,
  mileage_start     NUMERIC(8, 1),
  mileage_end       NUMERIC(8, 1),
  recorded_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_field_activity_officer_id  ON field_activity(officer_id);
CREATE INDEX IF NOT EXISTS idx_field_activity_recorded_at ON field_activity(recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_field_activity_status      ON field_activity(status);

-- 4. RLS — allow_all to match the rest of the codebase (app handles auth client-side)
ALTER TABLE field_activity ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "field_activity_select" ON field_activity;
DROP POLICY IF EXISTS "field_activity_insert" ON field_activity;
DROP POLICY IF EXISTS "field_activity_update" ON field_activity;

CREATE POLICY allow_all_field_activity ON field_activity
  FOR ALL USING (true) WITH CHECK (true);
