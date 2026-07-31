ALTER TABLE animals
  ADD COLUMN IF NOT EXISTS behavior_friendly BOOLEAN,
  ADD COLUMN IF NOT EXISTS behavior_fearful_skittish BOOLEAN,
  ADD COLUMN IF NOT EXISTS behavior_aggressive BOOLEAN,
  ADD COLUMN IF NOT EXISTS behavior_feral_unhandleable BOOLEAN;
