-- Storage lockdown: the four policies actually in force today
-- ("Allow all deletes/reads/updates/uploads", role public, USING/CHECK true)
-- apply to every bucket with no bucket_id filter at all — anon can read,
-- enumerate, overwrite, AND delete any object in any bucket, including
-- evidence, documents, and (formerly) signatures.
--
-- The earlier attempt to fix this by revoking EXECUTE on the storage.search*
-- functions did not take — the SQL editor's role cannot alter grants on
-- objects owned by supabase_storage_admin inside the storage schema. This
-- migration doesn't touch any function grant; storage.objects is a normal
-- table with RLS, which the project owner CAN manage from the SQL editor,
-- exactly like any other table's policies.
--
-- Classification (verified live 2026-09-28/29, not assumed from the tracked
-- per-bucket migration files, several of which don't match what's actually
-- deployed):
--   animal-photos           - public READ (required: public adoption page).
--                              No public WRITE of any kind - closes a stranger's
--                              ability to overwrite/deface an adoptable animal's
--                              photo. All uploads now go through the staff-only
--                              /api/staff/storage/upload route (service role).
--   evidence, documents      - private end to end. Read/write/delete only via
--                              the new staff-session-gated server routes.
--   pet-license-documents,
--   lost-found-photos,
--   foster-update-photos     - NEW buckets. Anon may INSERT only (genuine public
--                              submissions with no staff session) - no read, no
--                              list, no update, no delete for anon. Staff view
--                              pet-license documents via the sign route;
--                              lost-found/foster-update photos stay ordinary
--                              public-read buckets (see below - low
--                              sensitivity, no confidentiality concern, unlike
--                              license documents).
--   signatures, attachments,
--   rescue_groups             - zero code references anywhere in the app, zero
--                              objects in any of them (checked live). No policy
--                              at all -> anon/authenticated get nothing.
--   platform-assets           - correction made while wiring this up: this
--                              bucket had zero code references too, but the
--                              branding logo it was clearly meant for (the
--                              name matches, and it's currently unused because
--                              branding uploads drifted onto `documents`
--                              instead) is displayed live in SuperAdminShell's
--                              header and embedded in printed clinic receipts -
--                              not confidential, and not worth forcing through
--                              signed URLs like evidence/documents. Given its
--                              own purpose (public-read, staff-upload-only,
--                              same shape as animal-photos) rather than being
--                              locked with the other three genuinely orphaned
--                              buckets.
--
-- lost-found-photos / foster-update-photos are created PUBLIC (read), matching
-- animal-photos in spirit - a citizen's "here's the dog I found" photo isn't
-- confidential the way evidence/documents/license paperwork is, and keeping
-- them public means zero staff-side code changes to view them. Only INSERT is
-- opened to anon; update/delete are not, so a stranger can add a photo but
-- never deface or remove one that's already there.
--
-- ORDER: run this AFTER the matching app deploy is live. The new upload/sign/
-- delete routes work correctly regardless of whether this has run yet (they
-- use the service role, which bypasses RLS either way), and the three public-
-- submission upload pages fall back to the old animal-photos bucket if the new
-- buckets don't exist yet - so there is no unsafe ordering here, but doing it
-- deploy-first keeps this consistent with every other migration this project.

DROP POLICY IF EXISTS "Allow all deletes" ON storage.objects;
DROP POLICY IF EXISTS "Allow all reads"   ON storage.objects;
DROP POLICY IF EXISTS "Allow all updates" ON storage.objects;
DROP POLICY IF EXISTS "Allow all uploads" ON storage.objects;

-- animal-photos: public read; no INSERT/UPDATE/DELETE policy for anon/
-- authenticated at all -> every write now goes through the service role via
-- /api/staff/storage/upload.
DROP POLICY IF EXISTS "animal_photos_read" ON storage.objects;
CREATE POLICY "animal_photos_read" ON storage.objects
  FOR SELECT TO anon, authenticated USING (bucket_id = 'animal-photos');

-- platform-assets: same shape as animal-photos - public read, no anon/
-- authenticated write of any kind (staff uploads go through the service role).
DROP POLICY IF EXISTS "platform_assets_read" ON storage.objects;
CREATE POLICY "platform_assets_read" ON storage.objects
  FOR SELECT TO anon, authenticated USING (bucket_id = 'platform-assets');

-- pet-license-documents: anon insert-only, never read/list/update/delete.
DROP POLICY IF EXISTS "pet_license_docs_insert" ON storage.objects;
CREATE POLICY "pet_license_docs_insert" ON storage.objects
  FOR INSERT TO anon WITH CHECK (bucket_id = 'pet-license-documents');

-- lost-found-photos / foster-update-photos: public read, anon insert-only.
DROP POLICY IF EXISTS "lost_found_photos_read"   ON storage.objects;
DROP POLICY IF EXISTS "lost_found_photos_insert" ON storage.objects;
DROP POLICY IF EXISTS "foster_update_photos_read"   ON storage.objects;
DROP POLICY IF EXISTS "foster_update_photos_insert" ON storage.objects;
CREATE POLICY "lost_found_photos_read"   ON storage.objects FOR SELECT TO anon, authenticated USING (bucket_id = 'lost-found-photos');
CREATE POLICY "lost_found_photos_insert" ON storage.objects FOR INSERT TO anon, authenticated WITH CHECK (bucket_id = 'lost-found-photos');
CREATE POLICY "foster_update_photos_read"   ON storage.objects FOR SELECT TO anon, authenticated USING (bucket_id = 'foster-update-photos');
CREATE POLICY "foster_update_photos_insert" ON storage.objects FOR INSERT TO anon, authenticated WITH CHECK (bucket_id = 'foster-update-photos');

-- evidence, documents, signatures, attachments, rescue_groups: deliberately no
-- policy at all for anon/authenticated -> default-deny. service_role (used
-- exclusively by the new server routes) bypasses RLS entirely and is
-- unaffected by any of this.

UPDATE storage.buckets SET public = false
 WHERE id IN ('evidence', 'documents', 'signatures', 'attachments', 'rescue_groups');
UPDATE storage.buckets SET public = true WHERE id = 'platform-assets';

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types) VALUES
  ('pet-license-documents', 'pet-license-documents', false, 10485760, ARRAY['application/pdf','image/jpeg','image/png']),
  ('lost-found-photos',     'lost-found-photos',     true,  10485760, ARRAY['image/jpeg','image/png','image/webp','image/heic','image/heif']),
  ('foster-update-photos',  'foster-update-photos',  true,  10485760, ARRAY['image/jpeg','image/png','image/webp','image/heic','image/heif'])
ON CONFLICT (id) DO NOTHING;
