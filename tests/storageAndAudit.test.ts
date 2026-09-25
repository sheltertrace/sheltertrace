// The storage-listing migration and the read-only audit query, against a stub of Supabase's storage schema.
import { describe, it, expect, beforeAll } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import type { PGlite } from "@electric-sql/pglite";
import { newDb } from "./helpers/pg";

const sql = (f: string) => readFileSync(path.resolve(__dirname, "..", f), "utf8");
let db: PGlite;

beforeAll(async () => {
  db = await newDb();
  await db.exec(`
    CREATE ROLE service_role NOLOGIN;
    CREATE SCHEMA storage;
    GRANT USAGE ON SCHEMA storage TO anon, authenticated, service_role;
    CREATE TABLE storage.buckets (id text PRIMARY KEY, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
    CREATE TABLE storage.objects (id uuid DEFAULT gen_random_uuid(), bucket_id text, name text);
    INSERT INTO storage.buckets VALUES ('evidence','evidence',true,NULL,NULL), ('documents','documents',true,NULL,NULL);
    INSERT INTO storage.objects (bucket_id, name) VALUES ('evidence','a.pdf'), ('evidence','b.pdf'), ('documents','c.png');
    ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
    CREATE POLICY evidence_read ON storage.objects FOR SELECT USING (bucket_id = 'evidence');
    CREATE FUNCTION storage.search(prefix text, bucketname text) RETURNS TABLE(name text) LANGUAGE sql AS $$ SELECT name FROM storage.objects WHERE bucket_id = bucketname $$;
    CREATE FUNCTION storage.search_v2(prefix text, bucket_name text) RETURNS TABLE(name text) LANGUAGE sql AS $$ SELECT name FROM storage.objects WHERE bucket_id = bucket_name $$;
    GRANT EXECUTE ON FUNCTION storage.search(text, text) TO anon;   -- explicit grants as Supabase does
    CREATE TABLE public.people (id int, dob text);
    ALTER TABLE public.people ENABLE ROW LEVEL SECURITY;
    CREATE POLICY allow_all ON public.people FOR ALL USING (true) WITH CHECK (true);
    GRANT SELECT, INSERT ON public.people TO anon;
    GRANT SELECT ON storage.objects TO anon, service_role;
  `);
});

describe("read-only audit query", () => {
  it("runs, changes nothing, and reports what anon can do", async () => {
    const before = (await db.query(`SELECT count(*)::int AS n FROM pg_proc`)).rows;
    const out = (await db.query<{ j: string }>(sql("supabase/audit/anon_exposure_audit.sql"))).rows[0];
    const report = JSON.parse(Object.values(out)[0] as string);
    const people = report.tables.find((t: { table: string }) => t.table === "people");
    expect(people).toMatchObject({ rls_enabled: true, anon: "INSERT,SELECT" });
    expect(people.policies[0]).toMatchObject({ name: "allow_all", cmd: "ALL", using: "true" });
    expect(report.storage.buckets).toEqual(expect.arrayContaining([expect.objectContaining({ bucket: "evidence", public: true, objects: 2 })]));
    expect(report.storage.policies_on_objects[0]).toMatchObject({ name: "evidence_read", cmd: "SELECT" });
    expect(report.storage.list_functions_anon_can_execute.length).toBeGreaterThan(0);
    expect((await db.query(`SELECT count(*)::int AS n FROM pg_proc`)).rows).toEqual(before);
  });
});

describe("20260925171000_storage_disable_listing", () => {
  it("anon can no longer call the list functions, but keeps its other storage rights", async () => {
    await db.exec("SET ROLE anon");
    expect((await db.query(`SELECT * FROM storage.search('', 'evidence')`)).rows).toHaveLength(2);   // before
    await db.exec("RESET ROLE");

    await db.exec(sql("supabase/migrations/20260925171000_storage_disable_listing.sql"));

    await db.exec("SET ROLE anon");
    await expect(db.query(`SELECT * FROM storage.search('', 'evidence')`)).rejects.toThrow(/permission denied/i);
    await expect(db.query(`SELECT * FROM storage.search_v2('', 'documents')`)).rejects.toThrow(/permission denied/i);
    // the object policies are untouched, so uploads/upserts/removes/public URLs are unaffected
    expect((await db.query(`SELECT name FROM storage.objects WHERE bucket_id = 'evidence' AND name = 'a.pdf'`)).rows).toHaveLength(1);
    await db.exec("RESET ROLE");

    await db.exec("SET ROLE service_role");
    expect((await db.query(`SELECT * FROM storage.search('', 'evidence')`)).rows).toHaveLength(2);   // legitimate callers keep it
    await db.exec("RESET ROLE");
  });

  it("is idempotent", async () => {
    await db.exec(sql("supabase/migrations/20260925171000_storage_disable_listing.sql"));
  });
});
