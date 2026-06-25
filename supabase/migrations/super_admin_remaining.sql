-- Super Admin remaining modules — payments + settings tables
-- Run in production Supabase SQL editor.

CREATE TABLE IF NOT EXISTS platform_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID REFERENCES platform_customers(id),
  payment_date DATE NOT NULL,
  amount NUMERIC NOT NULL,
  payment_method TEXT,
  notes TEXT,
  recorded_by TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
ALTER TABLE platform_payments DISABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS platform_settings (
  id INTEGER PRIMARY KEY DEFAULT 1,
  platform_name TEXT DEFAULT 'ShelterTrace',
  support_email TEXT DEFAULT 'info@sheltertrace.com',
  platform_website TEXT DEFAULT 'sheltertrace.com',
  default_trial_days INTEGER DEFAULT 30,
  default_feature_flags JSONB DEFAULT '{}',
  notification_preferences JSONB DEFAULT '{}',
  branding JSONB DEFAULT '{}',
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_by TEXT
);
ALTER TABLE platform_settings DISABLE ROW LEVEL SECURITY;

INSERT INTO platform_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;
