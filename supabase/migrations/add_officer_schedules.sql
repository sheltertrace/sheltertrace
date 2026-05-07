-- Weekly schedule template per officer (one row per day of week)
CREATE TABLE IF NOT EXISTS officer_schedules (
  id            UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  officer_id    TEXT    NOT NULL REFERENCES staff_accounts(id) ON DELETE CASCADE,
  day_of_week   INTEGER NOT NULL CHECK (day_of_week BETWEEN 0 AND 6), -- 0=Sun, 1=Mon … 6=Sat
  is_scheduled  BOOLEAN NOT NULL DEFAULT false,
  start_time    TIME,
  end_time      TIME,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (officer_id, day_of_week)
);

CREATE INDEX IF NOT EXISTS idx_officer_schedules_officer ON officer_schedules(officer_id);

-- Date-specific overrides (vacation, sick, coverage, special event)
CREATE TABLE IF NOT EXISTS schedule_overrides (
  id            UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  officer_id    TEXT    NOT NULL REFERENCES staff_accounts(id) ON DELETE CASCADE,
  override_date DATE    NOT NULL,
  is_working    BOOLEAN NOT NULL,        -- true = covering/working, false = off
  start_time    TIME,                    -- null = use default schedule times
  end_time      TIME,
  reason        TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (officer_id, override_date)
);

CREATE INDEX IF NOT EXISTS idx_schedule_overrides_officer ON schedule_overrides(officer_id);
CREATE INDEX IF NOT EXISTS idx_schedule_overrides_date   ON schedule_overrides(override_date);

-- RLS
ALTER TABLE officer_schedules    ENABLE ROW LEVEL SECURITY;
ALTER TABLE schedule_overrides   ENABLE ROW LEVEL SECURITY;

CREATE POLICY "schedules_select"   ON officer_schedules  FOR SELECT TO authenticated USING (true);
CREATE POLICY "schedules_insert"   ON officer_schedules  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "schedules_update"   ON officer_schedules  FOR UPDATE TO authenticated USING (true);
CREATE POLICY "schedules_delete"   ON officer_schedules  FOR DELETE TO authenticated USING (true);

CREATE POLICY "overrides_select"   ON schedule_overrides FOR SELECT TO authenticated USING (true);
CREATE POLICY "overrides_insert"   ON schedule_overrides FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "overrides_update"   ON schedule_overrides FOR UPDATE TO authenticated USING (true);
CREATE POLICY "overrides_delete"   ON schedule_overrides FOR DELETE TO authenticated USING (true);
