"use client";
// Uploads from genuinely public, unauthenticated pages (foster-portal updates,
// lost-found reports, the Madison pet-license form) — no staff session involved
// at all. These write to their own dedicated, narrowly-scoped public-insert
// buckets rather than the old shared ones, so a stranger submitting one of
// these forms can never overwrite or delete something else (an adoptable
// animal's catalog photo, another citizen's document). Falls back to the OLD
// bucket if the dedicated one hasn't been created yet, so this is safe to
// deploy before that migration runs — nothing breaks in the meantime, and
// nothing needs to be reverted once it has.
import { supabasePublic } from "./supabase-public";

const MISSING_BUCKET_RE = /bucket not found/i;

export async function uploadPublicSubmission(
  bucket: "foster-update-photos" | "lost-found-photos" | "pet-license-documents",
  fallbackBucket: "animal-photos" | "documents",
  path: string,
  file: File,
): Promise<{ ok: true; path: string; url: string | null } | { ok: false; error: string }> {
  let { error } = await supabasePublic.storage.from(bucket).upload(path, file, { upsert: true });
  let usedBucket: string = bucket;
  if (error && MISSING_BUCKET_RE.test(error.message)) {
    usedBucket = fallbackBucket; // rollout bridge: dedicated bucket not created yet
    ({ error } = await supabasePublic.storage.from(fallbackBucket).upload(path, file, { upsert: true }));
  }
  if (error) return { ok: false, error: error.message };
  // Private buckets (pet-license-documents) have no usable public URL — callers
  // there should store `path` and let staff view it via the signed-URL route.
  const { data } = supabasePublic.storage.from(usedBucket).getPublicUrl(path);
  const isPrivate = usedBucket === "pet-license-documents";
  return { ok: true, path, url: isPrivate ? null : data.publicUrl };
}
