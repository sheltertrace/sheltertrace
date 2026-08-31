ALTER TABLE dispatch_calls
ADD COLUMN IF NOT EXISTS scene_animals JSONB DEFAULT '[]';
