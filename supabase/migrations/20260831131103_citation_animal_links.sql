ALTER TABLE citations
  ADD COLUMN IF NOT EXISTS linked_animal_id TEXT,
  ADD COLUMN IF NOT EXISTS linked_scene_animal_id TEXT;
-- linked_animal_id references a real ShelterTrace animals.id.
-- linked_scene_animal_id references the id of one entry in the linked call's
-- dispatch_calls.scene_animals JSONB array (that animal never gets its own
-- animals record). At most one of the two is set per citation.

CREATE INDEX IF NOT EXISTS idx_citations_linked_animal ON citations(linked_animal_id);
