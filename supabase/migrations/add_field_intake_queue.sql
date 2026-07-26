-- Offline sync queue for the field-fillable MCAS Animal Intake Form
-- (/officer/field-intake). Run this in the Supabase SQL editor.

CREATE TABLE IF NOT EXISTS field_intake_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  officer_id TEXT NOT NULL,
  form_data JSONB NOT NULL,
  signatures JSONB DEFAULT '{}',
  photos JSONB DEFAULT '[]',
  submitted_at TIMESTAMP WITH TIME ZONE,
  synced BOOLEAN DEFAULT false,
  synced_at TIMESTAMP WITH TIME ZONE,
  animal_id TEXT,
  error TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
ALTER TABLE field_intake_queue DISABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_field_intake_queue_synced ON field_intake_queue (synced);
