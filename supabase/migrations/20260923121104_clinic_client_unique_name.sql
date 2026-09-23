-- A clinic can't have two county clients with the same name (case-insensitive).
-- Verified against live data before writing: no existing duplicates, so this
-- builds cleanly. The app checks for a duplicate first and shows a friendly
-- message; this index is the backstop for races and any non-UI writer.
CREATE UNIQUE INDEX IF NOT EXISTS uq_clinic_client_name
  ON clinic_clients (clinic_account_id, lower(county_name));
