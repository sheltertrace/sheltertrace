-- Create the evidence storage bucket and configure it as public.
-- Run this in the Supabase SQL editor if the "evidence" bucket doesn't exist yet.

-- 1. Insert the bucket (safe to run if already exists)
INSERT INTO storage.buckets (id, name, public)
VALUES ('evidence', 'evidence', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- 2. Allow authenticated users to upload files
DROP POLICY IF EXISTS "evidence_upload" ON storage.objects;
CREATE POLICY "evidence_upload" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'evidence');

-- 3. Allow public read (so URLs work without auth headers)
DROP POLICY IF EXISTS "evidence_read" ON storage.objects;
CREATE POLICY "evidence_read" ON storage.objects
  FOR SELECT TO public
  USING (bucket_id = 'evidence');

-- 4. Allow authenticated users to delete their uploads
DROP POLICY IF EXISTS "evidence_delete" ON storage.objects;
CREATE POLICY "evidence_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'evidence');

-- 5. Confirm the evidence column on dispatch_calls is JSONB (not TEXT)
-- If it was created as TEXT, run this:
-- ALTER TABLE dispatch_calls ALTER COLUMN evidence TYPE JSONB USING evidence::jsonb;
