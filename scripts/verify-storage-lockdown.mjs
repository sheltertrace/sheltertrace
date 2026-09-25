// Read-only check of what the PUBLIC anon key can do with storage, before/after
// migration 20260925171000_storage_disable_listing.sql.
//
//   node scripts/verify-storage-lockdown.mjs [bucket/path/to/a/known/file.png ...]
//
// Uses NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY from the
// environment or .env.local. It only lists and downloads; it never uploads,
// changes or deletes anything. File names are never printed - only counts.
import { readFileSync, existsSync } from "node:fs";

const env = { ...process.env };
if (existsSync(".env.local")) {
  for (const line of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
    const i = line.indexOf("=");
    if (i > 0 && !(line.slice(0, i).trim() in env)) env[line.slice(0, i).trim()] = line.slice(i + 1).trim();
  }
}
const url = env.NEXT_PUBLIC_SUPABASE_URL;
const key = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
if (!url || !key) { console.error("Missing NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY"); process.exit(2); }
const headers = { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" };

const buckets = ["evidence", "documents", "animal-photos", "report-attachments", "witness-attachments"];
let listable = 0;
for (const b of buckets) {
  const r = await fetch(`${url}/storage/v1/object/list/${b}`, { method: "POST", headers, body: JSON.stringify({ prefix: "", limit: 5, offset: 0 }) });
  let n = null;
  try { const j = await r.json(); n = Array.isArray(j) ? j.length : null; } catch { /* not json */ }
  const open = r.ok && n !== null && n > 0;
  if (open) listable++;
  console.log(`list  ${b.padEnd(20)} HTTP ${r.status}  ${open ? `LISTABLE (${n}+ names returned)` : "not listable"}`);
}

for (const p of process.argv.slice(2)) {
  const r = await fetch(`${url}/storage/v1/object/public/${p}`, { method: "HEAD" });
  console.log(`fetch public/${p.split("/")[0]}/…  HTTP ${r.status}  ${r.ok ? "still downloadable by exact URL (expected until signed URLs)" : "NOT downloadable"}`);
}
console.log(listable ? `\n${listable} bucket(s) can still be listed by anyone.` : "\nNo bucket can be listed with the anon key.");
