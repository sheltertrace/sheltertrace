-- Add animal_ids column to dispatch_calls for linking impounded animals
ALTER TABLE dispatch_calls ADD COLUMN IF NOT EXISTS animal_ids JSONB DEFAULT '[]';
