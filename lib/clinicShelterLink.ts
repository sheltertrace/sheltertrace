"use client";
import { supabase } from "./supabase";
import type { Animal, MedicalRecord } from "./types";
import type { PlatformCustomer } from "./superAdminTypes";

export interface ClinicShelterLink {
  id: string;
  clinic_customer_id: string;
  shelter_customer_id: string;
  access_level: string;
  active: boolean;
  created_at?: string;
  shelter_name?: string;
}

// ── Link CRUD ────────────────────────────────────────────────────────────────

export async function fetchLinksForClinic(clinicCustomerId: string): Promise<ClinicShelterLink[]> {
  const { data } = await supabase
    .from("clinic_shelter_links")
    .select("*")
    .eq("clinic_customer_id", clinicCustomerId)
    .eq("active", true);
  if (!data?.length) return [];

  const shelterIds = data.map((d: Record<string, unknown>) => d.shelter_customer_id as string);
  const { data: customers } = await supabase
    .from("platform_customers")
    .select("id, account_name")
    .in("id", shelterIds);

  const nameMap = new Map((customers || []).map((c: Record<string, unknown>) => [c.id as string, c.account_name as string]));

  return (data as ClinicShelterLink[]).map((link): ClinicShelterLink => ({
    ...link,
    shelter_name: (nameMap.get(link.shelter_customer_id) ?? "Unknown Shelter") as string,
  }));
}

export async function fetchLinksForShelter(shelterCustomerId: string): Promise<ClinicShelterLink[]> {
  const { data } = await supabase
    .from("clinic_shelter_links")
    .select("*")
    .eq("shelter_customer_id", shelterCustomerId)
    .eq("active", true);
  return (data || []) as ClinicShelterLink[];
}

export async function createShelterLink(link: { clinic_customer_id: string; shelter_customer_id: string; access_level: string }): Promise<ClinicShelterLink> {
  const { data, error } = await supabase.from("clinic_shelter_links").insert({ ...link, active: true }).select().single();
  if (error) throw error;
  return data as ClinicShelterLink;
}

export async function updateShelterLink(id: string, updates: Partial<ClinicShelterLink>): Promise<void> {
  await supabase.from("clinic_shelter_links").update(updates).eq("id", id);
}

export async function removeShelterLink(id: string): Promise<void> {
  await supabase.from("clinic_shelter_links").update({ active: false }).eq("id", id);
}

// ── Shelter Animal Access (read from main animals table) ─────────────────────

export async function fetchShelterAnimals(search?: string): Promise<Animal[]> {
  let q = supabase.from("animals").select("*").order("name");
  if (search?.trim()) {
    const s = `%${search.trim()}%`;
    q = q.or(`name.ilike.${s},breed.ilike.${s},id.ilike.${s},microchip.ilike.${s}`);
  }
  const { data } = await q.limit(200);
  return (data || []) as Animal[];
}

export async function fetchShelterAnimal(id: string): Promise<Animal | null> {
  const { data } = await supabase.from("animals").select("*").eq("id", id).limit(1);
  return (data?.[0] as Animal) || null;
}

// ── Medical Records (read/write to main medical_records table) ───────────────

export async function fetchShelterAnimalMedical(animalId: string): Promise<MedicalRecord[]> {
  const { data } = await supabase.from("medical_records").select("*").eq("animal_id", animalId).order("date", { ascending: false });
  return (data || []) as MedicalRecord[];
}

export async function addShelterAnimalMedical(record: Partial<MedicalRecord>): Promise<MedicalRecord> {
  const { data, error } = await supabase.from("medical_records").insert(record).select().single();
  if (error) throw error;
  return data as MedicalRecord;
}

// ── Update shelter animal (limited fields for clinic access) ─────────────────

export async function updateShelterAnimalClinic(animalId: string, updates: { fixed?: boolean }): Promise<void> {
  await supabase.from("animals").update(updates).eq("id", animalId);
}

// ── Add note to shelter animal ───────────────────────────────────────────────

export async function addShelterAnimalNote(animalId: string, text: string, type: string): Promise<void> {
  const now = new Date();
  await supabase.from("animal_notes").insert({
    animal_id: animalId, text, type,
    date: now.toISOString().split("T")[0],
    time: now.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }),
  });
}
