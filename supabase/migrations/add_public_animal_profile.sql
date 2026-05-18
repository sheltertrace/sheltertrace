-- Add public-facing profile columns to the animals table.
-- Run this in the Supabase SQL editor.

ALTER TABLE animals
  ADD COLUMN IF NOT EXISTS show_on_website    BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS public_bio         TEXT,
  ADD COLUMN IF NOT EXISTS featured_photo_url TEXT,
  ADD COLUMN IF NOT EXISTS photo_urls         JSONB   DEFAULT '[]'::jsonb;

-- Fast index for the public /available-animals page query
CREATE INDEX IF NOT EXISTS idx_animals_show_on_website
  ON animals (show_on_website)
  WHERE show_on_website = true;

-- Storage: animal-photos bucket must have public read access.
-- Run the following in the Supabase Storage settings OR via SQL:
--
-- INSERT INTO storage.buckets (id, name, public)
-- VALUES ('animal-photos', 'animal-photos', true)
-- ON CONFLICT (id) DO UPDATE SET public = true;
--
-- INSERT INTO storage.policies (name, bucket_id, operation, definition)
-- VALUES
--   ('Public Read', 'animal-photos', 'SELECT', 'true'),
--   ('Auth Upload', 'animal-photos', 'INSERT', 'true'),
--   ('Auth Update', 'animal-photos', 'UPDATE', 'true'),
--   ('Auth Delete', 'animal-photos', 'DELETE', 'true')
-- ON CONFLICT DO NOTHING;
