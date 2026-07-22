-- Public Witness Statement submissions (/witness-statement), reviewed by MCAS
-- staff and optionally attached to a dispatch call.

CREATE TABLE IF NOT EXISTS witness_statements (
  id                   UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  reference_number     TEXT         UNIQUE,
  witness_first_name   TEXT         NOT NULL,
  witness_last_name    TEXT         NOT NULL,
  witness_phone        TEXT         NOT NULL,
  witness_email        TEXT,
  witness_address      TEXT,
  witness_city         TEXT,
  witness_state        TEXT,
  witness_zip          TEXT,
  preferred_contact    TEXT,
  incident_date        DATE,
  incident_time        TEXT,
  incident_location    TEXT,
  provided_case_number TEXT,
  statement            TEXT         NOT NULL,
  attachments          JSONB        DEFAULT '[]',
  certified            BOOLEAN      DEFAULT false,
  typed_signature       TEXT,
  status               TEXT         DEFAULT 'New',
    -- New | Reviewed | Attached | Dismissed
  dispatch_call_id     TEXT,
  attached_by          TEXT,
  attached_at          TIMESTAMPTZ,
  dismissed_reason     TEXT,
  staff_notes          TEXT,
  submitted_at         TIMESTAMPTZ  DEFAULT NOW(),
  created_at           TIMESTAMPTZ  DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_witness_statements_status ON witness_statements (status);
CREATE INDEX IF NOT EXISTS idx_witness_statements_call    ON witness_statements (dispatch_call_id);
CREATE INDEX IF NOT EXISTS idx_witness_statements_submitted ON witness_statements (submitted_at DESC);

ALTER TABLE witness_statements DISABLE ROW LEVEL SECURITY;

-- Storage bucket for statement photo/video/document attachments
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'witness-attachments',
  'witness-attachments',
  true,
  26214400,
  ARRAY['image/jpeg','image/png','image/webp','image/gif','image/heic','image/heif','video/mp4','video/quicktime','application/pdf']
)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "witness_attachments_public_read"   ON storage.objects;
DROP POLICY IF EXISTS "witness_attachments_public_insert" ON storage.objects;

CREATE POLICY "witness_attachments_public_read" ON storage.objects
  FOR SELECT USING (bucket_id = 'witness-attachments');

CREATE POLICY "witness_attachments_public_insert" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'witness-attachments');
