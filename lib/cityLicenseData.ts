"use client";
import { supabase } from "./supabase";
import type { PetLicenseApplication, CityPetLicense } from "./cityLicenseTypes";

// ── Applications ──────────────────────────────────────────────────────────────

export async function fetchApplications(opts?: { status?: string; year?: number; limit?: number }): Promise<PetLicenseApplication[]> {
  let q = supabase.from("pet_license_applications").select("*").order("submitted_at", { ascending: false });
  if (opts?.status && opts.status !== "all") q = q.eq("status", opts.status);
  if (opts?.year) q = q.eq("year", opts.year);
  if (opts?.limit) q = q.limit(opts.limit);
  const { data } = await q;
  return (data || []) as PetLicenseApplication[];
}

export async function fetchApplication(id: string): Promise<PetLicenseApplication | null> {
  const { data } = await supabase.from("pet_license_applications").select("*").eq("id", id).limit(1);
  return (data?.[0] as PetLicenseApplication) || null;
}

async function genApplicationNumber(): Promise<string> {
  const year = new Date().getFullYear();
  const { count } = await supabase.from("pet_license_applications").select("*", { count: "exact", head: true }).eq("year", year);
  return `PLA-${year}-${String((count || 0) + 1).padStart(4, "0")}`;
}

export async function createApplication(app: Omit<PetLicenseApplication, "id" | "application_number" | "created_at" | "updated_at">): Promise<PetLicenseApplication> {
  const application_number = await genApplicationNumber();
  const { data, error } = await supabase.from("pet_license_applications").insert({ ...app, application_number }).select().single();
  if (error) throw error;
  return data as PetLicenseApplication;
}

export async function updateApplication(id: string, updates: Partial<PetLicenseApplication>): Promise<PetLicenseApplication> {
  const { data, error } = await supabase.from("pet_license_applications").update({ ...updates, updated_at: new Date().toISOString() }).eq("id", id).select().single();
  if (error) throw error;
  return data as PetLicenseApplication;
}

// ── City Licenses ─────────────────────────────────────────────────────────────

export async function fetchCityLicenses(opts?: { status?: string; year?: number; search?: string; limit?: number }): Promise<CityPetLicense[]> {
  let q = supabase.from("city_pet_licenses").select("*").order("created_at", { ascending: false });
  if (opts?.status && opts.status !== "all") q = q.eq("status", opts.status);
  if (opts?.year) q = q.eq("year", opts.year);
  if (opts?.limit) q = q.limit(opts.limit);
  const { data } = await q;
  let rows = (data || []) as CityPetLicense[];
  if (opts?.search) {
    const s = opts.search.toLowerCase();
    rows = rows.filter((l) =>
      (l.animal_name || "").toLowerCase().includes(s) ||
      (l.owner_name || "").toLowerCase().includes(s) ||
      (l.license_number || "").toLowerCase().includes(s) ||
      (l.tag_number || "").toLowerCase().includes(s) ||
      (l.rabies_tag_number || "").toLowerCase().includes(s) ||
      (l.owner_address || "").toLowerCase().includes(s)
    );
  }
  return rows;
}

export async function fetchLicensesByApplication(applicationId: string): Promise<CityPetLicense[]> {
  const { data } = await supabase.from("city_pet_licenses").select("*").eq("application_id", applicationId);
  return (data || []) as CityPetLicense[];
}

async function genLicenseNumber(): Promise<string> {
  const year = new Date().getFullYear();
  const { count } = await supabase.from("city_pet_licenses").select("*", { count: "exact", head: true }).eq("year", year);
  return `MAD-${year}-${String((count || 0) + 1).padStart(5, "0")}`;
}

async function genTagNumber(): Promise<string> {
  const { count } = await supabase.from("city_pet_licenses").select("*", { count: "exact", head: true });
  return String((count || 0) + 1);
}

export async function issueLicense(license: Omit<CityPetLicense, "id" | "license_number" | "tag_number" | "created_at">): Promise<CityPetLicense> {
  const license_number = await genLicenseNumber();
  const tag_number = await genTagNumber();
  const { data, error } = await supabase.from("city_pet_licenses").insert({ ...license, license_number, tag_number }).select().single();
  if (error) throw error;
  return data as CityPetLicense;
}

export async function updateCityLicense(id: string, updates: Partial<CityPetLicense>): Promise<void> {
  await supabase.from("city_pet_licenses").update({ ...updates, updated_at: new Date().toISOString() }).eq("id", id);
}

export async function approveApplication(
  application: PetLicenseApplication,
  issuedBy: string,
): Promise<CityPetLicense[]> {
  const year = new Date().getFullYear();
  const issueDate = new Date().toISOString().split("T")[0];
  const expDate = `${year + 1}-07-01`;
  const ownerName = `${application.owner_first_name} ${application.owner_last_name}`;

  const licenses: CityPetLicense[] = [];
  for (const a of application.animals) {
    const lic = await issueLicense({
      application_id: application.id,
      year,
      status: "Active",
      animal_name: a.name,
      species: "Dog",
      breed: a.breed,
      color: a.color,
      markings: a.markings,
      sex: a.sex,
      sterilized: a.sterilized ?? undefined,
      veterinarian: a.veterinarian,
      rabies_tag_number: a.rabies_tag,
      rabies_expiration: a.rabies_expiration || undefined,
      owner_name: ownerName,
      owner_phone: application.owner_phone,
      owner_address: `${application.owner_address}, ${application.owner_city}, ${application.owner_state}`,
      issue_date: issueDate,
      expiration_date: expDate,
      issued_by: issuedBy,
      issued_at: new Date().toISOString(),
    });
    licenses.push(lic);
  }

  await updateApplication(application.id, {
    status: "Approved",
    reviewed_by: issuedBy,
    reviewed_at: new Date().toISOString(),
    payment_status: "Unpaid",
  });

  return licenses;
}

// ── Dashboard Stats ───────────────────────────────────────────────────────────

export async function fetchCityDashboardStats() {
  const year = new Date().getFullYear();
  const todayStr = new Date().toISOString().split("T")[0];
  const in30Days = new Date(Date.now() + 30 * 86400000).toISOString().split("T")[0];

  const [apps, licenses] = await Promise.all([
    supabase.from("pet_license_applications").select("status, submitted_at").eq("year", year),
    supabase.from("city_pet_licenses").select("status, expiration_date").eq("year", year),
  ]);

  const appRows = (apps.data || []) as Array<{ status: string; submitted_at?: string }>;
  const licRows = (licenses.data || []) as Array<{ status: string; expiration_date?: string }>;

  const pending = appRows.filter((a) => a.status === "Pending" || a.status === "Under Review").length;
  const approved = appRows.filter((a) => a.status === "Approved").length;
  const active = licRows.filter((l) => l.status === "Active").length;
  const expired = licRows.filter((l) => l.status === "Expired").length;
  const expiringSoon = licRows.filter((l) => l.status === "Active" && l.expiration_date && l.expiration_date <= in30Days && l.expiration_date >= todayStr).length;

  return { pending, approved, active, expired, expiringSoon, total: appRows.length };
}
