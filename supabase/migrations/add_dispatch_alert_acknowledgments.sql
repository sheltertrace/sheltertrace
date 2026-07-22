-- Add alert_acknowledgments column to dispatch_calls for logging officer
-- acknowledgment of officer-safety danger alerts (person/address flags).
ALTER TABLE dispatch_calls ADD COLUMN IF NOT EXISTS alert_acknowledgments JSONB DEFAULT '[]';
