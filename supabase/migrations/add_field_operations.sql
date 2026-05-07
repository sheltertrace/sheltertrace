-- Field Activity tracking table
CREATE TABLE IF NOT EXISTS field_activity (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  officer_id        UUID        NOT NULL REFERENCES people(id) ON DELETE CASCADE,
  officer_name      TEXT        NOT NULL,
  officer_badge     TEXT,
  status            TEXT        NOT NULL CHECK (status IN ('On Duty', 'En Route', 'On Scene', 'Available', 'Off Duty', 'Break')),
  location_lat      NUMERIC(10, 7),
  location_lng      NUMERIC(10, 7),
  location_label    TEXT,
  call_id           UUID        REFERENCES dispatch_calls(id) ON DELETE SET NULL,
  call_number       TEXT,
  notes             TEXT,
  mileage_start     NUMERIC(8, 1),
  mileage_end       NUMERIC(8, 1),
  recorded_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_field_activity_officer_id   ON field_activity(officer_id);
CREATE INDEX IF NOT EXISTS idx_field_activity_recorded_at  ON field_activity(recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_field_activity_status       ON field_activity(status);

-- People table additions for live officer status
ALTER TABLE people
  ADD COLUMN IF NOT EXISTS current_field_status  TEXT        DEFAULT 'Off Duty',
  ADD COLUMN IF NOT EXISTS last_location_lat     NUMERIC(10, 7),
  ADD COLUMN IF NOT EXISTS last_location_lng     NUMERIC(10, 7),
  ADD COLUMN IF NOT EXISTS last_status_update    TIMESTAMPTZ;

-- RLS for field_activity
ALTER TABLE field_activity ENABLE ROW LEVEL SECURITY;

-- Authenticated users can read all field activity
CREATE POLICY "field_activity_select" ON field_activity
  FOR SELECT TO authenticated USING (true);

-- Authenticated users can insert their own activity
CREATE POLICY "field_activity_insert" ON field_activity
  FOR INSERT TO authenticated WITH CHECK (true);

-- Authenticated users can update (for mileage_end corrections)
CREATE POLICY "field_activity_update" ON field_activity
  FOR UPDATE TO authenticated USING (true);
