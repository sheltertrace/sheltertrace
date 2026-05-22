-- ── GPS Location History ─────────────────────────────────────────────────────
-- Breadcrumb trail for officer GPS pings while on duty.
-- Run this in: Supabase Dashboard → SQL Editor

-- location_history table
CREATE TABLE IF NOT EXISTS location_history (
  id           UUID    DEFAULT gen_random_uuid() PRIMARY KEY,
  officer_id   TEXT    NOT NULL,
  officer_name TEXT,
  latitude     NUMERIC NOT NULL,
  longitude    NUMERIC NOT NULL,
  accuracy     NUMERIC,
  speed        NUMERIC,
  heading      NUMERIC,
  status       TEXT,
  call_id      TEXT,
  timestamp    TIMESTAMPTZ DEFAULT NOW()
);

-- Fast lookups by officer + time (today's route, history window)
CREATE INDEX IF NOT EXISTS idx_location_history_officer_time
  ON location_history (officer_id, timestamp DESC);

-- RLS (all-allow, matching existing app pattern)
ALTER TABLE location_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS allow_all_location_history ON location_history
  FOR ALL USING (true) WITH CHECK (true);

-- ── staff_accounts additions ──────────────────────────────────────────────────
-- tracking_active: true while watchPosition is running on the officer's device
ALTER TABLE staff_accounts
  ADD COLUMN IF NOT EXISTS tracking_active BOOLEAN DEFAULT false;

-- ── Purge policy (run daily via pg_cron or a scheduled job) ──────────────────
-- DELETE FROM location_history WHERE timestamp < NOW() - INTERVAL '30 days';
--
-- To set up pg_cron in Supabase:
--   SELECT cron.schedule('purge-location-history', '0 3 * * *',
--     'DELETE FROM location_history WHERE timestamp < NOW() - INTERVAL ''30 days''');
