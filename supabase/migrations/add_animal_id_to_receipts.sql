-- Add animal_id to receipts so general receipts can be linked to animals
ALTER TABLE receipts ADD COLUMN IF NOT EXISTS animal_id TEXT;

CREATE INDEX IF NOT EXISTS receipts_animal_id_idx ON receipts (animal_id);
