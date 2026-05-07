-- ── Transfer Receipt Fields ───────────────────────────────────────────────────
-- Adds snapshot storage and receipt metadata to the transfers table.
-- animal_info_snapshot: full animal objects (with medical_records array embedded)
--   captured at transfer time — ensures receipts stay accurate after record edits.
-- agency_info_snapshot: full rescue group object captured at transfer time.

ALTER TABLE transfers
  ADD COLUMN IF NOT EXISTS officer_badge          TEXT,
  ADD COLUMN IF NOT EXISTS condition_at_transfer  TEXT,
  ADD COLUMN IF NOT EXISTS terms_accepted         BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS animal_info_snapshot   JSONB,
  ADD COLUMN IF NOT EXISTS agency_info_snapshot   JSONB;
