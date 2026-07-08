"use client";
import { supabase } from "./supabase";

export interface Medication {
  id: string;
  name: string;
  description?: string;
  category?: string;
  unit?: string;
  concentration?: string;
  default_cost?: number;
  species?: string[];
  dea_schedule?: string;
  notes?: string;
  active: boolean;
  created_by?: string;
  created_at?: string;
  updated_at?: string;
}

export const MED_CATEGORIES = [
  "Antibiotic", "Antiparasitic", "Antifungal", "Anti-inflammatory", "Antihistamine",
  "Sedative", "Pain", "Pain/Sedative", "Pain/DEA Controlled", "Sedative/DEA Controlled",
  "DEA Controlled", "Vaccine", "Ophthalmic", "Otic", "Dermatological",
  "Cardiac", "Gastrointestinal", "Hormonal", "Behavioral", "Fluid", "Other",
] as const;

export const MED_UNITS = ["mg", "ml", "tablets", "capsules", "drops", "units", "other"] as const;

export const DEA_SCHEDULES = ["None", "II", "III", "IV", "V"] as const;

let _cache: Medication[] | null = null;
let _cacheTs = 0;

export async function fetchMedications(opts?: { active?: boolean; category?: string }): Promise<Medication[]> {
  const now = Date.now();
  if (_cache && now - _cacheTs < 5 * 60_000) {
    let list = _cache;
    if (opts?.active !== undefined) list = list.filter((m) => m.active === opts.active);
    if (opts?.category) list = list.filter((m) => m.category === opts.category);
    return list;
  }
  const { data } = await supabase.from("medications").select("*").order("name");
  _cache = (data || []) as Medication[];
  _cacheTs = now;
  let list = _cache;
  if (opts?.active !== undefined) list = list.filter((m) => m.active === opts.active);
  if (opts?.category) list = list.filter((m) => m.category === opts.category);
  return list;
}

export function invalidateMedCache() { _cache = null; _cacheTs = 0; }

export async function searchMedications(query: string, species?: string): Promise<Medication[]> {
  const all = await fetchMedications({ active: true });
  if (!query.trim()) return all.slice(0, 20);
  const q = query.toLowerCase();
  const matches = all.filter((m) => m.name.toLowerCase().includes(q) || (m.category || "").toLowerCase().includes(q));
  if (!species || species === "All") return matches.slice(0, 15);
  // Prioritize species-matched results
  const exact = matches.filter((m) => m.species?.some((s) => s === species || s === "All"));
  const rest = matches.filter((m) => !exact.includes(m));
  return [...exact, ...rest].slice(0, 15);
}

export async function createMedication(med: Omit<Medication, "id" | "created_at" | "updated_at">): Promise<Medication> {
  const { data, error } = await supabase.from("medications").insert(med).select().single();
  if (error) throw error;
  invalidateMedCache();
  return data as Medication;
}

export async function updateMedication(id: string, updates: Partial<Medication>): Promise<void> {
  await supabase.from("medications").update({ ...updates, updated_at: new Date().toISOString() }).eq("id", id);
  invalidateMedCache();
}
