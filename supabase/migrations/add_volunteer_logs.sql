-- Volunteer time-clock log table
CREATE TABLE IF NOT EXISTS volunteer_sessions (
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

CREATE INDEX IF NOT EXISTS idx_volunteer_sessions_person ON volunteer_sessions(person_id);
CREATE INDEX IF NOT EXISTS idx_volunteer_sessions_date   ON volunteer_sessions(date);

ALTER TABLE volunteer_sessions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "allow_all_volunteer_sessions" ON volunteer_sessions;
CREATE POLICY "allow_all_volunteer_sessions" ON volunteer_sessions
  FOR ALL USING (true) WITH CHECK (true);
