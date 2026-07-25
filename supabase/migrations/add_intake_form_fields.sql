-- MCAS Animal Intake Form digitization — fields identified in the task spec.
-- Run this in the Supabase SQL editor.

ALTER TABLE animals
ADD COLUMN IF NOT EXISTS body_condition_score INTEGER,
ADD COLUMN IF NOT EXISTS tail_type TEXT,
ADD COLUMN IF NOT EXISTS ears_type TEXT,
ADD COLUMN IF NOT EXISTS coat_type_detail TEXT,
ADD COLUMN IF NOT EXISTS distinguishing_features TEXT,
ADD COLUMN IF NOT EXISTS surrender_signature TEXT,
ADD COLUMN IF NOT EXISTS finder_signature TEXT,
ADD COLUMN IF NOT EXISTS finder_wants_if_unclaimed BOOLEAN,
ADD COLUMN IF NOT EXISTS finder_wants_adoption_contact BOOLEAN,
ADD COLUMN IF NOT EXISTS statement_of_surrender_acknowledged BOOLEAN,
ADD COLUMN IF NOT EXISTS assessed_by_initials TEXT,
ADD COLUMN IF NOT EXISTS assessment_date DATE;
