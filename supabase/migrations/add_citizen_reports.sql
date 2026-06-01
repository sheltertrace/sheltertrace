-- Citizen Online Violation/Concern Reporting Portal
-- Public submissions, reviewed by MCAS staff.

CREATE TABLE IF NOT EXISTS citizen_reports (
  id                  UUID         DEFAULT gen_random_uuid() PRIMARY KEY,
  reference_number    TEXT         UNIQUE NOT NULL,
  report_type         TEXT         NOT NULL,
  location_address    TEXT,
  location_city       TEXT,
  location_zip        TEXT,
  location_details    TEXT,
  species             TEXT,
  breed               TEXT,
  animal_color        TEXT,
  animal_count        INTEGER,
  animal_contained    BOOLEAN,
  animal_injured      BOOLEAN,
  animal_aggressive   BOOLEAN,
  description         TEXT         NOT NULL,
  duration            TEXT,
  reported_before     BOOLEAN,
  reporter_first_name TEXT,
  reporter_last_name  TEXT,
  reporter_phone      TEXT,
  reporter_email      TEXT,
  anonymous           BOOLEAN      DEFAULT false,
  wants_update        BOOLEAN      DEFAULT false,
  contact_time        TEXT,
  photo_urls          JSONB        DEFAULT '[]'::JSONB,
  status              TEXT         DEFAULT 'New',
  priority            TEXT         DEFAULT 'Medium',
  assigned_officer    TEXT,
  staff_notes         TEXT,
  dispatch_call_id    TEXT,
  resolved_at         TIMESTAMPTZ,
  resolution_notes    TEXT,
  dismissed_reason    TEXT,
  created_at          TIMESTAMPTZ  DEFAULT NOW(),
  updated_at          TIMESTAMPTZ  DEFAULT NOW()
);

ALTER TABLE citizen_reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS allow_all_citizen_reports ON citizen_reports;
CREATE POLICY allow_all_citizen_reports ON citizen_reports
  FOR ALL USING (true) WITH CHECK (true);

-- Storage bucket for report photo attachments
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'report-attachments',
  'report-attachments',
  true,
  10485760,
  ARRAY['image/jpeg','image/png','image/webp','image/gif','image/heic','image/heif']
)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "report_attachments_public_read"   ON storage.objects;
DROP POLICY IF EXISTS "report_attachments_public_insert" ON storage.objects;

CREATE POLICY "report_attachments_public_read" ON storage.objects
  FOR SELECT USING (bucket_id = 'report-attachments');

CREATE POLICY "report_attachments_public_insert" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'report-attachments');
