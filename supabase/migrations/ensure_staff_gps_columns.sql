-- Ensure all GPS / field-status columns exist on staff_accounts.
-- These were added by add_field_operations.sql and add_location_history.sql,
-- but those migrations may not have run if the UUID type-mismatch caused
-- add_field_operations.sql to fail.  This migration is fully idempotent.

ALTER TABLE staff_accounts
  ADD COLUMN IF NOT EXISTS current_field_status  TEXT        DEFAULT 'Off Duty',
  ADD COLUMN IF NOT EXISTS last_location_lat     NUMERIC(10, 7),
  ADD COLUMN IF NOT EXISTS last_location_lng     NUMERIC(10, 7),
  ADD COLUMN IF NOT EXISTS last_status_update    TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS tracking_active       BOOLEAN     DEFAULT false;

-- Handy index so the Field Ops map query is fast
CREATE INDEX IF NOT EXISTS idx_staff_accounts_field_status
  ON staff_accounts (current_field_status)
  WHERE active = true;
