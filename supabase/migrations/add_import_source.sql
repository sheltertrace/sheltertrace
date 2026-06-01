-- Add import_source to animals table.
-- Values: 'shelterbuddy' = imported from ShelterBuddy, NULL = entered via ShelterTrace.
-- Historical/imported animals are excluded from active kennel views and
-- dashboard counts but remain fully accessible via the Archive section.

ALTER TABLE animals
  ADD COLUMN IF NOT EXISTS import_source TEXT;

-- Auto-tag animals whose IDs or shelter_tags start with "SB-" as ShelterBuddy imports.
-- Adjust this WHERE clause if your import used a different prefix.
UPDATE animals
  SET import_source = 'shelterbuddy'
  WHERE import_source IS NULL
    AND (
      id LIKE 'SB-%'
      OR shelter_tag LIKE 'SB-%'
      OR bar_code LIKE 'SB-%'
    );

-- If you imported animals without a prefix but know they were all created
-- before a certain date, you can also run:
--   UPDATE animals SET import_source = 'shelterbuddy'
--   WHERE import_source IS NULL AND created_at < '2025-01-01';
