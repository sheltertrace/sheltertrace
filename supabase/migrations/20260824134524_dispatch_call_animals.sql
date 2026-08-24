CREATE TABLE IF NOT EXISTS dispatch_call_animals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dispatch_call_id TEXT NOT NULL,
  animal_id TEXT NOT NULL,
  role TEXT DEFAULT 'Involved',
  -- Values: Involved, Impounded, Bit Someone,
  -- Bit Another Animal, Loose On Arrival,
  -- Returned to Owner On Scene, Deceased On Scene, Other
  notes TEXT,
  added_by TEXT,
  added_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(dispatch_call_id, animal_id)
);

CREATE INDEX IF NOT EXISTS
  idx_dispatch_call_animals_call
  ON dispatch_call_animals(dispatch_call_id);
CREATE INDEX IF NOT EXISTS
  idx_dispatch_call_animals_animal
  ON dispatch_call_animals(animal_id);

ALTER TABLE dispatch_call_animals
  DISABLE ROW LEVEL SECURITY;
