"use client";
import { supabase } from "./supabase";
import type {
  ClinicClient, ClinicAnimal, ClinicAppointment,
  ClinicInvoice, ClinicMedicalRecord, ClinicProcedure, ClinicEmail,
  ClinicRabiesCertificate, ClinicSettings, ClinicPerson, ClinicAnimalPerson,
} from "./clinicTypes";
import type { StaffAccount } from "./types";

// ── Clients ──────────────────────────────────────────────────────────────────

export async function fetchClinicClients(accountId: string): Promise<ClinicClient[]> {
  const { data } = await supabase.from("clinic_clients").select("*").eq("clinic_account_id", accountId).order("county_name");
  return (data || []) as ClinicClient[];
}

export async function createClinicClient(client: Omit<ClinicClient, "id" | "created_at">): Promise<ClinicClient> {
  const { data, error } = await supabase.from("clinic_clients").insert(client).select().single();
  if (error) throw error;
  return data as ClinicClient;
}

export async function updateClinicClient(id: string, updates: Partial<ClinicClient>): Promise<ClinicClient> {
  const { data, error } = await supabase.from("clinic_clients").update(updates).eq("id", id).select().single();
  if (error) throw error;
  return data as ClinicClient;
}

// ── Animals ──────────────────────────────────────────────────────────────────

export async function fetchClinicAnimals(accountId: string, clientId?: string): Promise<ClinicAnimal[]> {
  let q = supabase.from("clinic_animals").select("*").eq("clinic_account_id", accountId);
  if (clientId) q = q.eq("client_id", clientId);
  const { data } = await q.order("name");
  return (data || []) as ClinicAnimal[];
}

export async function createClinicAnimal(animal: Omit<ClinicAnimal, "id" | "created_at" | "updated_at">): Promise<ClinicAnimal> {
  const { data, error } = await supabase.from("clinic_animals").insert(animal).select().single();
  if (error) throw error;
  return data as ClinicAnimal;
}

export async function updateClinicAnimal(id: string, updates: Partial<ClinicAnimal>): Promise<ClinicAnimal> {
  const { data, error } = await supabase.from("clinic_animals").update({ ...updates, updated_at: new Date().toISOString() }).eq("id", id).select().single();
  if (error) throw error;
  return data as ClinicAnimal;
}

// ── Appointments ─────────────────────────────────────────────────────────────

export async function fetchClinicAppointments(accountId: string, clientId?: string): Promise<ClinicAppointment[]> {
  let q = supabase.from("clinic_appointments").select("*").eq("clinic_account_id", accountId);
  if (clientId) q = q.eq("client_id", clientId);
  const { data } = await q.order("appointment_date", { ascending: false });
  return (data || []) as ClinicAppointment[];
}

export async function createClinicAppointment(appt: Omit<ClinicAppointment, "id" | "created_at">): Promise<ClinicAppointment> {
  const { data, error } = await supabase.from("clinic_appointments").insert(appt).select().single();
  if (error) throw error;
  return data as ClinicAppointment;
}

export async function updateClinicAppointment(id: string, updates: Partial<ClinicAppointment>): Promise<ClinicAppointment> {
  const { data, error } = await supabase.from("clinic_appointments").update(updates).eq("id", id).select().single();
  if (error) throw error;
  return data as ClinicAppointment;
}

// ── Medical Records ──────────────────────────────────────────────────────────

export async function fetchClinicMedical(accountId: string, clientId?: string, animalId?: string): Promise<ClinicMedicalRecord[]> {
  let q = supabase.from("clinic_medical_records").select("*").eq("clinic_account_id", accountId);
  if (clientId) q = q.eq("client_id", clientId);
  if (animalId) q = q.eq("animal_id", animalId);
  const { data } = await q.order("date", { ascending: false });
  return (data || []) as ClinicMedicalRecord[];
}

export async function createClinicMedical(rec: Omit<ClinicMedicalRecord, "id" | "created_at">): Promise<ClinicMedicalRecord> {
  const { data, error } = await supabase.from("clinic_medical_records").insert(rec).select().single();
  if (error) throw error;
  return data as ClinicMedicalRecord;
}

export async function updateClinicMedical(id: string, updates: Partial<ClinicMedicalRecord>): Promise<ClinicMedicalRecord> {
  const { data, error } = await supabase.from("clinic_medical_records").update(updates).eq("id", id).select().single();
  if (error) throw error;
  return data as ClinicMedicalRecord;
}

// ── Procedures ───────────────────────────────────────────────────────────────

export async function fetchClinicProcedures(accountId: string, clientId?: string, animalId?: string): Promise<ClinicProcedure[]> {
  let q = supabase.from("clinic_procedures").select("*").eq("clinic_account_id", accountId);
  if (clientId) q = q.eq("client_id", clientId);
  if (animalId) q = q.eq("animal_id", animalId);
  const { data } = await q.order("procedure_date", { ascending: false });
  return (data || []) as ClinicProcedure[];
}

export async function createClinicProcedure(proc: Omit<ClinicProcedure, "id" | "created_at">): Promise<ClinicProcedure> {
  const { data, error } = await supabase.from("clinic_procedures").insert(proc).select().single();
  if (error) throw error;
  return data as ClinicProcedure;
}

export async function updateClinicProcedure(id: string, updates: Partial<ClinicProcedure>): Promise<ClinicProcedure> {
  const { data, error } = await supabase.from("clinic_procedures").update(updates).eq("id", id).select().single();
  if (error) throw error;
  return data as ClinicProcedure;
}

// ── Invoices ─────────────────────────────────────────────────────────────────

export async function fetchClinicInvoices(accountId: string, clientId?: string): Promise<ClinicInvoice[]> {
  let q = supabase.from("clinic_invoices").select("*").eq("clinic_account_id", accountId);
  if (clientId) q = q.eq("client_id", clientId);
  const { data } = await q.order("invoice_date", { ascending: false });
  return (data || []) as ClinicInvoice[];
}

export async function createClinicInvoice(inv: Omit<ClinicInvoice, "id" | "created_at">): Promise<ClinicInvoice> {
  const { data, error } = await supabase.from("clinic_invoices").insert(inv).select().single();
  if (error) throw error;
  return data as ClinicInvoice;
}

export async function updateClinicInvoice(id: string, updates: Partial<ClinicInvoice>): Promise<ClinicInvoice> {
  const { data, error } = await supabase.from("clinic_invoices").update(updates).eq("id", id).select().single();
  if (error) throw error;
  return data as ClinicInvoice;
}

export async function generateInvoiceNumber(accountId: string): Promise<string> {
  const year = new Date().getFullYear();
  const { count } = await supabase.from("clinic_invoices").select("*", { count: "exact", head: true }).eq("clinic_account_id", accountId);
  return `INV-${year}-${String((count || 0) + 1).padStart(4, "0")}`;
}

// ── Emails ───────────────────────────────────────────────────────────────────

export async function fetchClinicEmails(accountId: string, clientId?: string): Promise<ClinicEmail[]> {
  let q = supabase.from("clinic_emails").select("*").eq("clinic_account_id", accountId);
  if (clientId) q = q.eq("client_id", clientId);
  const { data } = await q.order("created_at", { ascending: false });
  return (data || []) as ClinicEmail[];
}

export async function createClinicEmail(email: Omit<ClinicEmail, "id" | "created_at">): Promise<ClinicEmail> {
  const { data, error } = await supabase.from("clinic_emails").insert(email).select().single();
  if (error) throw error;
  return data as ClinicEmail;
}

export async function updateClinicEmail(id: string, updates: Partial<ClinicEmail>): Promise<ClinicEmail> {
  const { data, error } = await supabase.from("clinic_emails").update(updates).eq("id", id).select().single();
  if (error) throw error;
  return data as ClinicEmail;
}

// ── Dashboard Stats ──────────────────────────────────────────────────────────

export async function fetchClinicDashboardStats(accountId: string, clientId?: string) {
  const todayStr = new Date().toISOString().split("T")[0];
  const monthStart = `${todayStr.slice(0, 7)}-01`;

  const [animals, appts, procs, invoices, recentMed] = await Promise.all([
    (async () => {
      let q = supabase.from("clinic_medical_records").select("*", { count: "exact", head: true }).eq("clinic_account_id", accountId).gte("date", monthStart);
      if (clientId) q = q.eq("client_id", clientId);
      const { count } = await q;
      return count || 0;
    })(),
    (async () => {
      let q = supabase.from("clinic_appointments").select("*", { count: "exact", head: true }).eq("clinic_account_id", accountId).eq("appointment_date", todayStr);
      if (clientId) q = q.eq("client_id", clientId);
      const { count } = await q;
      return count || 0;
    })(),
    (async () => {
      let q = supabase.from("clinic_procedures").select("*", { count: "exact", head: true }).eq("clinic_account_id", accountId).eq("outcome", "Pending");
      if (clientId) q = q.eq("client_id", clientId);
      const { count } = await q;
      return count || 0;
    })(),
    (async () => {
      let q = supabase.from("clinic_invoices").select("total").eq("clinic_account_id", accountId).in("status", ["Sent", "Overdue"]);
      if (clientId) q = q.eq("client_id", clientId);
      const { data } = await q;
      return (data || []).reduce((sum: number, inv: { total?: number }) => sum + (inv.total || 0), 0);
    })(),
    (async () => {
      let q = supabase.from("clinic_medical_records").select("*").eq("clinic_account_id", accountId).order("date", { ascending: false }).limit(5);
      if (clientId) q = q.eq("client_id", clientId);
      const { data } = await q;
      return (data || []) as ClinicMedicalRecord[];
    })(),
  ]);

  return { animalsThisMonth: animals, appointmentsToday: appts, pendingProcedures: procs, outstandingInvoices: invoices, recentMedical: recentMed };
}

// ── Rabies Certificates ──────────────────────────────────────────────────────

export async function fetchRabiesCertificates(accountId: string, clientId?: string): Promise<ClinicRabiesCertificate[]> {
  let q = supabase.from("clinic_rabies_certificates").select("*").eq("clinic_account_id", accountId);
  if (clientId) q = q.eq("client_id", clientId);
  const { data } = await q.order("issued_at", { ascending: false });
  return (data || []) as ClinicRabiesCertificate[];
}

export async function createRabiesCertificate(cert: Omit<ClinicRabiesCertificate, "id" | "issued_at">): Promise<ClinicRabiesCertificate> {
  const { data, error } = await supabase.from("clinic_rabies_certificates").insert(cert).select().single();
  if (error) throw error;
  return data as ClinicRabiesCertificate;
}

export async function voidRabiesCertificate(id: string, reason: string): Promise<void> {
  await supabase.from("clinic_rabies_certificates").update({ voided: true, void_reason: reason }).eq("id", id);
}

export async function generateCertificateNumber(accountId: string): Promise<string> {
  const year = new Date().getFullYear();
  const { count } = await supabase.from("clinic_rabies_certificates").select("*", { count: "exact", head: true }).eq("clinic_account_id", accountId);
  return `RC-${year}-${String((count || 0) + 1).padStart(4, "0")}`;
}

// ── Clinic Settings (stored in shelter_config id=7) ──────────────────────────

const CLINIC_SETTINGS_DEFAULTS: ClinicSettings = {
  clinic_name: "", vet_name: "", vet_credentials: "DVM", license_number: "",
  clinic_address: "", clinic_phone: "", clinic_email: "", logo_url: "",
  tax_rate: 0, invoice_prefix: "INV-", email_signature: "",
};

export async function fetchClinicSettings(accountId: string): Promise<ClinicSettings> {
  try {
    const { data } = await supabase.from("shelter_config").select("config_data").eq("id", `clinic-${accountId}`).maybeSingle();
    return { ...CLINIC_SETTINGS_DEFAULTS, ...(data?.config_data as Partial<ClinicSettings> ?? {}) };
  } catch { return CLINIC_SETTINGS_DEFAULTS; }
}

export async function saveClinicSettings(accountId: string, settings: ClinicSettings): Promise<void> {
  await supabase.from("shelter_config").upsert({
    id: `clinic-${accountId}`, config_data: settings as unknown as Record<string, unknown>, updated_at: new Date().toISOString(),
  });
}

// ── Vet Signature ────────────────────────────────────────────────────────────

export async function saveVetSignature(userId: string, signatureData: string): Promise<void> {
  await supabase.from("staff_accounts").update({ signature_data: signatureData }).eq("id", userId);
}

export async function fetchVetSignature(userId: string): Promise<string | null> {
  const { data } = await supabase.from("staff_accounts").select("signature_data").eq("id", userId).limit(1);
  return (data?.[0] as { signature_data?: string } | undefined)?.signature_data || null;
}

// ── Password Change ──────────────────────────────────────────────────────────

export async function changePassword(userId: string, currentPassword: string, newPassword: string): Promise<{ ok: boolean; error?: string }> {
  const { data } = await supabase.from("staff_accounts").select("password_hash").eq("id", userId).limit(1);
  const stored = (data?.[0] as { password_hash?: string } | undefined)?.password_hash?.trim();
  if (!stored || stored !== currentPassword.trim()) return { ok: false, error: "Current password is incorrect" };
  if (newPassword.length < 8) return { ok: false, error: "New password must be at least 8 characters" };
  if (!/\d/.test(newPassword)) return { ok: false, error: "New password must contain at least one number" };
  const { error } = await supabase.from("staff_accounts").update({ password_hash: newPassword }).eq("id", userId);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

// ── Clinic Employee Management ───────────────────────────────────────────────

export async function fetchClinicEmployees(platformCustomerId: string): Promise<StaffAccount[]> {
  const { data } = await supabase.from("staff_accounts").select("*").eq("platform_customer_id", platformCustomerId).order("first_name");
  return (data || []) as StaffAccount[];
}

export async function createClinicEmployee(employee: Record<string, unknown>): Promise<StaffAccount> {
  const { data, error } = await supabase.from("staff_accounts").insert(employee).select().single();
  if (error) throw error;
  return data as StaffAccount;
}

export async function updateClinicEmployee(id: string, updates: Record<string, unknown>): Promise<void> {
  const { error } = await supabase.from("staff_accounts").update(updates).eq("id", id);
  if (error) throw error;
}

export async function updateMyProfile(userId: string, updates: { first_name?: string; last_name?: string; email?: string; phone?: string }): Promise<void> {
  const { error } = await supabase.from("staff_accounts").update(updates).eq("id", userId);
  if (error) throw error;
}

// ── Clinic Customers (people) ────────────────────────────────────────────────

export async function fetchClinicPeople(accountId: string, clientId?: string): Promise<ClinicPerson[]> {
  let q = supabase.from("clinic_people").select("*").eq("clinic_account_id", accountId);
  if (clientId) q = q.eq("client_id", clientId);
  const { data } = await q.order("last_name");
  return (data || []) as ClinicPerson[];
}

export async function createClinicPerson(person: Omit<ClinicPerson, "id" | "created_at">): Promise<ClinicPerson> {
  const { data, error } = await supabase.from("clinic_people").insert(person).select().single();
  if (error) throw error;
  return data as ClinicPerson;
}

export async function updateClinicPerson(id: string, updates: Partial<ClinicPerson>): Promise<void> {
  await supabase.from("clinic_people").update(updates).eq("id", id);
}

export async function findDuplicateClinicPerson(accountId: string, phone?: string, email?: string): Promise<ClinicPerson | null> {
  const cleanPhone = (phone || "").replace(/\D/g, "");
  const cleanEmail = (email || "").trim().toLowerCase();
  if (!cleanPhone && !cleanEmail) return null;
  const { data } = await supabase.from("clinic_people").select("*").eq("clinic_account_id", accountId).limit(500);
  const rows = (data || []) as ClinicPerson[];
  const match = rows.find((p) => {
    const pPhone = (p.phone || "").replace(/\D/g, "");
    const pEmail = (p.email || "").trim().toLowerCase();
    return (cleanPhone && pPhone && pPhone === cleanPhone) || (cleanEmail && pEmail && pEmail === cleanEmail);
  });
  return match || null;
}

// ── Clinic Animal-Person Links ───────────────────────────────────────────────

export async function linkClinicAnimalToPerson(animalId: string, personId: string, role = "Owner"): Promise<void> {
  await supabase.from("clinic_animal_people").upsert({ animal_id: animalId, person_id: personId, role });
}

export async function unlinkClinicAnimalFromPerson(animalId: string, personId: string): Promise<void> {
  await supabase.from("clinic_animal_people").delete().eq("animal_id", animalId).eq("person_id", personId);
}

export async function fetchPeopleForClinicAnimal(animalId: string): Promise<ClinicAnimalPerson[]> {
  const { data: links } = await supabase.from("clinic_animal_people").select("*").eq("animal_id", animalId);
  if (!links?.length) return [];
  const personIds = links.map((l: Record<string, unknown>) => l.person_id as string);
  const { data: peopleRows } = await supabase.from("clinic_people").select("*").in("id", personIds);
  const peopleMap = new Map<string, ClinicPerson>((peopleRows || []).map((p: Record<string, unknown>) => [p.id as string, p as unknown as ClinicPerson]));
  return (links as Record<string, unknown>[]).map((l): ClinicAnimalPerson => ({
    id: l.id as string,
    animal_id: l.animal_id as string,
    person_id: l.person_id as string,
    role: (l.role as string) || "Owner",
    person: peopleMap.get(l.person_id as string),
  }));
}

export async function fetchAnimalsForClinicPerson(personId: string): Promise<ClinicAnimalPerson[]> {
  const { data: links } = await supabase.from("clinic_animal_people").select("*").eq("person_id", personId);
  if (!links?.length) return [];
  const animalIds = links.map((l: Record<string, unknown>) => l.animal_id as string);
  const { data: animalRows } = await supabase.from("clinic_animals").select("*").in("id", animalIds);
  const animalMap = new Map<string, ClinicAnimal>((animalRows || []).map((a: Record<string, unknown>) => [a.id as string, a as unknown as ClinicAnimal]));
  return (links as Record<string, unknown>[]).map((l): ClinicAnimalPerson => ({
    id: l.id as string,
    animal_id: l.animal_id as string,
    person_id: l.person_id as string,
    role: (l.role as string) || "Owner",
    animal: animalMap.get(l.animal_id as string),
  }));
}
