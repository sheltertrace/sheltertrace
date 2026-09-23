-- Chain-of-custody log for the dispatch call Court Packet: every generation
-- records who produced it, when, which sections were included, the page
-- count, and the stated reason.
CREATE TABLE IF NOT EXISTS court_packet_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dispatch_call_id TEXT NOT NULL,
  generated_by TEXT NOT NULL,
  generated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  sections_included JSONB,
  page_count INTEGER,
  reason TEXT
);
CREATE INDEX IF NOT EXISTS idx_court_packet_log_call ON court_packet_log(dispatch_call_id);
ALTER TABLE court_packet_log DISABLE ROW LEVEL SECURITY;
