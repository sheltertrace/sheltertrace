CREATE TABLE IF NOT EXISTS adoption_receipt_reprints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  adoption_id TEXT NOT NULL,
  animal_id TEXT,
  reprinted_by TEXT NOT NULL,
  reprinted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  reason TEXT
);
ALTER TABLE adoption_receipt_reprints
  DISABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_adoption_receipt_reprints_adoption ON adoption_receipt_reprints(adoption_id);
