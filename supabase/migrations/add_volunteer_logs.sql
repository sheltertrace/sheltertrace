-- Volunteer time-clock log table
CREATE TABLE IF NOT EXISTS volunteer_logs (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  person_id     TEXT NOT NULL,
  person_name   TEXT NOT NULL,
  task          TEXT NOT NULL DEFAULT 'General Volunteering',
  clock_in      TIMESTAMPTZ NOT NULL DEFAULT now(),
  clock_out     TIMESTAMPTZ,
  hours         NUMERIC(6,2),
  date          DATE NOT NULL DEFAULT CURRENT_DATE,
  notes         TEXT,
  created_at    TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_volunteer_logs_person ON volunteer_logs(person_id);
CREATE INDEX IF NOT EXISTS idx_volunteer_logs_date   ON volunteer_logs(date);

ALTER TABLE volunteer_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "allow_all_volunteer_logs" ON volunteer_logs;
CREATE POLICY "allow_all_volunteer_logs" ON volunteer_logs
  FOR ALL USING (true) WITH CHECK (true);
