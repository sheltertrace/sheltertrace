// Field-fillable MCAS Animal Intake Form — draft autosave, offline queue,
// and the actual submission pipeline (create/link person, create animal,
// upload photos, store the intake form as an animal document).
import { supabase } from "./supabase";
import { nullifyEmptyDates, nullifyEmptyBooleans } from "./sanitize";
import { createAnimal, createPerson, linkAnimalToPerson, addAnimalNote, uploadAnimalDocument, fetchCall, updateCall } from "./data";
import { buildIntakeFormHTML } from "./intakeFormPrint";
import type { Animal, Person } from "./types";

const DRAFT_KEY = "field_intake_draft_v1";
const QUEUE_KEY = "field_intake_queue_v1";

// ── Draft (single in-progress form, autosaved on every change) ────────────────

export interface FieldIntakeDraft {
  [key: string]: unknown;
}

export function saveDraft(draft: FieldIntakeDraft): void {
  try { localStorage.setItem(DRAFT_KEY, JSON.stringify({ ...draft, _savedAt: new Date().toISOString() })); } catch { /* storage full/unavailable — draft just won't persist */ }
}

export function loadDraft(): FieldIntakeDraft | null {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    return raw ? (JSON.parse(raw) as FieldIntakeDraft) : null;
  } catch { return null; }
}

export function clearDraft(): void {
  try { localStorage.removeItem(DRAFT_KEY); } catch { /* ignore */ }
}

// ── Submission payload ─────────────────────────────────────────────────────────
// `photos` is File[] for a live in-session submission, or string[] (data
// URLs) once round-tripped through the local offline queue — File objects
// don't survive JSON serialization.

export interface FieldIntakeSubmission<P = File[] | string[]> {
  officerId: string;
  officerName: string;
  animal: Partial<Animal>;
  personRole: "Previous Owner" | "Finder" | null;
  personId?: string; // existing person selected via search
  personDraft?: Partial<Person>; // new person to create if personId not set
  officerNotes?: string;
  linkedCallId?: string;
  signatures: { surrender?: string | null; finder?: string | null };
  photos: P;
}

// ── Offline queue (completed submissions waiting to sync) ─────────────────────

export interface QueuedFieldIntake {
  localId: string;
  queuedAt: string;
  attempts: number;
  lastError?: string;
  submission: FieldIntakeSubmission<string[]>;
}

function readQueue(): QueuedFieldIntake[] {
  try {
    const raw = localStorage.getItem(QUEUE_KEY);
    return raw ? (JSON.parse(raw) as QueuedFieldIntake[]) : [];
  } catch { return []; }
}

function writeQueue(items: QueuedFieldIntake[]): void {
  try { localStorage.setItem(QUEUE_KEY, JSON.stringify(items)); } catch { /* ignore */ }
}

export function getQueuedIntakes(): QueuedFieldIntake[] {
  return readQueue();
}

export function queueFieldIntake(submission: FieldIntakeSubmission<string[]>): QueuedFieldIntake {
  const queued: QueuedFieldIntake = {
    localId: `FI-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    queuedAt: new Date().toISOString(),
    attempts: 0,
    submission,
  };
  const items = readQueue();
  items.push(queued);
  writeQueue(items);
  return queued;
}

function removeFromQueue(localId: string): void {
  writeQueue(readQueue().filter((q) => q.localId !== localId));
}

function updateQueueItem(localId: string, patch: Partial<QueuedFieldIntake>): void {
  writeQueue(readQueue().map((q) => q.localId === localId ? { ...q, ...patch } : q));
}

// ── Submission pipeline ────────────────────────────────────────────────────────

const ANIMAL_DATE_KEYS = ["dob", "assessment_date"] as const;
const ANIMAL_BOOL_KEYS = [
  "fixed", "is_cruelty_case", "is_dangerous", "finder_wants_if_unclaimed",
  "finder_wants_adoption_contact", "statement_of_surrender_acknowledged",
  "condition_visible_injury", "condition_signs_of_illness",
  "condition_parasites_observed", "condition_pregnant_nursing",
] as const;

async function dataUrlToFile(dataUrl: string, name: string): Promise<File> {
  const res = await fetch(dataUrl);
  const blob = await res.blob();
  return new File([blob], name, { type: blob.type || "image/jpeg" });
}

async function resolvePhotoFiles(photos: File[] | string[]): Promise<File[]> {
  const files: File[] = [];
  for (let i = 0; i < photos.length; i++) {
    const item = photos[i];
    files.push(typeof item === "string" ? await dataUrlToFile(item, `field-photo-${i + 1}.jpg`) : item);
  }
  return files;
}

async function updateAnimalPhotos(animalId: string, urls: string[]): Promise<void> {
  const { data } = await supabase.from("animals").select("photo_urls, photo_url").eq("id", animalId).single();
  const existing = (data?.photo_urls as string[] | null) || [];
  await supabase.from("animals").update({
    photo_urls: [...existing, ...urls],
    photo_url: data?.photo_url || urls[0],
  }).eq("id", animalId);
}

export interface FieldIntakeResult {
  animal: Animal;
  queueRowId: string;
}

// Does the real work: writes a durable field_intake_queue row first so a
// failure partway through (bad photo upload, flaky connection) still leaves
// a reviewable record with the error attached, then creates/links the
// person, creates the animal (auto-schedules intake vaccines via the same
// path the desktop intake wizard uses), uploads photos, links the dispatch
// call, and stores the filled intake form as an animal document.
export async function submitFieldIntake(sub: FieldIntakeSubmission): Promise<FieldIntakeResult> {
  const { data: queueRow, error: queueErr } = await supabase
    .from("field_intake_queue")
    .insert({
      officer_id: sub.officerId,
      form_data: sub.animal,
      signatures: sub.signatures,
      photos: [],
      submitted_at: new Date().toISOString(),
      synced: false,
    })
    .select()
    .single();
  if (queueErr) throw queueErr;
  const queueRowId = (queueRow as { id: string }).id;

  try {
    // 1. Resolve the owner/finder person
    let personId = sub.personId || null;
    if (!personId && sub.personDraft && (sub.personDraft.first_name || sub.personDraft.last_name)) {
      const created = await createPerson({ ...sub.personDraft, role: sub.personRole || "Contact" });
      personId = created.id;
    }

    // 2. Sanitize + create the animal record (auto-schedules intake vaccines)
    const animalPayload = nullifyEmptyBooleans(
      nullifyEmptyDates({ ...sub.animal }, ANIMAL_DATE_KEYS),
      ANIMAL_BOOL_KEYS
    );
    const created = await createAnimal(animalPayload);

    // 3. Link the person
    if (personId && sub.personRole) {
      await linkAnimalToPerson(created.id, personId, sub.personRole);
    }

    // 4. Officer notes
    if (sub.officerNotes?.trim()) {
      await addAnimalNote(created.id, sub.officerNotes.trim(), "Intake");
    }

    // 5. Upload photos (File[] when live; data-URL strings when replayed from the local queue)
    const files = await resolvePhotoFiles(sub.photos);
    const uploadedPhotoUrls: string[] = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const path = `${created.id}/field-intake/${Date.now()}-${i}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
      const { error: upErr } = await supabase.storage.from("animal-photos").upload(path, file, { upsert: false, contentType: file.type });
      if (!upErr) {
        const { data: urlData } = supabase.storage.from("animal-photos").getPublicUrl(path);
        uploadedPhotoUrls.push(urlData.publicUrl);
      }
    }
    if (uploadedPhotoUrls.length > 0) {
      await updateAnimalPhotos(created.id, uploadedPhotoUrls);
    }

    // 6. Link to an open dispatch call, if selected
    if (sub.linkedCallId) {
      const call = await fetchCall(sub.linkedCallId);
      if (call) {
        const existingIds = (call.animal_ids || []) as string[];
        if (!existingIds.includes(created.id)) {
          await updateCall(call.id, { animal_ids: [...existingIds, created.id] });
        }
      }
    }

    // 7. Store the filled intake form as an animal document
    try {
      const html = buildIntakeFormHTML({ ...created, photo_url: uploadedPhotoUrls[0] || created.photo_url });
      const htmlFile = new File([html], `MCAS_Intake_Form_${created.id}.html`, { type: "text/html" });
      await uploadAnimalDocument(created.id, created.name, htmlFile, "Intake Form", "Generated from field intake", sub.officerName);
    } catch (docErr) {
      console.error("[field-intake] failed to store intake form document:", docErr);
    }

    // 8. Mark the queue row synced
    await supabase.from("field_intake_queue").update({
      synced: true, synced_at: new Date().toISOString(), animal_id: created.id, photos: uploadedPhotoUrls,
    }).eq("id", queueRowId);

    return { animal: created, queueRowId };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await supabase.from("field_intake_queue").update({ error: message }).eq("id", queueRowId).then(() => {}, () => {});
    throw err;
  }
}

// ── Sync processing ────────────────────────────────────────────────────────────
// Called on 'online' events and periodically — replays anything queued while
// offline or left over from a failed submission attempt.

let syncing = false;

export async function processFieldIntakeQueue(onProgress?: (remaining: number) => void): Promise<void> {
  if (syncing || (typeof navigator !== "undefined" && !navigator.onLine)) return;
  syncing = true;
  try {
    for (const item of readQueue()) {
      try {
        await submitFieldIntake(item.submission);
        removeFromQueue(item.localId);
      } catch (err) {
        updateQueueItem(item.localId, {
          attempts: item.attempts + 1,
          lastError: err instanceof Error ? err.message : String(err),
        });
      }
      onProgress?.(readQueue().length);
    }
  } finally {
    syncing = false;
  }
}
