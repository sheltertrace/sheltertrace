-- Super Admin Portal — database changes
-- Run in production Supabase SQL editor.

-- Platform customers table
CREATE TABLE IF NOT EXISTS platform_customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_name TEXT NOT NULL,
  account_type TEXT NOT NULL DEFAULT 'shelter',
  contact_name TEXT,
  contact_email TEXT,
  contact_phone TEXT,
  address TEXT,
  city TEXT,
  state TEXT,
  zip TEXT,
  county TEXT,
  status TEXT DEFAULT 'trial',
  trial_start DATE,
  trial_end DATE,
  subscription_start DATE,
  subscription_end DATE,
  billing_plan TEXT,
  billing_amount NUMERIC,
  billing_cycle TEXT,
  last_payment_date DATE,
  next_payment_date DATE,
  notes TEXT,
  feature_flags JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Link staff accounts to platform customers
ALTER TABLE staff_accounts
  ADD COLUMN IF NOT EXISTS platform_customer_id UUID,
  ADD COLUMN IF NOT EXISTS is_super_admin BOOLEAN DEFAULT false;
-- account_type already added by clinic_portal migration

-- Platform audit log
CREATE TABLE IF NOT EXISTS platform_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  super_admin_id TEXT NOT NULL,
  action TEXT NOT NULL,
  target_type TEXT,
  target_id TEXT,
  details JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Platform announcements
CREATE TABLE IF NOT EXISTS platform_announcements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  type TEXT DEFAULT 'info',
  target_account_types TEXT[] DEFAULT ARRAY['shelter','clinic'],
  active BOOLEAN DEFAULT true,
  show_from TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  show_until TIMESTAMP WITH TIME ZONE,
  created_by TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Disable RLS
ALTER TABLE platform_customers DISABLE ROW LEVEL SECURITY;
ALTER TABLE platform_audit_log DISABLE ROW LEVEL SECURITY;
ALTER TABLE platform_announcements DISABLE ROW LEVEL SECURITY;
