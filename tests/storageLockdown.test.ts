// The 20260929090000_storage_lockdown migration, against a stub of Supabase's
// storage schema seeded with the four blanket policies actually found live.
import { describe, it, expect, beforeAll } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import type { PGlite } from "@electric-sql/pglite";
import { newDb } from "./helpers/pg";

const MIGRATION = readFileSync(path.resolve(__dirname, "../supabase/migrations/20260929090000_storage_lockdown.sql"), "utf8");
let db: PGlite;

const ALL_BUCKETS = ["animal-photos", "attachments", "documents", "evidence", "platform-assets", "rescue_groups", "signatures"];

async function as_(role: string, fn: () => Promise<unknown>) {
  await db.exec(`SET ROLE ${role}`);
  try { return await fn(); } finally { await db.exec("RESET ROLE"); }
}
// RLS on SELECT/UPDATE/DELETE filters rows via an implicit WHERE, silently
// affecting zero rows when no policy matches - it does NOT throw. Only a
// failing INSERT ... WITH CHECK throws. So "did it throw" is the wrong test
// for three of these four; what matters is whether a row was actually
// returned/affected, which is why every query below uses RETURNING/checks rows.
async function canSelect(role: string, bucket: string) {
  try {
    const r = await as_(role, () => db.query(`SELECT 1 FROM storage.objects WHERE bucket_id = $1`, [bucket])) as { rows: unknown[] };
    return r.rows.length > 0;
  } catch { return false; }
}
async function canInsert(role: string, bucket: string, name: string) {
  try { await as_(role, () => db.query(`INSERT INTO storage.objects (bucket_id, name) VALUES ($1, $2)`, [bucket, name])); return true; } catch { return false; }
}
async function canUpdate(role: string, bucket: string) {
  try {
    const r = await as_(role, () => db.query(`UPDATE storage.objects SET name = name WHERE bucket_id = $1 RETURNING id`, [bucket])) as { rows: unknown[] };
    return r.rows.length > 0;
  } catch { return false; }
}
async function canDelete(role: string, bucket: string, name: string) {
  try {
    const r = await as_(role, () => db.query(`DELETE FROM storage.objects WHERE bucket_id = $1 AND name = $2 RETURNING id`, [bucket, name])) as { rows: unknown[] };
    return r.rows.length > 0;
  } catch { return false; }
}

beforeAll(async () => {
  db = await newDb();
  await db.exec(`
    CREATE ROLE service_role NOLOGIN BYPASSRLS;
    CREATE SCHEMA storage;
    GRANT USAGE ON SCHEMA storage TO anon, authenticated, service_role;

    CREATE TABLE storage.buckets (id text PRIMARY KEY, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
    CREATE TABLE storage.objects (id uuid DEFAULT gen_random_uuid() PRIMARY KEY, bucket_id text, name text);
    GRANT ALL ON storage.buckets, storage.objects TO anon, authenticated, service_role;
    ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

    -- The four blanket policies actually found live: role public, USING/CHECK true, every bucket.
    CREATE POLICY "Allow all reads"   ON storage.objects FOR SELECT USING (true);
    CREATE POLICY "Allow all uploads" ON storage.objects FOR INSERT WITH CHECK (true);
    CREATE POLICY "Allow all updates" ON storage.objects FOR UPDATE USING (true);
    CREATE POLICY "Allow all deletes" ON storage.objects FOR DELETE USING (true);
  `);
  for (const b of ALL_BUCKETS) {
    await db.exec(`INSERT INTO storage.buckets (id, name, public) VALUES ('${b}', '${b}', true)`);
    await db.exec(`INSERT INTO storage.objects (bucket_id, name) VALUES ('${b}', 'existing-file.jpg')`);
  }
  await db.exec(MIGRATION);
});

describe("before/after: anon capability per bucket, actually exercised, not inferred from policy text", () => {
  it.each([
    ["animal-photos", { select: true, insert: false, update: false, delete: false }],
    ["platform-assets", { select: true, insert: false, update: false, delete: false }],
    ["evidence", { select: false, insert: false, update: false, delete: false }],
    ["documents", { select: false, insert: false, update: false, delete: false }],
    ["signatures", { select: false, insert: false, update: false, delete: false }],
    ["attachments", { select: false, insert: false, update: false, delete: false }],
    ["rescue_groups", { select: false, insert: false, update: false, delete: false }],
  ])("%s", async (bucket, expected) => {
    expect(await canSelect("anon", bucket), "select").toBe(expected.select);
    expect(await canInsert("anon", bucket, "new-file.jpg"), "insert").toBe(expected.insert);
    expect(await canUpdate("anon", bucket), "update").toBe(expected.update);
    expect(await canDelete("anon", bucket, "existing-file.jpg"), "delete").toBe(expected.delete);
  });
});

describe("the three new buckets", () => {
  it("pet-license-documents: anon can insert only, nothing else", async () => {
    expect(await canInsert("anon", "pet-license-documents", "app-1.pdf")).toBe(true);
    expect(await canSelect("anon", "pet-license-documents")).toBe(false);
    expect(await canUpdate("anon", "pet-license-documents")).toBe(false);
    expect(await canDelete("anon", "pet-license-documents", "app-1.pdf")).toBe(false);
  });

  it("lost-found-photos and foster-update-photos: anon can read and insert, never update or delete", async () => {
    for (const b of ["lost-found-photos", "foster-update-photos"]) {
      expect(await canInsert("anon", b, "photo-1.jpg"), b).toBe(true);
      expect(await canSelect("anon", b), b).toBe(true);
      expect(await canUpdate("anon", b), b).toBe(false);
      expect(await canDelete("anon", b, "photo-1.jpg"), b).toBe(false);
    }
  });

  it("bucket public flags are set correctly", async () => {
    const rows = (await db.query<{ id: string; public: boolean }>(`SELECT id, public FROM storage.buckets ORDER BY id`)).rows;
    const byId = Object.fromEntries(rows.map((r) => [r.id, r.public]));
    expect(byId["animal-photos"]).toBe(true);
    expect(byId["platform-assets"]).toBe(true);
    expect(byId["pet-license-documents"]).toBe(false);
    expect(byId["lost-found-photos"]).toBe(true);
    expect(byId["foster-update-photos"]).toBe(true);
    for (const b of ["evidence", "documents", "signatures", "attachments", "rescue_groups"]) {
      expect(byId[b], b).toBe(false);
    }
  });
});

describe("service_role", () => {
  it("bypasses RLS on every bucket regardless of the policies above (Supabase's actual behavior, not something these policies grant)", async () => {
    for (const b of [...ALL_BUCKETS, "pet-license-documents", "lost-found-photos", "foster-update-photos"]) {
      expect(await canSelect("service_role", b), b).toBe(true);
      expect(await canInsert("service_role", b, `svc-${b}.jpg`), b).toBe(true);
      expect(await canUpdate("service_role", b), b).toBe(true);
    }
  });
});

describe("re-running the migration", () => {
  it("is idempotent", async () => {
    await db.exec(MIGRATION);
    expect(await canSelect("anon", "animal-photos")).toBe(true);
    expect(await canSelect("anon", "evidence")).toBe(false);
  });
});
