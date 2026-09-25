-- READ-ONLY. Changes nothing. Run in the Supabase SQL editor as a single query,
-- then click the one result cell and copy its value (Studio: right-click the
-- cell -> "Copy" / or the copy icon) and paste it back.
--
-- It reports, for the `anon` role (the public key baked into the website):
--   tables    every table/view in `public`: is row-level security on, which
--             privileges anon / authenticated / PUBLIC hold (r=SELECT a=INSERT
--             w=UPDATE d=DELETE D=TRUNCATE x=REFERENCES t=TRIGGER), and every
--             RLS policy on it (a qual of "true" means "everyone")
--   column_grants   column-level privileges that differ from the table level
--   functions       every function in `public` that anon can EXECUTE, and whether
--                   it is SECURITY DEFINER (runs with its owner's rights)
--   storage         buckets (public or not), object counts, the policies on
--                   storage.objects, anon's privileges, and who may call the
--                   storage list functions
--   realtime        tables published to Realtime (anon can subscribe to these)
select jsonb_pretty(jsonb_build_object(
  'generated_at', now(),

  'tables', (
    select coalesce(jsonb_agg(t order by t->>'table'), '[]'::jsonb) from (
      select jsonb_build_object(
        'table', c.relname,
        'kind',  case c.relkind when 'r' then 'table' when 'p' then 'partitioned' when 'v' then 'view' when 'm' then 'matview' else c.relkind::text end,
        'rls_enabled', c.relrowsecurity,
        'rls_forced',  c.relforcerowsecurity,
        'anon',          (select coalesce(string_agg(distinct privilege_type, ',' order by privilege_type), '') from information_schema.role_table_grants g where g.table_schema = 'public' and g.table_name = c.relname and g.grantee = 'anon'),
        'authenticated', (select coalesce(string_agg(distinct privilege_type, ',' order by privilege_type), '') from information_schema.role_table_grants g where g.table_schema = 'public' and g.table_name = c.relname and g.grantee = 'authenticated'),
        'public',        (select coalesce(string_agg(distinct privilege_type, ',' order by privilege_type), '') from information_schema.role_table_grants g where g.table_schema = 'public' and g.table_name = c.relname and g.grantee = 'PUBLIC'),
        'policies', (select coalesce(jsonb_agg(jsonb_build_object(
                       'name', p.policyname, 'cmd', p.cmd, 'roles', p.roles,
                       'permissive', p.permissive, 'using', p.qual, 'with_check', p.with_check)), '[]'::jsonb)
                     from pg_policies p where p.schemaname = 'public' and p.tablename = c.relname)
      ) as t
      from pg_class c join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relkind in ('r', 'p', 'v', 'm', 'f')
    ) s
  ),

  'column_grants', (
    select coalesce(jsonb_agg(jsonb_build_object('table', c.relname, 'column', a.attname, 'acl', a.attacl::text) order by c.relname, a.attname), '[]'::jsonb)
    from pg_attribute a
    join pg_class c on c.oid = a.attrelid
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and a.attacl is not null and not a.attisdropped and a.attnum > 0
  ),

  'functions', (
    select coalesce(jsonb_agg(jsonb_build_object(
             'function', p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')',
             'security_definer', p.prosecdef) order by p.proname), '[]'::jsonb)
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.prokind = 'f' and has_function_privilege('anon', p.oid, 'EXECUTE')
  ),

  'storage', jsonb_build_object(
    'buckets', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'bucket', b.id, 'public', b.public, 'file_size_limit', b.file_size_limit,
               'allowed_mime_types', b.allowed_mime_types,
               'objects', (select count(*) from storage.objects o where o.bucket_id = b.id)) order by b.id), '[]'::jsonb)
      from storage.buckets b),
    'policies_on_objects', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'name', p.policyname, 'cmd', p.cmd, 'roles', p.roles,
               'using', p.qual, 'with_check', p.with_check) order by p.policyname), '[]'::jsonb)
      from pg_policies p where p.schemaname = 'storage' and p.tablename = 'objects'),
    'anon_table_privileges_on_objects', (
      select coalesce(string_agg(distinct privilege_type, ',' order by privilege_type), '')
      from information_schema.role_table_grants g
      where g.table_schema = 'storage' and g.table_name = 'objects' and g.grantee = 'anon'),
    'list_functions_anon_can_execute', (
      select coalesce(jsonb_agg(p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')' order by p.proname), '[]'::jsonb)
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'storage' and p.proname like 'search%' and has_function_privilege('anon', p.oid, 'EXECUTE'))
  ),

  'realtime', (
    select coalesce(jsonb_agg(schemaname || '.' || tablename order by tablename), '[]'::jsonb)
    from pg_publication_tables where pubname = 'supabase_realtime')
));
