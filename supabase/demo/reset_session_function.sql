-- Session-scoped demo reset function.
-- Deletes only records tagged with a specific session_id (user-created data).
-- Seed data (demo_session_id IS NULL) is never deleted.
-- Run in the DEMO Supabase project SQL editor only.

CREATE OR REPLACE FUNCTION reset_demo_session(p_session_id TEXT)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Delete dependent records first (FK order)
  DELETE FROM animal_notes     WHERE demo_session_id = p_session_id;
  DELETE FROM animal_people    WHERE animal_id IN (
    SELECT id FROM animals WHERE demo_session_id = p_session_id
  );
  DELETE FROM medical_records  WHERE demo_session_id = p_session_id;
  DELETE FROM adoption_records WHERE demo_session_id = p_session_id;
  DELETE FROM dispatch_calls   WHERE demo_session_id = p_session_id;
  DELETE FROM citations        WHERE demo_session_id = p_session_id;
  DELETE FROM people           WHERE demo_session_id = p_session_id;
  DELETE FROM animals          WHERE demo_session_id = p_session_id;

  RETURN;
END;
$$;

-- Allow the anon (public) key to call this function
GRANT EXECUTE ON FUNCTION reset_demo_session(TEXT) TO anon;
GRANT EXECUTE ON FUNCTION reset_demo_session(TEXT) TO authenticated;
