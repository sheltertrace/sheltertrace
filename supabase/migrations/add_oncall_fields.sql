-- Add officer_name (denormalized for fast display) and shift_type to
-- schedule_overrides so on-call shifts are distinguishable from generic overrides.

ALTER TABLE schedule_overrides
  ADD COLUMN IF NOT EXISTS officer_name TEXT,
  ADD COLUMN IF NOT EXISTS shift_type   TEXT DEFAULT 'On-Call';

-- Index for quick "who is on call today / this weekend?" queries
CREATE INDEX IF NOT EXISTS idx_schedule_overrides_working_date
  ON schedule_overrides (override_date)
  WHERE is_working = true;
