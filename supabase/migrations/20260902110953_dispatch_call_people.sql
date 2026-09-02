CREATE TABLE IF NOT EXISTS dispatch_call_people (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dispatch_call_id TEXT NOT NULL,
  person_id TEXT,
  -- links to people table if the person exists there
  role TEXT NOT NULL,
  -- Values: Suspect, Victim, Witness, Complainant, Owner, Other
  -- Inline person data (used when not linked to a people record, or as a
  -- snapshot at time of call)
  first_name TEXT,
  last_name TEXT,
  phone TEXT,
  email TEXT,
  address TEXT,
  city TEXT,
  state TEXT,
  zip TEXT,
  dob DATE,
  drivers_license TEXT,
  physical_description TEXT,
  notes TEXT,
  skipped BOOLEAN DEFAULT false,
  added_by TEXT,
  added_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_dcp_call ON dispatch_call_people(dispatch_call_id);
CREATE INDEX IF NOT EXISTS idx_dcp_person ON dispatch_call_people(person_id);

ALTER TABLE dispatch_call_people DISABLE ROW LEVEL SECURITY;
