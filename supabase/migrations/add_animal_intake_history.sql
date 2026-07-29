CREATE TABLE IF NOT EXISTS animal_intake_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  animal_id TEXT NOT NULL,
  intake_number INTEGER NOT NULL,
  -- 1 for original intake, 2 for first return, etc.
  intake_date DATE NOT NULL,
  intake_time TIME,
  intake_method TEXT,
  -- Field Intake, Office Intake, Cage Trap,
  -- Owner Surrender, Rescue Return, Post-Adoption Return
  return_reason TEXT,
  -- Values: Found At Large, Post-Adoption Return,
  -- Post-Reclaim Return, Rescue Return,
  -- Repeat Owner Surrender, Cruelty Seizure, Other
  return_reason_notes TEXT,
  previous_outcome TEXT,
  -- What happened last time: Adopted, Returned to Owner,
  -- Transferred, etc.
  previous_outcome_date DATE,
  -- Who returned the animal (if applicable)
  returned_by_type TEXT,
  -- Values: Owner, Adopter, Rescue Group, Officer,
  -- Public Finder, Anonymous
  returned_by_name TEXT,
  returned_by_phone TEXT,
  returned_by_address TEXT,
  location_found TEXT,
  intake_officer TEXT,
  intake_officer_id TEXT,
  case_number TEXT,
  linked_dispatch_call_id TEXT,
  linked_citation_id TEXT,
  animal_condition_notes TEXT,
  photos JSONB DEFAULT '[]',
  documents JSONB DEFAULT '[]',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE animal_intake_history
  DISABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_animal_intake_history_animal_id ON animal_intake_history(animal_id);
