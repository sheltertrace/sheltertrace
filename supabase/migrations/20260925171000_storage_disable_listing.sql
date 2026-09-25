-- QUICK WIN: stop anonymous visitors from LISTING files in storage.
--
-- The `evidence`, `documents` and `animal-photos` buckets can currently be
-- enumerated by anyone with the public key (the storage "list" API), which
-- hands out the file names of court packets, uploaded IDs and evidence photos.
--
-- The app never lists files (it only uploads, removes, and links to public
-- URLs), so listing can be switched off without touching those paths. The list
-- endpoint is served by the storage.search* functions; this removes anon's (and
-- PUBLIC's) right to call them. Public-bucket URLs, uploads, upserts and
-- removes go through storage.objects policies, which are NOT changed here.
--
-- WHAT THIS DOES NOT DO: files in a public bucket can still be downloaded by
-- anyone who has (or can guess) the exact URL. Closing that needs private
-- buckets + short-lived signed URLs issued by an authenticated server route,
-- which is part of the lockdown project.
--
-- If your role is not allowed to change these functions the block prints a
-- WARNING for each one instead of failing; tell me what it printed.

DO $$
DECLARE
  fn regprocedure;
  done int := 0;
BEGIN
  FOR fn IN
    SELECT p.oid::regprocedure
      FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'storage' AND p.proname LIKE 'search%'
  LOOP
    BEGIN
      EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon', fn);
      -- keep the roles that legitimately list (the dashboard uses service_role / owner)
      EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated, service_role', fn);
      done := done + 1;
      RAISE NOTICE 'anon can no longer execute %', fn;
    EXCEPTION WHEN insufficient_privilege OR undefined_object THEN
      RAISE WARNING 'could not change % (%): %', fn, SQLSTATE, SQLERRM;
    END;
  END LOOP;
  RAISE NOTICE 'storage listing disabled for anon on % function(s)', done;
END $$;
