-- Pending Follow-Up support for dispatch_calls.
-- Run this in the Supabase SQL editor.

ALTER TABLE dispatch_calls
ADD COLUMN IF NOT EXISTS follow_up_required BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS follow_up_reason TEXT,
ADD COLUMN IF NOT EXISTS follow_up_due_date DATE,
ADD COLUMN IF NOT EXISTS follow_up_assigned_officer TEXT,
ADD COLUMN IF NOT EXISTS follow_up_moved_by TEXT,
ADD COLUMN IF NOT EXISTS follow_up_moved_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS follow_up_notes TEXT;

CREATE INDEX IF NOT EXISTS idx_dispatch_calls_follow_up_due
  ON dispatch_calls (follow_up_due_date)
  WHERE follow_up_required = true;
