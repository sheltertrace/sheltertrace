"use client";
// Client helpers for the staff-only storage routes. evidence/documents/
// pet-license-documents are private end-to-end; nothing here uses the anon
// key to touch them directly. animal-photos stays public for READ (the
// adoption page needs that), so its uploads go through this too (no more
// anon writes at all), but callers still fetch the display URL themselves
// with the ordinary public supabase client afterward, unchanged.
import { getSessionToken } from "./auth";

export class StaffStorageError extends Error {}

function authHeaders(extra?: Record<string, string>): HeadersInit {
  return { "x-staff-token": getSessionToken() || "", ...(extra || {}) };
}

async function parseErr(res: Response): Promise<string> {
  try { return ((await res.json()) as { error?: string }).error || res.statusText; }
  catch { return res.statusText; }
}

export async function uploadStaffFile(
  bucket: "evidence" | "documents" | "animal-photos" | "platform-assets",
  path: string,
  file: File | Blob,
  opts: { upsert?: boolean; contentType?: string } = {},
): Promise<{ ok: true; path: string } | { ok: false; error: string }> {
  const form = new FormData();
  form.set("bucket", bucket);
  form.set("path", path);
  form.set("file", file, (file as File).name || "upload");
  if (opts.upsert) form.set("upsert", "true");
  if (opts.contentType) form.set("contentType", opts.contentType);
  const res = await fetch("/api/staff/storage/upload", { method: "POST", headers: authHeaders(), body: form });
  if (!res.ok) return { ok: false, error: await parseErr(res) };
  const j = (await res.json()) as { path: string };
  return { ok: true, path: j.path };
}

export async function deleteStaffFiles(
  bucket: "evidence" | "documents" | "animal-photos",
  paths: string[],
): Promise<{ ok: true } | { ok: false; error: string }> {
  const res = await fetch("/api/staff/storage/delete", {
    method: "POST", headers: authHeaders({ "Content-Type": "application/json" }), body: JSON.stringify({ bucket, paths }),
  });
  if (!res.ok) return { ok: false, error: await parseErr(res) };
  return { ok: true };
}

/** A single short-lived (60s) signed URL for a staff member to view one file right now. */
export async function signStaffFileUrl(
  bucket: "evidence" | "documents" | "pet-license-documents",
  path: string,
): Promise<string | null> {
  const res = await fetch("/api/staff/storage/sign", {
    method: "POST", headers: authHeaders({ "Content-Type": "application/json" }), body: JSON.stringify({ bucket, path, purpose: "view" }),
  });
  if (!res.ok) return null;
  const j = (await res.json()) as { url: string };
  return j.url;
}

/** Batch-signs many paths at once with a longer (15 min) lifetime, for court-packet generation. */
export async function signStaffFileUrlsForCourtPacket(
  bucket: "evidence" | "documents",
  paths: string[],
): Promise<Record<string, string | null>> {
  if (paths.length === 0) return {};
  const res = await fetch("/api/staff/storage/sign", {
    method: "POST", headers: authHeaders({ "Content-Type": "application/json" }), body: JSON.stringify({ bucket, paths, purpose: "court-packet" }),
  });
  if (!res.ok) throw new StaffStorageError(await parseErr(res));
  const j = (await res.json()) as { urls: Record<string, string | null> };
  return j.urls;
}

/**
 * Historical rows store a full public URL (`.../storage/v1/object/public/<bucket>/<path>`)
 * from before the bucket went private; new rows store a bare path. Accepts either and
 * always returns just the path, so callers can pass it straight to the sign/delete routes.
 */
export function extractStoragePath(bucket: string, urlOrPath: string | null | undefined): string | null {
  if (!urlOrPath) return null;
  const marker = `/object/public/${bucket}/`;
  const i = urlOrPath.indexOf(marker);
  if (i === -1) return urlOrPath.startsWith("http") ? null : urlOrPath; // already a bare path, or an unrecognized URL
  return decodeURIComponent(urlOrPath.slice(i + marker.length).split("?")[0]);
}
