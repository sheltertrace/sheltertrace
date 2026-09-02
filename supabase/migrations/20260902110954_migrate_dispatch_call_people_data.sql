-- One-time data migration: copy the existing single suspect/victim entries
-- out of dispatch_calls.involved_parties (JSONB) into dispatch_call_people
-- rows, so historical suspect/victim data survives the move to a real
-- multi-person junction table. involved_parties itself is left in place —
-- Caller / AnimalVictim / AnimalSuspect entries stay there untouched; the
-- app just stops writing new Victim/Suspect entries into it going forward.
--
-- Guarded to run only once: the whole block no-ops if dispatch_call_people
-- already has any rows (checked once, up front), so re-running this
-- migration file is harmless.
DO $$
DECLARE
  already_migrated boolean;
BEGIN
  SELECT EXISTS (SELECT 1 FROM dispatch_call_people) INTO already_migrated;
  IF already_migrated THEN
    RETURN;
  END IF;

  -- 1) Entered (non-skipped) Victim/Suspect parties → full snapshot rows.
  INSERT INTO dispatch_call_people (
    dispatch_call_id, person_id, role, first_name, last_name, phone, address,
    dob, drivers_license, physical_description, notes, skipped, added_by, added_at
  )
  SELECT
    dc.id AS dispatch_call_id,
    NULLIF(party->>'person_id', '') AS person_id,
    party->>'role' AS role,
    COALESCE(
      NULLIF(party->>'first', ''),
      NULLIF(split_part(NULLIF(party->>'name', ''), ' ', 1), '')
    ) AS first_name,
    COALESCE(
      NULLIF(party->>'last', ''),
      NULLIF(substr(NULLIF(party->>'name', ''), length(split_part(NULLIF(party->>'name', ''), ' ', 1)) + 2), '')
    ) AS last_name,
    NULLIF(party->>'phone', '') AS phone,
    NULLIF(party->>'address', '') AS address,
    NULLIF(party->>'dob', '')::date AS dob,
    NULLIF(party->>'dl', '') AS drivers_license,
    CASE WHEN party->>'role' = 'Suspect' THEN
      NULLIF(
        TRIM(BOTH ' ' FROM CONCAT_WS(' · ',
          CASE WHEN NULLIF(party->>'hair', '') IS NOT NULL THEN 'Hair: ' || (party->>'hair') END,
          CASE WHEN NULLIF(party->>'eyes', '') IS NOT NULL THEN 'Eyes: ' || (party->>'eyes') END,
          CASE WHEN NULLIF(party->>'weight', '') IS NOT NULL THEN 'Weight: ' || (party->>'weight') || ' lbs' END,
          CASE WHEN NULLIF(party->>'height', '') IS NOT NULL THEN 'Height: ' || (party->>'height') END
        )),
        ''
      )
    ELSE NULL END AS physical_description,
    NULLIF(
      TRIM(BOTH E'\n' FROM CONCAT_WS(E'\n',
        CASE WHEN NULLIF(party->>'middle', '') IS NOT NULL THEN 'Middle name: ' || (party->>'middle') END,
        CASE WHEN NULLIF(party->>'injuries', '') IS NOT NULL THEN 'Injuries/Complaint: ' || (party->>'injuries') END,
        'Migrated from prior single-suspect/victim call record.'
      )),
      ''
    ) AS notes,
    false AS skipped,
    COALESCE(dc.created_by, 'Migration') AS added_by,
    COALESCE(dc.updated_at, dc.created_at, NOW()) AS added_at
  FROM dispatch_calls dc
  CROSS JOIN LATERAL jsonb_array_elements(COALESCE(dc.involved_parties, '[]'::jsonb)) AS party
  WHERE party->>'role' IN ('Victim', 'Suspect')
    AND party->>'status' = 'entered'
    AND (NULLIF(party->>'first', '') IS NOT NULL OR NULLIF(party->>'last', '') IS NOT NULL OR NULLIF(party->>'name', '') IS NOT NULL);

  -- 2) Explicitly skipped Victim/Suspect steps → skip-sentinel rows (skipped=true,
  -- no name), so the printed Call Review can still show "No suspect identified —
  -- skipped by X on date" for historical calls.
  INSERT INTO dispatch_call_people (
    dispatch_call_id, role, skipped, added_by, added_at, notes
  )
  SELECT
    dc.id,
    party->>'role',
    true,
    COALESCE(NULLIF(party->>'skipped_by', ''), 'Migration'),
    COALESCE(NULLIF(party->>'skipped_at', '')::timestamptz, dc.updated_at, dc.created_at, NOW()),
    'Migrated skip decision from prior single-suspect/victim call record.'
  FROM dispatch_calls dc
  CROSS JOIN LATERAL jsonb_array_elements(COALESCE(dc.involved_parties, '[]'::jsonb)) AS party
  WHERE party->>'role' IN ('Victim', 'Suspect')
    AND party->>'status' = 'skipped';
END $$;
