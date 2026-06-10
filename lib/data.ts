"use client";
import { supabase } from "./supabase";
import type { Animal, Person, MedicalRecord, DispatchCall, Citation, Receipt, AdoptionRecord, Officer, DispositionEntry, MicrochipRegistration, MicrochipSearch, FosterPlacement, FosterUpdate, FosterCheckin, FosterApplication, FosterSupplyRequest, LostFoundReport, LostFoundMatch, PetLicense, CitizenReport, DrugInventory, EuthanasiaLog, DrugReconciliation } from "./types";
import { genId, genReceiptId, today } from "./utils";
import { IS_DEMO, getDemoSessionId } from "./demo";

// Helper: in demo mode, return { demo_session_id } so that newly-created
// records are tagged with the current session and can be cleaned up on reset.
// Returns {} in production so no extra fields are ever sent.
function demoTag(): Record<string, string> {
  if (!IS_DEMO) return {};
  const id = getDemoSessionId();
  return id ? { demo_session_id: id } : {};
}

// ── Safe field parsers (Supabase may return TEXT instead of array/JSON) ───────

/** Returns a string[] regardless of whether the DB stored it as TEXT, JSON array, or actual array. */
export function safeArray(value: unknown): string[] {
  if (Array.isArray(value)) return value as string[];
  if (typeof value === "string" && value.trim().startsWith("[")) {
    try { const p = JSON.parse(value); if (Array.isArray(p)) return p as string[]; } catch { /* fall through */ }
  }
  if (typeof value === "string" && value.trim()) return value.split(",").map((s) => s.trim()).filter(Boolean);
  return [];
}

/** Joins an animal_names field safely — handles string, array, or null. */
export function safeAnimalNames(value: unknown, limit?: number): string {
  if (!value) return "N/A";
  const arr = typeof value === "string" && !value.trim().startsWith("[")
    ? value.split(",").map((s) => s.trim()).filter(Boolean)
    : safeArray(value);
  if (!arr.length) return typeof value === "string" && value.trim() ? value : "N/A";
  const shown = limit ? arr.slice(0, limit) : arr;
  return shown.join(", ") + (limit && arr.length > limit ? "…" : "");
}

/** Parses a JSONB/TEXT field that should be an array of objects. */
export function safeJsonArray(value: unknown): Record<string, unknown>[] {
  if (Array.isArray(value)) return value as Record<string, unknown>[];
  if (typeof value === "string" && value.trim().startsWith("[")) {
    try { const p = JSON.parse(value); if (Array.isArray(p)) return p as Record<string, unknown>[]; } catch { /* fall through */ }
  }
  return [];
}

/** Parses a JSONB/TEXT field that should be a single object. */
export function safeJsonObject(value: unknown): Record<string, unknown> | null {
  if (value && typeof value === "object" && !Array.isArray(value)) return value as Record<string, unknown>;
  if (typeof value === "string" && value.trim().startsWith("{")) {
    try { return JSON.parse(value) as Record<string, unknown>; } catch { /* fall through */ }
  }
  return null;
}

// ── Animals ──────────────────────────────────────────────────────────────────
export async function fetchAnimals(): Promise<Animal[]> {
  const PAGE = 1000;
  const all: Animal[] = [];
  let offset = 0;
  while (true) {
    const { data, error } = await supabase
      .from("animals")
      .select("*")
      .neq("intake_type", "Clinic") // Clinic visits live in /clinic, not the main list
      .order("created_at", { ascending: false })
      .range(offset, offset + PAGE - 1);
    if (error || !data || data.length === 0) break;
    all.push(...(data as Animal[]));
    if (data.length < PAGE) break;
    offset += PAGE;
  }
  return all;
}

// ── Clinic visits ─────────────────────────────────────────────────────────────
export interface ClinicVisitRecord extends Animal {
  ownerName?: string;
  ownerPhone?: string;
  ownerPersonId?: string;
  services?: MedicalRecord[];
}

export async function fetchClinicVisits(date?: string): Promise<ClinicVisitRecord[]> {
  const targetDate = date || new Date().toISOString().split("T")[0];

  const [animalsRes, medRes] = await Promise.all([
    supabase
      .from("animals")
      .select("*")
      .eq("intake_type", "Clinic")
      .eq("intake_date", targetDate)
      .order("created_at", { ascending: true }),
    supabase
      .from("medical_records")
      .select("*")
      .order("created_at", { ascending: true }),
  ]);

  const animals = (animalsRes.data as Animal[] | null) ?? [];
  if (animals.length === 0) return [];

  const allMed = (medRes.data as MedicalRecord[] | null) ?? [];

  // Fetch owner links
  const animalIds = animals.map((a) => a.id);
  const { data: links } = await supabase
    .from("animal_people")
    .select("animal_id, person_id")
    .in("animal_id", animalIds);

  const personIds = [...new Set(((links as { animal_id: string; person_id: string }[] | null) ?? []).map((l) => l.person_id))];
  const { data: people } = personIds.length
    ? await supabase.from("people").select("id, first_name, last_name, phone").in("id", personIds)
    : { data: [] };

  const linkRows = (links as { animal_id: string; person_id: string }[] | null) ?? [];
  const peopleRows = (people as { id: string; first_name: string; last_name: string; phone?: string }[] | null) ?? [];

  return animals.map((animal) => {
    const link = linkRows.find((l) => l.animal_id === animal.id);
    const person = link ? peopleRows.find((p) => p.id === link.person_id) : null;
    return {
      ...animal,
      ownerName: person ? `${person.first_name} ${person.last_name}`.trim() : undefined,
      ownerPhone: person?.phone,
      ownerPersonId: person?.id,
      services: allMed.filter((m) => m.animal_id === animal.id),
    };
  });
}

export async function fetchAnimal(id: string): Promise<Animal | null> {
  const { data } = await supabase.from("animals").select("*").eq("id", id).single();
  return (data as Animal) || null;
}

async function genAnimalId(): Promise<string> {
  const now = new Date();
  const yy = String(now.getFullYear()).slice(2);
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const prefix = `${yy}-${mm}-`;
  const { data } = await supabase.from("animals").select("id").like("id", `${prefix}%`).order("id", { ascending: false }).limit(1);
  let seq = 1;
  if (data && data.length > 0) {
    const parts = (data[0] as { id: string }).id.split("-");
    const last = parseInt(parts[2] || "0", 10);
    if (!isNaN(last)) seq = last + 1;
  }
  return `${prefix}${String(seq).padStart(3, "0")}`;
}

const INTAKE_VACCINES: Record<string, Array<{ type: string; description: string; test_result?: string }>> = {
  Dog: [
    { type: "Vaccination", description: "DHPP (Distemper/Parvo)" },
    { type: "Vaccination", description: "Bordetella" },
    { type: "Treatment", description: "Strongid / Dewormer" },
    { type: "Heartworm Test", description: "Heartworm Antigen Test", test_result: "Pending" },
  ],
  Cat: [
    { type: "Vaccination", description: "FVRCP" },
    { type: "Treatment", description: "Strongid / Dewormer" },
    { type: "FIV/FeLV Combo Test", description: "FIV/FeLV Combo Test", test_result: "Pending" },
  ],
};

export async function createAnimal(animal: Partial<Animal>): Promise<Animal> {
  const id = await genAnimalId();
  const { data, error } = await supabase
    .from("animals")
    .insert({ ...animal, id, created_at: new Date().toISOString(), updated_at: new Date().toISOString(), ...demoTag() })
    .select()
    .single();
  if (error) throw error;
  const created = data as Animal;

  // Auto-create intake vaccination/treatment records with status "Scheduled".
  // Staff must explicitly confirm each one as given before it shows as administered.
  const vaccines = INTAKE_VACCINES[created.species] || [];
  if (vaccines.length > 0) {
    const now = new Date();
    const dueDate = new Date(now);
    dueDate.setFullYear(dueDate.getFullYear() + 1);
    const dueDateStr = dueDate.toISOString().split("T")[0];
    const intakeDate = created.intake_date || now.toISOString().split("T")[0];
    const medResults = await Promise.all(vaccines.map((v) =>
      supabase.from("medical_records").insert({
        id: `M-${genId()}`,
        animal_id: created.id,
        animal_name: created.name,
        type: v.type,
        description: v.description,
        date: intakeDate,
        next_due: v.test_result ? undefined : dueDateStr,
        vet: "",
        status: "Scheduled",
        ...(v.test_result ? { test_result: v.test_result } : {}),
      }).select().single()
    ));
    medResults.forEach(({ data, error }, i) => {
      if (error) {
        console.error(`[createAnimal] Failed to create intake medical record "${vaccines[i]?.description}":`, error.message, error.hint || "");
      } else {
        console.log(`[createAnimal] Created ${data?.status ?? "?"} record: ${data?.description}`);
      }
    });
  }

  return created;
}

// ── Public website animals ────────────────────────────────────────────────────
export async function fetchPublicAnimals(): Promise<Animal[]> {
  const { data, error } = await supabase
    .from("animals")
    .select("id, name, species, breed, color, secondary_color, sex, age, dob, weight, fixed, status, sub_status, microchip, intake_date, photo_url, featured_photo_url, photo_urls, public_bio, show_on_website, markings")
    .eq("show_on_website", true)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data as Animal[]) || [];
}

// No show_on_website filter — lets staff preview unpublished animals
export async function fetchPublicAnimal(id: string): Promise<Animal | null> {
  const { data } = await supabase.from("animals").select("*").eq("id", id).single();
  return (data as Animal) || null;
}

export async function uploadPublicAnimalPhoto(animalId: string, file: File): Promise<string> {
  const ext = file.name.split(".").pop() || "jpg";
  const path = `${animalId}/gallery/${Date.now()}.${ext}`;
  const { error } = await supabase.storage
    .from("animal-photos")
    .upload(path, file, { upsert: false, contentType: file.type });
  if (error) throw error;
  const { data } = supabase.storage.from("animal-photos").getPublicUrl(path);
  return data.publicUrl;
}

export async function deleteAnimal(id: string): Promise<void> {
  await supabase.from("animal_notes").delete().eq("animal_id", id);
  await supabase.from("medical_records").delete().eq("animal_id", id);
  await supabase.from("animal_people").delete().eq("animal_id", id);
  const { error } = await supabase.from("animals").delete().eq("id", id);
  if (error) throw error;
}

export async function updateAnimal(id: string, updates: Partial<Animal>): Promise<Animal> {
  // Strip fields that are not real DB columns (joined/virtual fields)
  const { notes: _notes, ...dbUpdates } = updates as Partial<Animal> & { notes?: unknown };
  void _notes;
  console.log("[updateAnimal] payload:", JSON.stringify(dbUpdates));
  const { data, error } = await supabase
    .from("animals")
    .update({ ...dbUpdates, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();
  if (error) {
    console.error("[updateAnimal] Supabase error:", error.message, "| code:", error.code, "| details:", error.details, "| hint:", error.hint);
    throw error;
  }
  return data as Animal;
}

// ── People ───────────────────────────────────────────────────────────────────
export async function fetchPeople(): Promise<Person[]> {
  const { data } = await supabase.from("people").select("*").order("last_name");
  return (data as Person[]) || [];
}

export async function fetchPerson(id: string): Promise<Person | null> {
  const { data } = await supabase.from("people").select("*").eq("id", id).single();
  return (data as Person) || null;
}

export async function createPerson(person: Partial<Person>): Promise<Person> {
  const id = `P-${genId()}`;
  const { data, error } = await supabase
    .from("people")
    .insert({ ...person, id, date_added: today() })
    .select()
    .single();
  if (error) throw error;
  return data as Person;
}

export async function updatePerson(id: string, updates: Partial<Person>): Promise<Person> {
  const { data, error } = await supabase
    .from("people")
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data as Person;
}

// Derive storage base from env var so demo deployment uses its own storage bucket,
// not the production one. Hardcoding the production URL here was a security gap.
const SUPABASE_STORAGE_BASE = `${(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").replace(/\/$/, "")}/storage/v1/object/public`;

export async function uploadPersonPhotoId(personId: string, file: File): Promise<string> {
  const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
  const path = `people/${personId}/photo-id.${ext}`;
  // Remove any existing photo-id files before uploading
  await supabase.storage.from("documents").remove([
    `people/${personId}/photo-id.jpg`,
    `people/${personId}/photo-id.jpeg`,
    `people/${personId}/photo-id.png`,
    `people/${personId}/photo-id.pdf`,
  ]);
  const { error } = await supabase.storage.from("documents").upload(path, file, { contentType: file.type, upsert: true });
  if (error) throw error;
  const { data: urlData } = supabase.storage.from("documents").getPublicUrl(path);
  const url = urlData.publicUrl;
  await updatePerson(personId, { photo_id_url: url });
  return url;
}

export async function deletePersonPhotoId(personId: string, photoUrl: string): Promise<void> {
  const prefix = `${SUPABASE_STORAGE_BASE}/documents/`;
  const path = photoUrl.startsWith(prefix) ? photoUrl.slice(prefix.length) : null;
  if (path) await supabase.storage.from("documents").remove([path]);
  await updatePerson(personId, { photo_id_url: undefined });
}

// ── Medical Records ──────────────────────────────────────────────────────────
export async function fetchMedical(animalId?: string): Promise<MedicalRecord[]> {
  let query = supabase.from("medical_records").select("*").order("date", { ascending: false });
  if (animalId) query = query.eq("animal_id", animalId);
  const { data } = await query;
  return (data as MedicalRecord[]) || [];
}

export async function createMedical(record: Partial<MedicalRecord>): Promise<MedicalRecord> {
  const id = `M-${genId()}`;
  const payload = { ...record, id, ...demoTag() };
  console.log("[createMedical] inserting:", JSON.stringify(payload, null, 2));
  const { data, error } = await supabase.from("medical_records").insert(payload).select().single();
  console.log("[createMedical] response data:", data, "error:", error);
  if (error) throw error;
  return data as MedicalRecord;
}

export async function updateMedical(id: string, updates: Partial<MedicalRecord>): Promise<MedicalRecord> {
  console.log("[medical edit] attempting to update record:", id, updates);
  const { data, error } = await supabase
    .from("medical_records")
    .update(updates)
    .eq("id", id)
    .select()
    .single();
  console.log("[medical edit] result:", data, error);
  if (error) {
    console.error("[updateMedical] Supabase error:", error.message, "| code:", error.code, "| details:", error.details, "| hint:", error.hint);
    // If the error is a missing column (42703), fall back to updating only base columns
    if (error.code === "42703") {
      console.warn("[updateMedical] Missing column detected — falling back to base-column update. Run fix_medical_records_columns.sql in Supabase.");
      const { description, date, vet, next_due, type } = updates;
      const baseUpdate = { ...(type && { type }), ...(description !== undefined && { description }), ...(date && { date }), ...(vet !== undefined && { vet }), ...(next_due !== undefined && { next_due }) };
      const { data: fb, error: fbErr } = await supabase.from("medical_records").update(baseUpdate).eq("id", id).select().single();
      if (fbErr) throw fbErr;
      return fb as MedicalRecord;
    }
    throw error;
  }
  return data as MedicalRecord;
}

export async function deleteMedical(id: string): Promise<void> {
  const { error } = await supabase.from("medical_records").delete().eq("id", id);
  if (error) {
    console.error("[deleteMedical] Supabase error:", error.message, "| code:", error.code);
    throw error;
  }
}

// ── Dispatch Calls ───────────────────────────────────────────────────────────
export async function fetchCalls(): Promise<DispatchCall[]> {
  const { data } = await supabase
    .from("dispatch_calls")
    .select("*")
    .order("created_at", { ascending: false });
  return (data as DispatchCall[]) || [];
}

export async function fetchCall(id: string): Promise<DispatchCall | null> {
  const { data } = await supabase.from("dispatch_calls").select("*").eq("id", id).limit(1);
  return ((data as DispatchCall[])?.[0]) || null;
}

async function genCallId(): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `CALL-${year}-`;
  const { data } = await supabase
    .from("dispatch_calls")
    .select("id")
    .like("id", `${prefix}%`)
    .order("id", { ascending: false })
    .limit(1);
  let seq = 1;
  if (data && data.length > 0) {
    const raw = (data[0] as { id: string }).id.replace(prefix, "");
    const num = parseInt(raw, 10);
    if (!isNaN(num)) seq = num + 1;
  }
  return `${prefix}${String(seq).padStart(4, "0")}`;
}

export async function createCall(call: Partial<DispatchCall>): Promise<DispatchCall> {
  const id = await genCallId();
  const insertData = { ...call, id, created_at: new Date().toISOString(), updated_at: new Date().toISOString(), ...demoTag() };
  console.log("[dispatch save data]", JSON.stringify(insertData, null, 2));
  const { data, error } = await supabase
    .from("dispatch_calls")
    .insert(insertData)
    .select()
    .single();
  if (error) {
    console.log("[dispatch save error]", JSON.stringify(error, null, 2));
    throw error;
  }
  console.log("[dispatch save success]", data);
  return data as DispatchCall;
}

export async function updateCall(id: string, updates: Partial<DispatchCall>): Promise<DispatchCall> {
  const updateData = { ...updates, updated_at: new Date().toISOString() };
  console.log("[dispatch save data]", JSON.stringify(updateData, null, 2));
  const { data, error } = await supabase
    .from("dispatch_calls")
    .update(updateData)
    .eq("id", id)
    .select()
    .single();
  if (error) {
    console.log("[dispatch save error]", JSON.stringify(error, null, 2));
    throw error;
  }
  console.log("[dispatch save success]", data);
  return data as DispatchCall;
}

// ── Citations ─────────────────────────────────────────────────────────────────
export async function fetchCitations(): Promise<Citation[]> {
  const { data } = await supabase
    .from("citations")
    .select("*")
    .order("created_at", { ascending: false });
  return (data as Citation[]) || [];
}

export async function createCitation(cit: Partial<Citation>): Promise<Citation> {
  const { data, error } = await supabase.from("citations").insert({ ...cit, ...demoTag() }).select().single();
  if (error) throw error;
  return data as Citation;
}

export async function uploadCitationPhotoId(citationNumber: string, file: File): Promise<string> {
  const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
  const path = `citations/${citationNumber}/photo-id.${ext}`;
  const exts = ["jpg", "jpeg", "png", "webp", "pdf"];
  await Promise.all(exts.map((e) => supabase.storage.from("documents").remove([`citations/${citationNumber}/photo-id.${e}`])));
  const { error } = await supabase.storage.from("documents").upload(path, file, { contentType: file.type, upsert: true });
  if (error) throw error;
  const { data } = supabase.storage.from("documents").getPublicUrl(path);
  return data.publicUrl;
}

export async function updateCitationDisposition(
  citation: Citation,
  entry: DispositionEntry,
  createFineReceipt: boolean,
): Promise<Citation> {
  const history: DispositionEntry[] = Array.isArray(citation.disposition_history)
    ? [...citation.disposition_history, entry]
    : [entry];

  const updates: Partial<Citation> = {
    status: entry.status,
    disposition_history: history,
  };
  if (entry.judgeName)              updates.judge_name = entry.judgeName;
  if (entry.dismissedReason)        updates.dismissed_reason = entry.dismissedReason;
  if (entry.fineAmount !== undefined && entry.fineAmount > 0)
                                    updates.fine_amount = entry.fineAmount;
  if (entry.amountPaid !== undefined && entry.amountPaid > 0)
                                    updates.fine_paid = String(entry.amountPaid);
  if (entry.paymentMethod)          updates.payment_method_used = entry.paymentMethod;
  if (entry.communityServiceHours)  updates.community_service_hours = entry.communityServiceHours;
  if (entry.newCourtDate)           updates.court_date = entry.newCourtDate;

  const { data, error } = await supabase.from("citations").update(updates).eq("id", citation.id).select().single();
  if (error) throw error;

  if (createFineReceipt && entry.amountPaid && entry.amountPaid > 0) {
    const violatorName = citation.violator_last
      ? [citation.violator_last, citation.violator_first].filter(Boolean).join(", ")
      : (citation.violator_name || "Unknown");
    await createReceipt({
      date: entry.date,
      category: "Services",
      line_items: [{ item: `Citation Fine — #${citation.citation_number}`, qty: 1, price: entry.amountPaid }],
      total: entry.amountPaid,
      payment_method: entry.paymentMethod || "Cash",
      anonymous: false,
      person_name: violatorName,
      notes: `Citation fine payment. Citation #${citation.citation_number}. ${entry.notes || ""}`.trim(),
    });
  }

  return data as Citation;
}

export async function updateCitation(id: string, updates: Partial<Citation>): Promise<Citation> {
  const { data, error } = await supabase.from("citations").update(updates).eq("id", id).select().single();
  if (error) throw error;
  return data as Citation;
}

// ── Receipts ──────────────────────────────────────────────────────────────────
export async function fetchReceipts(): Promise<Receipt[]> {
  const { data } = await supabase
    .from("receipts")
    .select("*")
    .order("created_at", { ascending: false });
  return (data as Receipt[]) || [];
}

export async function createReceipt(receipt: Partial<Receipt>): Promise<Receipt> {
  const id = genReceiptId();
  const { data, error } = await supabase.from("receipts").insert({ ...receipt, id }).select().single();
  if (error) throw error;
  return data as Receipt;
}

export async function fetchReceiptsByAnimal(animalId: string): Promise<Receipt[]> {
  const { data } = await supabase
    .from("receipts")
    .select("*")
    .eq("animal_id", animalId)
    .order("created_at", { ascending: false });
  return (data as Receipt[]) || [];
}

// ── Adoptions ─────────────────────────────────────────────────────────────────
export async function fetchAdoptions(): Promise<AdoptionRecord[]> {
  const { data } = await supabase
    .from("adoption_records")
    .select("*")
    .order("created_at", { ascending: false });
  return (data as AdoptionRecord[]) || [];
}

export async function fetchAdoptionsByAnimal(animalId: string): Promise<AdoptionRecord[]> {
  const { data } = await supabase
    .from("adoption_records")
    .select("*")
    .eq("animal_id", animalId)
    .order("created_at", { ascending: false });
  return (data as AdoptionRecord[]) || [];
}

export async function createAdoption(record: Partial<AdoptionRecord>): Promise<AdoptionRecord> {
  const id = `ADO-${genId()}`;
  const { data, error } = await supabase
    .from("adoption_records")
    .insert({ ...record, id })
    .select()
    .single();
  if (error) throw error;
  return data as AdoptionRecord;
}

// ── Officers ──────────────────────────────────────────────────────────────────
const OFFICER_ROLES = ["Officer", "Field Officer", "Dispatcher", "Shelter Manager", "Administrator", "Animal Control Officer"];

export async function fetchOfficers(): Promise<Officer[]> {
  const [officersRes, staffRes] = await Promise.all([
    supabase.from("officers").select("*").order("name"),
    supabase.from("staff_accounts").select("*").eq("active", true).order("last_name"),
  ]);

  const officerRows = (officersRes.data as Officer[]) || [];

  // Map active staff into Officer shape — exclude Volunteers
  const staffRows = (staffRes.data as Array<Record<string, unknown>>) || [];
  const staffOfficers: Officer[] = staffRows
    .filter((s) => (s.role as string || "").toLowerCase() !== "volunteer")
    .map((s) => ({
      id: `staff-${s.id as string}`,
      name: `${s.first_name || ""} ${s.last_name || ""}`.trim(),
      badge: (s.badge as string) || "",
      status: "Available",
      vehicle: "",
      zone: "",
      phone: (s.phone as string) || "",
      shift: "",
    }));

  // Merge: officers table takes precedence; skip staff entries that already have an officers row (by badge match)
  const officerBadges = new Set(officerRows.map((o) => o.badge).filter(Boolean));
  const staffOfficersFiltered = staffOfficers.filter(
    (s) => !s.badge || !officerBadges.has(s.badge)
  );

  return [...officerRows, ...staffOfficersFiltered];
}

// ── Animal Notes ──────────────────────────────────────────────────────────────
export async function addAnimalNote(animalId: string, text: string, type: string): Promise<void> {
  const now = new Date();
  await supabase.from("animal_notes").insert({
    animal_id: animalId,
    text,
    type,
    date: now.toISOString().split("T")[0],
    time: now.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }),
  });
}

export async function fetchAnimalNotes(animalId: string) {
  const { data } = await supabase
    .from("animal_notes")
    .select("*")
    .eq("animal_id", animalId)
    .order("created_at", { ascending: false });
  return data || [];
}

// ── People Notes ──────────────────────────────────────────────────────────────
export async function addPersonNote(personId: string, text: string, type: string): Promise<void> {
  const now = new Date();
  await supabase.from("people_notes").insert({
    person_id: personId,
    text,
    type,
    date: now.toISOString().split("T")[0],
    time: now.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }),
  });
}

export async function fetchPersonNotes(personId: string) {
  const { data } = await supabase
    .from("people_notes")
    .select("*")
    .eq("person_id", personId)
    .order("created_at", { ascending: false });
  return data || [];
}

// ── Animal Documents ──────────────────────────────────────────────────────────
export interface AnimalDocument {
  id: string;
  animal_id: string;
  animal_name?: string;
  file_name: string;
  file_url: string;
  file_type?: string;
  file_size?: number;
  category?: string;
  notes?: string;
  uploaded_by?: string;
  created_at?: string;
}

export async function fetchAnimalDocuments(animalId: string): Promise<AnimalDocument[]> {
  const { data } = await supabase.from("animal_documents").select("*").eq("animal_id", animalId).order("created_at", { ascending: false });
  return (data as AnimalDocument[]) || [];
}

export async function uploadAnimalDocument(
  animalId: string,
  animalName: string,
  file: File,
  category: string,
  notes: string,
  uploadedBy: string,
): Promise<AnimalDocument> {
  const path = `${animalId}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
  const { error: uploadError } = await supabase.storage.from("documents").upload(path, file, { upsert: false });
  if (uploadError) throw uploadError;
  const { data: urlData } = supabase.storage.from("documents").getPublicUrl(path);
  const { data, error } = await supabase.from("animal_documents").insert({
    animal_id: animalId,
    animal_name: animalName,
    file_name: file.name,
    file_url: urlData.publicUrl,
    file_type: file.type,
    file_size: file.size,
    category,
    notes,
    uploaded_by: uploadedBy,
  }).select().single();
  if (error) throw error;
  return data as AnimalDocument;
}

export async function deleteAnimalDocument(doc: AnimalDocument): Promise<void> {
  // Extract storage path from public URL
  const url = new URL(doc.file_url);
  const parts = url.pathname.split("/documents/");
  if (parts[1]) {
    await supabase.storage.from("documents").remove([parts[1]]);
  }
  await supabase.from("animal_documents").delete().eq("id", doc.id);
}

// ── Staff Options ──────────────────────────────────────────────────────────────
// Returns a sorted "First Last" list for vet/staff dropdowns.
// Source: staff_accounts only — active accounts that are not Volunteers.
export async function fetchStaffOptions(): Promise<string[]> {
  try {
    type NameRow = { first_name?: string | null; last_name?: string | null; role?: string | null };

    const { data } = await supabase
      .from("staff_accounts")
      .select("first_name, last_name, role")
      .eq("active", true)
      .order("last_name")
      .order("first_name");

    return ((data as NameRow[] | null) ?? [])
      .filter((p) => (p.role || "").toLowerCase() !== "volunteer")
      .map((p) => [p.first_name, p.last_name].filter(Boolean).join(" ").trim())
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b));
  } catch {
    return [];
  }
}

// ── Shelter Config ─────────────────────────────────────────────────────────────

// Extract a flat ordered list of kennel label strings from raw shelter config data.
// Safe to call with null / unknown input.
export function kennelLabelsFromConfig(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const labels: string[] = [];
  for (const room of raw) {
    if (room && typeof room === "object" && (room as Record<string, unknown>).type === "kennels") {
      const roomLabels = (room as Record<string, unknown>).labels;
      if (Array.isArray(roomLabels)) labels.push(...roomLabels as string[]);
    }
  }
  return labels;
}

export async function fetchShelterConfig() {
  const { data } = await supabase.from("shelter_config").select("config_data").eq("id", 1).single();
  const raw = data?.config_data;
  if (!raw) return null;
  // Stored as flat array (designer saves it this way)
  if (Array.isArray(raw)) return raw;
  // Seeded as { rooms: [...] } object
  if (raw.rooms && Array.isArray(raw.rooms)) return raw.rooms;
  return null;
}

export async function saveShelterConfig(config: object): Promise<void> {
  await supabase.from("shelter_config").upsert({ id: 1, config_data: config, updated_at: new Date().toISOString() });
}

export async function updateStaffTheme(userId: string, theme: "light" | "dark"): Promise<void> {
  await supabase.from("staff_accounts").update({ theme_preference: theme }).eq("id", userId);
}

// ── Shelter Settings (stored in shelter_config id=3) ─────────────────────────
export async function fetchShelterSettings(): Promise<import("./types").ShelterSettings> {
  const defaults: import("./types").ShelterSettings = {
    shelter_name: "Morgan County Animal Services",
    shelter_address: "2392 Athens Hwy, Madison, GA 30650",
    shelter_phone: "706.752.1195",
    gda_license_number: "",
  };
  const { data } = await supabase.from("shelter_config").select("config_data").eq("id", 3).single();
  if (!data?.config_data) return defaults;
  return { ...defaults, ...(data.config_data as object) };
}

export async function saveShelterSettings(settings: import("./types").ShelterSettings): Promise<void> {
  await supabase.from("shelter_config").upsert({ id: 3, config_data: settings as unknown as Record<string, unknown>, updated_at: new Date().toISOString() });
}

// ── Court Settings (stored in shelter_config id=2) ────────────────────────────
export async function fetchCourtSettings(): Promise<import("./types").CourtSettings> {
  const defaults = { magistrate_email: "", municipal_email: "", portal_url: "https://sheltertrace.com/court" };
  const { data } = await supabase.from("shelter_config").select("config_data").eq("id", 2).single();
  if (!data?.config_data) return defaults;
  return { ...defaults, ...(data.config_data as object) };
}

export async function saveCourtSettings(settings: import("./types").CourtSettings): Promise<void> {
  await supabase.from("shelter_config").upsert({ id: 2, config_data: settings as unknown as Record<string, unknown>, updated_at: new Date().toISOString() });
}

export async function markCitationNotified(id: string): Promise<void> {
  await supabase.from("citations").update({ court_notified: true, court_notified_at: new Date().toISOString() }).eq("id", id);
}

export async function markCitationEmailSent(id: string): Promise<void> {
  await supabase.from("citations").update({ email_sent: true, email_sent_at: new Date().toISOString() }).eq("id", id);
}

// ── Forms ─────────────────────────────────────────────────────────────────────
export async function fetchForms(formType?: import("./types").FormType): Promise<import("./types").ShelterForm[]> {
  let q = supabase.from("forms").select("*").order("created_at", { ascending: false });
  if (formType) q = q.eq("form_type", formType);
  const { data } = await q;
  return (data as import("./types").ShelterForm[]) || [];
}

export async function createForm(form: Omit<import("./types").ShelterForm, "id" | "created_at">): Promise<import("./types").ShelterForm> {
  const { data, error } = await supabase.from("forms").insert(form).select().single();
  if (error) throw error;
  return data as import("./types").ShelterForm;
}

export async function fetchAdoptionsByPerson(personId: string): Promise<import("./types").AdoptionRecord[]> {
  const { data } = await supabase.from("adoption_records").select("*")
    .eq("adopter_id", personId).order("adoption_date", { ascending: false });
  return (data as import("./types").AdoptionRecord[]) || [];
}

export async function fetchReceiptsByPerson(personId: string): Promise<import("./types").Receipt[]> {
  const { data } = await supabase.from("receipts").select("*")
    .eq("person_id", personId).order("date", { ascending: false });
  return (data as import("./types").Receipt[]) || [];
}

export async function fetchCallsByPerson(personId: string, personName?: string): Promise<import("./types").DispatchCall[]> {
  const { data } = await supabase.from("dispatch_calls").select("*").order("created_at", { ascending: false });
  const calls = (data as import("./types").DispatchCall[]) || [];
  const nameLower = personName?.toLowerCase();
  return calls.filter((c) => {
    const parties = c.involved_parties || [];
    return parties.some((p) =>
      (personId && p.id === personId) ||
      (nameLower && p.name?.toLowerCase() === nameLower)
    );
  });
}

export async function fetchCitationsByPerson(firstName?: string, lastName?: string): Promise<import("./types").Citation[]> {
  const { data } = await supabase.from("citations").select("*").order("date", { ascending: false });
  const all = (data as import("./types").Citation[]) || [];
  if (!firstName && !lastName) return [];
  const fullName = [firstName, lastName].filter(Boolean).join(" ").toLowerCase();
  return all.filter((c) => {
    const citFirst = c.violator_first || "";
    const citLast = c.violator_last || "";
    const citFull = c.violator_name || [citFirst, citLast].filter(Boolean).join(" ");
    return citFull.toLowerCase() === fullName;
  });
}

// ── Rescue Groups ─────────────────────────────────────────────────────────────
export async function fetchRescueGroups(): Promise<import("./types").RescueGroup[]> {
  const { data } = await supabase.from("rescue_groups").select("*").order("organization_name");
  return (data as import("./types").RescueGroup[]) || [];
}

export async function createRescueGroup(group: Omit<import("./types").RescueGroup, "id" | "created_at" | "updated_at">): Promise<import("./types").RescueGroup> {
  const { data, error } = await supabase.from("rescue_groups").insert(group).select().single();
  if (error) throw error;
  return data as import("./types").RescueGroup;
}

export async function updateRescueGroup(id: string, updates: Partial<import("./types").RescueGroup>): Promise<import("./types").RescueGroup> {
  const { data, error } = await supabase.from("rescue_groups").update({ ...updates, updated_at: new Date().toISOString() }).eq("id", id).select().single();
  if (error) throw error;
  return data as import("./types").RescueGroup;
}

export async function deleteRescueGroup(id: string): Promise<void> {
  const { error } = await supabase.from("rescue_groups").delete().eq("id", id);
  if (error) throw error;
}

// ── Transfers ─────────────────────────────────────────────────────────────────

// Generate sequential receipt number TR-YYYY-NNNN by querying the highest
// existing number for this year. Race conditions are negligible at shelter volume.
export async function genTransferReceiptNumber(): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `TR-${year}-`;
  const { data } = await supabase
    .from("transfers")
    .select("transfer_number")
    .like("transfer_number", `${prefix}%`)
    .order("transfer_number", { ascending: false })
    .limit(1);
  let seq = 1;
  if (data && (data as { transfer_number: string }[]).length > 0) {
    const last = parseInt(
      ((data as { transfer_number: string }[])[0].transfer_number || "").split("-").pop() || "0",
      10
    );
    if (!isNaN(last)) seq = last + 1;
  }
  return `${prefix}${String(seq).padStart(4, "0")}`;
}

// Returns all transfers that include the given animal_id in their animal_ids array.
export async function fetchTransfersByAnimal(animalId: string): Promise<import("./types").Transfer[]> {
  const { data } = await supabase
    .from("transfers")
    .select("*")
    .order("date", { ascending: false });
  const all = (data as import("./types").Transfer[]) || [];
  return all.filter((t) => (t.animal_ids || []).includes(animalId));
}

export async function fetchTransfers(): Promise<import("./types").Transfer[]> {
  const { data } = await supabase.from("transfers").select("*").order("date", { ascending: false });
  return (data as import("./types").Transfer[]) || [];
}

export async function fetchTransfersByGroup(groupId: string): Promise<import("./types").Transfer[]> {
  const { data } = await supabase.from("transfers").select("*").eq("rescue_group_id", groupId).order("date", { ascending: false });
  return (data as import("./types").Transfer[]) || [];
}

export async function createTransfer(
  transfer: Omit<import("./types").Transfer, "id" | "created_at">,
  animals: import("./types").Animal[]
): Promise<import("./types").Transfer> {
  console.log("[transfer insert data]", JSON.stringify(transfer, null, 2));
  const { data, error } = await supabase.from("transfers").insert(transfer).select().single();
  if (error) {
    console.log("[transfer error]", JSON.stringify(error, null, 2));
    throw error;
  }
  // Update each animal status to Transferred
  const transferDate = transfer.date;
  const groupName = transfer.rescue_group_name || "";
  await Promise.all(
    animals.map((a) =>
      supabase.from("animals").update({
        status: "Transferred",
        transferred_to: groupName,
        transfer_date: transferDate,
        updated_at: new Date().toISOString(),
      }).eq("id", a.id)
    )
  );
  return data as import("./types").Transfer;
}

// ── Volunteer Logs ────────────────────────────────────────────────────────────
export async function fetchVolunteerLogs(opts?: { personId?: string; dateFrom?: string; dateTo?: string; date?: string }): Promise<import("./types").VolunteerLog[]> {
  let q = supabase.from("volunteer_sessions").select("*").order("clock_in", { ascending: false });
  if (opts?.personId)  q = q.eq("person_id", opts.personId);
  if (opts?.date)      q = q.eq("date", opts.date);
  if (opts?.dateFrom)  q = q.gte("date", opts.dateFrom);
  if (opts?.dateTo)    q = q.lte("date", opts.dateTo);
  const { data } = await q;
  return (data as import("./types").VolunteerLog[]) || [];
}

export async function fetchTodayActiveVolunteers(): Promise<import("./types").VolunteerLog[]> {
  const todayStr = new Date().toISOString().split("T")[0];
  const { data } = await supabase
    .from("volunteer_sessions")
    .select("*")
    .eq("date", todayStr)
    .is("clock_out", null)
    .order("clock_in", { ascending: true });
  return (data as import("./types").VolunteerLog[]) || [];
}

export async function fetchActiveVolunteerLog(personId: string): Promise<import("./types").VolunteerLog | null> {
  const { data } = await supabase
    .from("volunteer_sessions")
    .select("*")
    .eq("person_id", personId)
    .is("clock_out", null)
    .order("clock_in", { ascending: false })
    .limit(1);
  return (data as import("./types").VolunteerLog[])?.[0] || null;
}

export async function clockInVolunteer(personId: string, personName: string, task: string): Promise<import("./types").VolunteerLog> {
  const now = new Date();
  const { data, error } = await supabase.from("volunteer_sessions").insert({
    person_id: personId,
    person_name: personName,
    task,
    clock_in: now.toISOString(),
    date: now.toISOString().split("T")[0],
  }).select().single();
  if (error) { console.error("[clockInVolunteer]", error.message); throw error; }
  return data as import("./types").VolunteerLog;
}

export async function clockOutVolunteer(logId: string): Promise<import("./types").VolunteerLog> {
  const { data: existing, error: fetchErr } = await supabase
    .from("volunteer_sessions").select("clock_in").eq("id", logId).single();
  if (fetchErr) throw fetchErr;
  const now = new Date();
  const clockInMs = new Date((existing as { clock_in: string }).clock_in).getTime();
  const hours = Math.round((now.getTime() - clockInMs) / 36000) / 100;
  const { data, error } = await supabase.from("volunteer_sessions").update({
    clock_out: now.toISOString(),
    hours,
  }).eq("id", logId).select().single();
  if (error) { console.error("[clockOutVolunteer]", error.message); throw error; }
  return data as import("./types").VolunteerLog;
}

export interface PersonLookupResult {
  person: import("./types").Person | null;
  debugLog: string[];
}

export async function lookupPersonForKiosk(rawInput: string): Promise<PersonLookupResult> {
  const log: string[] = [];
  const input = rawInput.trim();
  if (!input) return { person: null, debugLog: ["No input provided"] };

  const numericOnly = input.replace(/\D/g, "");
  const num = parseInt(numericOnly, 10);

  // Build every plausible PID format
  const candidates: string[] = [input, input.toUpperCase()];
  if (!isNaN(num) && numericOnly) {
    for (let pad = 3; pad <= 6; pad++) {
      candidates.push(`PID-${String(num).padStart(pad, "0")}`);
    }
    candidates.push(numericOnly);
    candidates.push(String(num).padStart(5, "0"));
    candidates.push(`PID-${numericOnly}`);
  }
  const unique = [...new Set(candidates)];

  log.push(`Typed: "${input}"`);
  log.push(`Candidates: ${unique.join(", ")}`);
  console.log("[lookupPersonForKiosk] input:", input, "candidates:", unique);

  // ── Step 1: pid IN (all candidates) ─────────────────────────────────────────
  const { data: byPid, error: e1 } = await supabase
    .from("people").select("*").in("pid", unique).limit(5);
  log.push(`pid IN query → ${byPid?.length ?? 0} rows${e1 ? ` (err: ${e1.message})` : ""}`);
  console.log("[lookupPersonForKiosk] pid IN:", byPid, e1);
  if (byPid && byPid.length > 0) {
    log.push(`MATCH via pid: ${(byPid[0] as import("./types").Person).first_name} ${(byPid[0] as import("./types").Person).last_name}`);
    return { person: (byPid as import("./types").Person[])[0], debugLog: log };
  }

  // ── Step 2: pid ilike %numericOnly% ─────────────────────────────────────────
  if (numericOnly) {
    const { data: byIlike, error: e2 } = await supabase
      .from("people").select("*").ilike("pid", `%${numericOnly}%`).limit(10);
    log.push(`pid ilike "%${numericOnly}%" → ${byIlike?.length ?? 0} rows${e2 ? ` (err: ${e2.message})` : ""}`);
    console.log("[lookupPersonForKiosk] pid ilike:", byIlike, e2);
    if (byIlike && byIlike.length > 0) {
      const exact = (byIlike as import("./types").Person[]).find(
        (p) => (p.pid || "").replace(/\D/g, "") === numericOnly
      );
      const hit = exact || (byIlike as import("./types").Person[])[0];
      log.push(`MATCH via pid ilike: ${hit.first_name} ${hit.last_name} (pid=${hit.pid})`);
      return { person: hit, debugLog: log };
    }
  }

  // ── Step 3: people.id exact match (UUID barcode scan) ───────────────────────
  {
    const { data: byId, error: e3 } = await supabase
      .from("people").select("*").eq("id", input).limit(1);
    log.push(`id exact "${input}" → ${byId?.length ?? 0} rows${e3 ? ` (err: ${e3.message})` : ""}`);
    console.log("[lookupPersonForKiosk] id exact:", byId, e3);
    if (byId && byId.length > 0) {
      log.push(`MATCH via id: ${(byId[0] as import("./types").Person).first_name}`);
      return { person: (byId as import("./types").Person[])[0], debugLog: log };
    }
  }

  // ── Step 4: barcode_id column ────────────────────────────────────────────────
  try {
    const { data: byBarcode, error: e4 } = await supabase
      .from("people").select("*").eq("barcode_id", input).limit(1);
    log.push(`barcode_id "${input}" → ${byBarcode?.length ?? 0} rows${e4 ? ` (err: ${e4.message})` : ""}`);
    console.log("[lookupPersonForKiosk] barcode_id:", byBarcode, e4);
    if (byBarcode && byBarcode.length > 0) {
      log.push(`MATCH via barcode_id`);
      return { person: (byBarcode as import("./types").Person[])[0], debugLog: log };
    }
  } catch (e) {
    log.push(`barcode_id query error: ${e}`);
  }

  log.push("NO MATCH FOUND");
  console.log("[lookupPersonForKiosk] no match. Full log:", log);
  return { person: null, debugLog: log };
}

// ── Volunteer session management (staff edits) ────────────────────────────────
export async function updateVolunteerSession(
  id: string,
  updates: { clock_in?: string; clock_out?: string; task?: string; notes?: string }
): Promise<import("./types").VolunteerLog> {
  const patch: Record<string, unknown> = { ...updates, manually_edited: true };
  if (updates.clock_in && updates.clock_out) {
    const ms = new Date(updates.clock_out).getTime() - new Date(updates.clock_in).getTime();
    patch.hours = Math.round(ms / 36000) / 100;
  }
  const { data, error } = await supabase
    .from("volunteer_sessions").update(patch).eq("id", id).select().single();
  if (error) throw error;
  return data as import("./types").VolunteerLog;
}

export async function deleteVolunteerSession(id: string): Promise<void> {
  const { error } = await supabase.from("volunteer_sessions").delete().eq("id", id);
  if (error) throw error;
}

export async function addManualSession(payload: {
  person_id: string; person_name: string; task: string;
  clock_in: string; clock_out: string; date: string; notes?: string;
}): Promise<import("./types").VolunteerLog> {
  const ms = new Date(payload.clock_out).getTime() - new Date(payload.clock_in).getTime();
  const hours = Math.round(ms / 36000) / 100;
  const { data, error } = await supabase
    .from("volunteer_sessions")
    .insert({ ...payload, hours, is_manual: true })
    .select().single();
  if (error) throw error;
  return data as import("./types").VolunteerLog;
}

// Keep the old function as a thin wrapper for non-kiosk callers
export async function fetchPersonByPid(rawInput: string): Promise<import("./types").Person | null> {
  const { person } = await lookupPersonForKiosk(rawInput);
  return person;
}

// ── Animal search ─────────────────────────────────────────────────────────────
export async function searchAnimals(q: string): Promise<Animal[]> {
  if (!q.trim()) return [];
  const lo = q.toLowerCase();
  const { data } = await supabase
    .from("animals")
    .select("id,name,species,breed,color,sex,status,microchip,kennel,intake_date")
    .order("created_at", { ascending: false })
    .limit(200);
  const rows = (data as Animal[]) || [];
  return rows.filter((a) =>
    a.id.toLowerCase().includes(lo) ||
    (a.name || "").toLowerCase().includes(lo) ||
    (a.microchip || "").toLowerCase().includes(lo)
  ).slice(0, 10);
}

// ── Redemptions ───────────────────────────────────────────────────────────────
export async function createRedemption(data: Omit<import("./types").Redemption, "id" | "created_at">): Promise<import("./types").Redemption> {
  const { data: row, error } = await supabase.from("redemptions").insert(data).select().single();
  if (error) {
    console.error("[createRedemption] Supabase error:", error.message, error.hint);
    throw error;
  }
  return row as import("./types").Redemption;
}

export async function fetchRedemptions(animalId?: string): Promise<import("./types").Redemption[]> {
  let q = supabase.from("redemptions").select("*").order("redemption_date", { ascending: false });
  if (animalId) q = q.eq("animal_id", animalId);
  const { data } = await q;
  return (data as import("./types").Redemption[]) || [];
}

export async function linkAnimalToPerson(animalId: string, personId: string): Promise<void> {
  await supabase.from("animal_people").upsert({ animal_id: animalId, person_id: personId });
}

// ── Volunteer helpers ─────────────────────────────────────────────────────────
export async function genNextPid(): Promise<string> {
  const { data } = await supabase
    .from("people")
    .select("pid")
    .like("pid", "PID-%")
    .order("pid", { ascending: false })
    .limit(20);
  const rows = (data as { pid: string }[]) || [];
  let maxNum = 0;
  for (const row of rows) {
    const n = parseInt((row.pid || "").replace(/^PID-/, ""), 10);
    if (!isNaN(n) && n > maxNum) maxNum = n;
  }
  return `PID-${String(maxNum + 1).padStart(5, "0")}`;
}

// ── Volunteer Announcements ───────────────────────────────────────────────────
export async function fetchVolunteerAnnouncements(): Promise<string> {
  const { data } = await supabase.from("shelter_config").select("config_data").eq("id", 5).single();
  return (data as { config_data: { text?: string } } | null)?.config_data?.text || "";
}

export async function saveVolunteerAnnouncements(text: string): Promise<void> {
  await supabase.from("shelter_config").upsert({ id: 5, config_data: { text }, updated_at: new Date().toISOString() });
}

// ── Volunteer Applications ────────────────────────────────────────────────────
export async function fetchVolunteerApplications(): Promise<import("./types").VolunteerApplication[]> {
  console.log("[applications] fetching volunteer_applications...");
  const { data, error } = await supabase
    .from("volunteer_applications")
    .select("*")
    .order("submitted_at", { ascending: false });

  console.log("[applications] result:", JSON.stringify(data), "error:", JSON.stringify(error));
  if (error) {
    console.error("[applications] Supabase error:", error.message, error.details, error.hint);
    return [];
  }
  return (data as import("./types").VolunteerApplication[]) || [];
}

export async function createVolunteerApplication(
  app: Omit<import("./types").VolunteerApplication, "id" | "submitted_at">
): Promise<import("./types").VolunteerApplication> {
  console.log("[volunteer-apply] insert data:", JSON.stringify(app, null, 2));
  const { data, error } = await supabase
    .from("volunteer_applications")
    .insert(app)
    .select()
    .single();
  if (error) {
    console.error("[volunteer-apply] Supabase error:", error.message, error.details, error.hint);
    throw error;
  }
  return data as import("./types").VolunteerApplication;
}

export async function updateVolunteerApplication(
  id: string,
  updates: Partial<import("./types").VolunteerApplication>
): Promise<import("./types").VolunteerApplication> {
  const { data, error } = await supabase
    .from("volunteer_applications")
    .update(updates)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data as import("./types").VolunteerApplication;
}

// ── Adoption Applications ─────────────────────────────────────────────────────
export async function fetchAdoptionApplications(): Promise<import("./types").AdoptionApplication[]> {
  const { data } = await supabase
    .from("adoption_applications")
    .select("*")
    .order("created_at", { ascending: false });
  return (data as import("./types").AdoptionApplication[]) || [];
}

export async function createAdoptionApplication(
  app: Omit<import("./types").AdoptionApplication, "id" | "created_at">
): Promise<import("./types").AdoptionApplication> {
  const { data, error } = await supabase
    .from("adoption_applications")
    .insert(app)
    .select()
    .single();
  if (error) throw error;
  return data as import("./types").AdoptionApplication;
}

export async function updateAdoptionApplication(
  id: string,
  updates: Partial<import("./types").AdoptionApplication>
): Promise<import("./types").AdoptionApplication> {
  const { data, error } = await supabase
    .from("adoption_applications")
    .update(updates)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data as import("./types").AdoptionApplication;
}

// ── Departure Receipts ────────────────────────────────────────────────────────
export async function createDepartureReceipt(
  receipt: Omit<import("./types").DepartureReceipt, "id" | "created_at" | "receipt_number">
): Promise<import("./types").DepartureReceipt> {
  // Generate sequential receipt number: REC-YYYY-NNNN
  const year = new Date().getFullYear();
  const { count } = await supabase
    .from("departure_receipts")
    .select("*", { count: "exact", head: true })
    .gte("created_at", `${year}-01-01`);
  const seq = String((count ?? 0) + 1).padStart(4, "0");
  const receipt_number = `REC-${year}-${seq}`;
  const id = genId();
  const insertData = { ...receipt, id, receipt_number };
  console.log("[departure receipt insert data]", JSON.stringify(insertData, null, 2));
  const { data, error } = await supabase
    .from("departure_receipts")
    .insert(insertData)
    .select()
    .single();
  console.log("[departure receipt error]", JSON.stringify(error, null, 2));
  if (error) throw error;
  return data as import("./types").DepartureReceipt;
}

export async function fetchDepartureReceiptsByAnimal(
  animalId: string
): Promise<import("./types").DepartureReceipt[]> {
  const { data } = await supabase
    .from("departure_receipts")
    .select("*")
    .eq("animal_id", animalId)
    .order("created_at", { ascending: false });
  return (data as import("./types").DepartureReceipt[]) || [];
}

export async function fetchDepartureReceipts(filters?: {
  dateFrom?: string;
  dateTo?: string;
  departureType?: string;
  officerName?: string;
}): Promise<import("./types").DepartureReceipt[]> {
  let q = supabase.from("departure_receipts").select("*").order("created_at", { ascending: false });
  if (filters?.dateFrom) q = q.gte("departure_date", filters.dateFrom);
  if (filters?.dateTo)   q = q.lte("departure_date", filters.dateTo + "T23:59:59");
  if (filters?.departureType && filters.departureType !== "All") q = q.eq("departure_type", filters.departureType);
  if (filters?.officerName && filters.officerName !== "All") q = q.eq("officer_name", filters.officerName);
  const { data } = await q;
  return (data as import("./types").DepartureReceipt[]) || [];
}

export async function fetchFormsByLinked(opts: { callId?: string; animalId?: string; personId?: string }): Promise<import("./types").ShelterForm[]> {
  if (opts.callId) {
    const { data } = await supabase.from("forms").select("*").eq("linked_call_id", opts.callId).order("created_at", { ascending: false });
    return (data as import("./types").ShelterForm[]) || [];
  }
  if (opts.animalId) {
    const { data } = await supabase.from("forms").select("*").eq("linked_animal_id", opts.animalId).order("created_at", { ascending: false });
    return (data as import("./types").ShelterForm[]) || [];
  }
  if (opts.personId) {
    const { data } = await supabase.from("forms").select("*").eq("linked_person_id", opts.personId).order("created_at", { ascending: false });
    return (data as import("./types").ShelterForm[]) || [];
  }
  return [];
}

// ── Microchip Registry ────────────────────────────────────────────────────────

/**
 * Search the internal registry + the animals table for a chip number.
 * Returns the registry entry (with owner info) and/or the matching animal record.
 */
export async function lookupMicrochip(chipNumber: string): Promise<{
  registration: MicrochipRegistration | null;
  animal: Animal | null;
}> {
  const q = chipNumber.trim();
  if (!q) return { registration: null, animal: null };

  const [regRes, animalRes] = await Promise.all([
    supabase.from("microchip_registry").select("*").ilike("chip_number", q).limit(1),
    supabase.from("animals").select("*").ilike("microchip", q).limit(1),
  ]);

  return {
    registration: (regRes.data?.[0] as MicrochipRegistration) ?? null,
    animal:       (animalRes.data?.[0] as Animal) ?? null,
  };
}

/** Create or update a registry entry. Upserts on chip_number. */
export async function upsertMicrochipRegistration(
  reg: Omit<MicrochipRegistration, "id" | "created_at">
): Promise<MicrochipRegistration> {
  const { data, error } = await supabase
    .from("microchip_registry")
    .upsert({ ...reg, updated_at: new Date().toISOString() }, { onConflict: "chip_number" })
    .select()
    .single();
  if (error) throw error;
  return data as MicrochipRegistration;
}

// ── Foster Care ────────────────────────────────────────────────────────────────

export async function fetchActiveFosterPlacements(): Promise<FosterPlacement[]> {
  const { data } = await supabase
    .from("foster_placements")
    .select("*")
    .eq("status", "Active")
    .order("start_date", { ascending: false });
  return (data as FosterPlacement[]) ?? [];
}

export async function fetchFosterPlacementsByAnimal(animalId: string): Promise<FosterPlacement[]> {
  const { data } = await supabase
    .from("foster_placements")
    .select("*")
    .eq("animal_id", animalId)
    .order("start_date", { ascending: false });
  return (data as FosterPlacement[]) ?? [];
}

export async function fetchFosterPlacementsByParent(parentId: string): Promise<FosterPlacement[]> {
  const { data } = await supabase
    .from("foster_placements")
    .select("*")
    .eq("foster_parent_id", parentId)
    .order("start_date", { ascending: false });
  return (data as FosterPlacement[]) ?? [];
}

export async function createFosterPlacement(
  p: Omit<FosterPlacement, "id" | "created_at" | "updated_at">
): Promise<FosterPlacement> {
  const { data, error } = await supabase
    .from("foster_placements")
    .insert(p)
    .select()
    .single();
  if (error) throw error;
  return data as FosterPlacement;
}

export async function updateFosterPlacement(
  id: string,
  updates: Partial<FosterPlacement>
): Promise<FosterPlacement> {
  const { data, error } = await supabase
    .from("foster_placements")
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data as FosterPlacement;
}

export async function fetchFosterUpdatesByPlacement(placementId: string): Promise<FosterUpdate[]> {
  const { data } = await supabase
    .from("foster_updates")
    .select("*")
    .eq("placement_id", placementId)
    .order("created_at", { ascending: false });
  return (data as FosterUpdate[]) ?? [];
}

export async function fetchFosterUpdatesByAnimal(animalId: string): Promise<FosterUpdate[]> {
  const { data } = await supabase
    .from("foster_updates")
    .select("*")
    .eq("animal_id", animalId)
    .order("created_at", { ascending: false });
  return (data as FosterUpdate[]) ?? [];
}

export async function createFosterUpdate(
  u: Omit<FosterUpdate, "id" | "created_at">
): Promise<FosterUpdate> {
  const { data, error } = await supabase.from("foster_updates").insert(u).select().single();
  if (error) throw error;
  return data as FosterUpdate;
}

export async function fetchFosterCheckinsByPlacement(placementId: string): Promise<FosterCheckin[]> {
  const { data } = await supabase
    .from("foster_checkins")
    .select("*")
    .eq("placement_id", placementId)
    .order("checked_at", { ascending: false });
  return (data as FosterCheckin[]) ?? [];
}

export async function createFosterCheckin(
  c: Omit<FosterCheckin, "id">
): Promise<FosterCheckin> {
  const { data, error } = await supabase.from("foster_checkins").insert(c).select().single();
  if (error) throw error;
  return data as FosterCheckin;
}

export async function fetchFosterApplications(): Promise<FosterApplication[]> {
  const { data, error } = await supabase
    .from("foster_applications")
    .select("*")
    .order("created_at", { ascending: false });
  console.log("[foster apps] result:", data, error);
  return (data as FosterApplication[]) ?? [];
}

export async function createFosterApplication(
  app: Omit<FosterApplication, "id" | "created_at">
): Promise<FosterApplication> {
  console.log("[foster-apply] insert data:", JSON.stringify(app, null, 2));
  const { data, error } = await supabase.from("foster_applications").insert(app).select().single();
  if (error) {
    console.error("[foster-apply] Supabase error:", error.message, error.details);
    throw error;
  }
  return data as FosterApplication;
}

export async function updateFosterApplication(
  id: string,
  updates: Partial<FosterApplication>
): Promise<FosterApplication> {
  const { data, error } = await supabase
    .from("foster_applications")
    .update(updates)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data as FosterApplication;
}

export async function fetchFosterParents(): Promise<Person[]> {
  const { data } = await supabase
    .from("people")
    .select("*")
    .eq("role", "Foster Parent")
    .order("last_name");
  return (data as Person[]) ?? [];
}

export async function fetchFosterSupplyRequests(
  opts: { status?: string } = {}
): Promise<FosterSupplyRequest[]> {
  let q = supabase.from("foster_supply_requests").select("*").order("created_at", { ascending: false });
  if (opts.status) q = q.eq("status", opts.status);
  const { data } = await q;
  return (data as FosterSupplyRequest[]) ?? [];
}

export async function createFosterSupplyRequest(
  req: Omit<FosterSupplyRequest, "id" | "created_at">
): Promise<FosterSupplyRequest> {
  const { data, error } = await supabase.from("foster_supply_requests").insert(req).select().single();
  if (error) throw error;
  return data as FosterSupplyRequest;
}

export async function updateFosterSupplyRequest(
  id: string,
  updates: Partial<FosterSupplyRequest>
): Promise<FosterSupplyRequest> {
  const { data, error } = await supabase
    .from("foster_supply_requests")
    .update(updates)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data as FosterSupplyRequest;
}

/** Fetch registry entries with optional filters. */
export async function fetchMicrochipRegistry(
  opts: { status?: string; species?: string; from?: string; to?: string } = {}
): Promise<MicrochipRegistration[]> {
  let q = supabase.from("microchip_registry").select("*").order("created_at", { ascending: false });
  if (opts.status)  q = q.eq("status", opts.status);
  if (opts.species) q = q.eq("species", opts.species);
  if (opts.from)    q = q.gte("registration_date", opts.from);
  if (opts.to)      q = q.lte("registration_date", opts.to);
  const { data } = await q;
  return (data as MicrochipRegistration[]) ?? [];
}

/** Log a chip search event (used for analytics / search history). */
export async function logMicrochipSearch(entry: Omit<MicrochipSearch, "id" | "searched_at">): Promise<void> {
  await supabase.from("microchip_searches").insert(entry);
}

/** Fetch recent chip search history. */
export async function fetchMicrochipSearchHistory(limit = 100): Promise<MicrochipSearch[]> {
  const { data } = await supabase
    .from("microchip_searches")
    .select("*")
    .order("searched_at", { ascending: false })
    .limit(limit);
  return (data as MicrochipSearch[]) ?? [];
}

// ── Lost & Found (staff-side — uses main supabase client) ──────────────────

export async function fetchLostFoundReports(
  opts: { type?: string; status?: string; limit?: number } = {}
): Promise<LostFoundReport[]> {
  let q = supabase
    .from("lost_found_reports")
    .select("*")
    .order("created_at", { ascending: false });
  if (opts.type)   q = q.eq("type", opts.type);
  if (opts.status) q = q.eq("status", opts.status);
  if (opts.limit)  q = q.limit(opts.limit);
  const { data } = await q;
  return (data as LostFoundReport[]) ?? [];
}

export async function updateLostFoundReport(
  id: string,
  updates: Partial<LostFoundReport>
): Promise<LostFoundReport> {
  const { data, error } = await supabase
    .from("lost_found_reports")
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data as LostFoundReport;
}

export async function fetchLostFoundMatches(
  reportId: string
): Promise<LostFoundMatch[]> {
  const { data } = await supabase
    .from("lost_found_matches")
    .select("*")
    .or(`lost_report_id.eq.${reportId},found_report_id.eq.${reportId}`)
    .order("match_score", { ascending: false });
  return (data as LostFoundMatch[]) ?? [];
}

export async function updateLostFoundMatch(
  id: string,
  updates: Partial<LostFoundMatch>
): Promise<void> {
  await supabase.from("lost_found_matches").update(updates).eq("id", id);
}

// ── Pet License Registry ──────────────────────────────────────────────────────

export async function fetchPetLicenses(
  opts: { search?: string; status?: string; species?: string; year?: number; limit?: number } = {}
): Promise<PetLicense[]> {
  let q = supabase.from("pet_licenses").select("*").order("expiration_date", { ascending: true });
  if (opts.status && opts.status !== "All") q = q.eq("status", opts.status);
  if (opts.species) q = q.eq("species", opts.species);
  if (opts.year) {
    q = q.gte("issue_date", `${opts.year}-01-01`).lte("issue_date", `${opts.year}-12-31`);
  }
  if (opts.limit) q = q.limit(opts.limit);
  const { data } = await q;
  const results = (data as PetLicense[]) ?? [];
  if (!opts.search?.trim()) return results;
  const s = opts.search.toLowerCase();
  return results.filter(
    (l) =>
      (l.license_number ?? "").toLowerCase().includes(s) ||
      (l.owner_name ?? "").toLowerCase().includes(s) ||
      (l.pet_name ?? "").toLowerCase().includes(s) ||
      (l.owner_address ?? "").toLowerCase().includes(s) ||
      (l.microchip_number ?? "").toLowerCase().includes(s)
  );
}

export async function fetchLicensesByAnimal(animalId: string): Promise<PetLicense[]> {
  const { data } = await supabase.from("pet_licenses").select("*").eq("animal_id", animalId).order("expiration_date", { ascending: false });
  return (data as PetLicense[]) ?? [];
}

export async function fetchLicensesByPerson(personId: string): Promise<PetLicense[]> {
  const { data } = await supabase.from("pet_licenses").select("*").eq("person_id", personId).order("expiration_date", { ascending: false });
  return (data as PetLicense[]) ?? [];
}

export async function createPetLicense(
  license: Omit<PetLicense, "id" | "created_at" | "updated_at">
): Promise<PetLicense> {
  const { data, error } = await supabase.from("pet_licenses").insert(license).select().single();
  if (error) throw error;
  return data as PetLicense;
}

export async function updatePetLicense(
  id: string,
  updates: Partial<PetLicense>
): Promise<PetLicense> {
  const { data, error } = await supabase
    .from("pet_licenses")
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data as PetLicense;
}

export async function deletePetLicense(id: string): Promise<void> {
  await supabase.from("pet_licenses").delete().eq("id", id);
}

/** Bulk-insert licenses; skips any whose license_number already exists. */
export async function bulkCreatePetLicenses(
  licenses: Omit<PetLicense, "id" | "created_at" | "updated_at">[]
): Promise<{ inserted: number; skipped: number }> {
  let inserted = 0;
  let skipped  = 0;
  for (const lic of licenses) {
    const { error } = await supabase.from("pet_licenses").insert(lic);
    if (error?.code === "23505") skipped++;   // unique violation
    else if (!error) inserted++;
    else skipped++;
  }
  return { inserted, skipped };
}

// ── Citizen Reports ───────────────────────────────────────────────────────────

export async function fetchCitizenReports(filters?: {
  status?: string;
  reportType?: string;
  dateFrom?: string;
  dateTo?: string;
}): Promise<CitizenReport[]> {
  let q = supabase.from("citizen_reports").select("*").order("created_at", { ascending: false });
  if (filters?.status && filters.status !== "All") q = q.eq("status", filters.status);
  if (filters?.reportType && filters.reportType !== "All") q = q.eq("report_type", filters.reportType);
  if (filters?.dateFrom) q = q.gte("created_at", filters.dateFrom);
  if (filters?.dateTo) q = q.lte("created_at", filters.dateTo + "T23:59:59");
  const { data } = await q;
  return (data || []) as CitizenReport[];
}

export async function fetchCitizenReport(id: string): Promise<CitizenReport | null> {
  const { data } = await supabase.from("citizen_reports").select("*").eq("id", id).single();
  return data as CitizenReport | null;
}

export async function updateCitizenReport(id: string, updates: Partial<CitizenReport>): Promise<CitizenReport> {
  const { data, error } = await supabase
    .from("citizen_reports")
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data as CitizenReport;
}

export async function countNewCitizenReports(): Promise<number> {
  const { count } = await supabase
    .from("citizen_reports")
    .select("*", { count: "exact", head: true })
    .eq("status", "New");
  return count ?? 0;
}

// ── Drug Log ──────────────────────────────────────────────────────────────────

export async function fetchDrugInventory(): Promise<DrugInventory[]> {
  const { data } = await supabase.from("drug_inventory").select("*").order("created_at", { ascending: false });
  return (data || []) as DrugInventory[];
}

export async function createDrugInventory(entry: Partial<DrugInventory>): Promise<DrugInventory> {
  const { data, error } = await supabase.from("drug_inventory").insert(entry).select().single();
  if (error) throw error;
  return data as DrugInventory;
}

export async function updateDrugInventory(id: string, updates: Partial<DrugInventory>): Promise<DrugInventory> {
  const { data, error } = await supabase.from("drug_inventory").update(updates).eq("id", id).select().single();
  if (error) throw error;
  return data as DrugInventory;
}

export async function fetchEuthanasiaLog(filters?: { dateFrom?: string; dateTo?: string; species?: string; staffId?: string }): Promise<EuthanasiaLog[]> {
  let q = supabase.from("euthanasia_log").select("*").order("created_at", { ascending: false });
  if (filters?.dateFrom) q = q.gte("log_date", filters.dateFrom);
  if (filters?.dateTo)   q = q.lte("log_date", filters.dateTo);
  if (filters?.species && filters.species !== "All") q = q.eq("species", filters.species);
  if (filters?.staffId)  q = q.eq("administered_by_id", filters.staffId);
  const { data } = await q;
  return (data || []) as EuthanasiaLog[];
}

export async function createEuthanasiaLogEntry(entry: Partial<EuthanasiaLog>): Promise<EuthanasiaLog> {
  const { data, error } = await supabase.from("euthanasia_log").insert(entry).select().single();
  if (error) throw error;
  return data as EuthanasiaLog;
}

export async function fetchDrugReconciliations(): Promise<DrugReconciliation[]> {
  const { data } = await supabase.from("drug_reconciliation").select("*").order("created_at", { ascending: false });
  return (data || []) as DrugReconciliation[];
}

export async function createDrugReconciliation(entry: Partial<DrugReconciliation>): Promise<DrugReconciliation> {
  const { data, error } = await supabase.from("drug_reconciliation").insert(entry).select().single();
  if (error) throw error;
  return data as DrugReconciliation;
}
