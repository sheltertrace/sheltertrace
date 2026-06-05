CREATE TABLE IF NOT EXISTS pilot_applications (
  id             UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  name           TEXT        NOT NULL,
  shelter_name   TEXT        NOT NULL,
  county_state   TEXT,
  email          TEXT        NOT NULL,
  phone          TEXT,
  message        TEXT,
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE pilot_applications ENABLE ROW LEVEL SECURITY;

-- Public can submit applications (insert only)
CREATE POLICY allow_public_insert_pilot_applications ON pilot_applications
  FOR INSERT WITH CHECK (true);

-- Staff can read all
CREATE POLICY allow_all_pilot_applications ON pilot_applications
  FOR ALL USING (true) WITH CHECK (true);
