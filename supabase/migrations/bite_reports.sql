-- Animal Bite Reports and Quarantine Tracking
-- Run in production Supabase SQL editor.

CREATE TABLE IF NOT EXISTS bite_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_number TEXT UNIQUE,
  report_type TEXT NOT NULL,  -- animal_human | animal_animal
  status TEXT DEFAULT 'Open',
  incident_date DATE NOT NULL,
  incident_time TIME,
  incident_address TEXT,
  incident_city TEXT,
  incident_location_type TEXT,
  law_enforcement_notified BOOLEAN DEFAULT false,
  law_enforcement_report TEXT,
  biting_animal_id TEXT,
  biting_animal_data JSONB,
  victim_type TEXT,           -- human | animal
  victim_data JSONB,
  owner_data JSONB,
  injury_data JSONB,
  quarantine_ordered BOOLEAN DEFAULT false,
  quarantine_data JSONB,
  quarantine_released BOOLEAN DEFAULT false,
  quarantine_release_date DATE,
  disposition TEXT,
  follow_up_required BOOLEAN DEFAULT false,
  follow_up_date DATE,
  investigating_officer TEXT,
  investigating_officer_id TEXT,
  narrative TEXT,
  photos JSONB DEFAULT '[]',
  dispatch_call_id TEXT,
  citation_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS bite_quarantines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bite_report_id UUID REFERENCES bite_reports(id),
  animal_id TEXT,
  animal_name TEXT,
  quarantine_type TEXT,
  location TEXT,
  location_contact TEXT,
  location_phone TEXT,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  check_dates JSONB DEFAULT '[]',
  status TEXT DEFAULT 'Active',
  released BOOLEAN DEFAULT false,
  released_date DATE,
  released_by TEXT,
  rabies_symptoms BOOLEAN DEFAULT false,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE bite_reports DISABLE ROW LEVEL SECURITY;
ALTER TABLE bite_quarantines DISABLE ROW LEVEL SECURITY;
