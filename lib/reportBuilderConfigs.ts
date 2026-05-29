import { supabase } from "@/lib/supabase";
import {
  fetchAnimals,
  fetchCalls,
  fetchCitations,
  fetchMedical,
  fetchAdoptions,
  fetchReceipts,
  fetchTransfers,
  fetchVolunteerLogs,
  fetchLostFoundReports,
  fetchMicrochipRegistry,
  fetchDepartureReceipts,
  fetchFosterPlacementsByAnimal,
} from "@/lib/data";
import type { ReportConfig, ReportRow } from "@/lib/reportTypes";
import type { FosterPlacement } from "@/lib/types";

void fetchFosterPlacementsByAnimal;

function inRange(d: string | null | undefined, from: string, to: string): boolean {
  if (!d) return !from;
  const ds = d.slice(0, 10);
  return (!from || ds >= from) && (!to || ds <= to);
}

function match(val: unknown, filter: string): boolean {
  if (!filter || filter === "All") return true;
  return String(val ?? "").toLowerCase().includes(filter.toLowerCase());
}

function fmtDate(d: string | null | undefined): string {
  if (!d) return "—";
  const m = d.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[2]}/${m[3]}/${m[1]}` : d;
}

function fmtMoney(n: number | null | undefined): string {
  if (n == null) return "—";
  return `$${Number(n).toFixed(2)}`;
}

function days(a: string | null | undefined, b?: string): number {
  if (!a) return 0;
  const end = b ? new Date(b) : new Date();
  return Math.max(0, Math.floor((end.getTime() - new Date(a).getTime()) / 86400000));
}

function safeLineItems(items: unknown): string {
  if (!Array.isArray(items)) return "—";
  return items.map((i: Record<string, unknown>) => i.item).filter(Boolean).join(", ") || "—";
}

export const REPORT_CONFIGS: ReportConfig[] = [
  {
    id: "dispatch",
    title: "Dispatch Summary Report",
    icon: "🚨",
    description: "All dispatch calls with officer assignments, caller info, and resolution status.",
    category: "Field Reports",
    filters: [
      {
        key: "type",
        label: "Call Type",
        type: "select",
        options: ["Stray Animal", "Loose Dog", "Animal Bite", "Noise Complaint", "Welfare Check", "Cruelty/Neglect", "Aggressive Animal", "Dead Animal", "Wildlife"],
      },
      { key: "priority", label: "Priority", type: "select", options: ["Low", "Medium", "High", "Emergency"] },
      { key: "status", label: "Status", type: "select", options: ["Open", "In Progress", "Resolved", "Closed"] },
    ],
    fields: [
      { key: "call_number", label: "Call #" },
      { key: "date_reported", label: "Date" },
      { key: "time_reported", label: "Time" },
      { key: "type", label: "Call Type" },
      { key: "priority", label: "Priority" },
      { key: "caller", label: "Caller Name" },
      { key: "caller_phone", label: "Caller Phone" },
      { key: "address", label: "Address" },
      { key: "city", label: "City" },
      { key: "officer", label: "Officer Assigned" },
      { key: "status", label: "Status" },
      { key: "description", label: "Description" },
      { key: "animal_involved", label: "Animal Involved", format: (val) => (val ? "Yes" : "No") },
      { key: "animal_description", label: "Animal Description" },
    ],
    fetchData: async (dateFrom, dateTo, filters) => {
      const calls = await fetchCalls();
      return calls
        .filter((c) => {
          const dateStr = c.created_at ? c.created_at.slice(0, 10) : "";
          if (!inRange(dateStr, dateFrom, dateTo)) return false;
          if (!match(c.type, filters.type)) return false;
          if (!match(c.priority, filters.priority)) return false;
          if (!match(c.status, filters.status)) return false;
          return true;
        })
        .map((c) => {
          const officers = Array.isArray(c.assigned_officers) ? c.assigned_officers : [];
          return {
            call_number: c.id.slice(0, 8).toUpperCase(),
            date_reported: c.created_at ? c.created_at.slice(0, 10) : "",
            time_reported: c.created_at ? c.created_at.slice(11, 16) : "",
            type: c.type,
            priority: c.priority,
            caller: c.caller ?? "—",
            caller_phone: c.caller_phone ?? "—",
            address: c.address ?? "—",
            city: c.city ?? "—",
            officer: (officers[0] as { name?: string })?.name ?? "—",
            status: c.status,
            description: c.description ?? "—",
            animal_involved: c.animal_involved ? 1 : 0,
            animal_description: c.animal_description ?? "—",
          } as ReportRow;
        });
    },
  },

  {
    id: "animals",
    title: "Animal Intake/Outcome Report",
    icon: "🐾",
    description: "Animal intake records with species, breed, status, and length of stay.",
    category: "Shelter Reports",
    filters: [
      { key: "species", label: "Species", type: "select", options: ["Dog", "Cat", "Other"] },
      { key: "intake_type", label: "Intake Type", type: "select", options: ["Stray", "Owner Surrender", "ACO Impound", "Transfer In", "Born in Shelter", "Return", "Confiscation"] },
      { key: "status", label: "Status", type: "select", options: ["Available", "Adopted", "Foster", "Medical Hold", "Quarantine", "Pending", "Euthanized", "Transferred", "Redeemed"] },
      { key: "fixed", label: "Fixed", type: "select", options: ["Yes", "No"] },
    ],
    fields: [
      { key: "animal_id", label: "Animal ID" },
      { key: "name", label: "Name" },
      { key: "species", label: "Species" },
      { key: "breed", label: "Breed" },
      { key: "color", label: "Color" },
      { key: "sex", label: "Sex" },
      { key: "age", label: "Age" },
      { key: "weight", label: "Weight" },
      { key: "intake_date", label: "Intake Date", format: (val) => fmtDate(val as string) },
      { key: "intake_type", label: "Intake Type" },
      { key: "status", label: "Status" },
      { key: "kennel", label: "Kennel" },
      { key: "microchip", label: "Microchip" },
      { key: "fixed", label: "Fixed", format: (val) => (val ? "Yes" : "No") },
      { key: "days_in_shelter", label: "Days in Shelter" },
      { key: "circumstance", label: "Circumstance" },
      { key: "intake_condition", label: "Intake Condition" },
    ],
    fetchData: async (dateFrom, dateTo, filters) => {
      const animals = await fetchAnimals();
      return animals
        .filter((a) => {
          if (!inRange(a.intake_date, dateFrom, dateTo)) return false;
          if (filters.species && filters.species !== "All") {
            if (!match(a.species, filters.species)) return false;
          }
          if (filters.intake_type && filters.intake_type !== "All") {
            if (!match(a.intake_type, filters.intake_type)) return false;
          }
          if (filters.status && filters.status !== "All") {
            if (!match(a.status, filters.status)) return false;
          }
          if (filters.fixed && filters.fixed !== "All") {
            const fixedVal = a.fixed ? "Yes" : "No";
            if (fixedVal !== filters.fixed) return false;
          }
          return true;
        })
        .map((a) => ({
          animal_id: a.id,
          name: a.name,
          species: a.species,
          breed: a.breed,
          color: a.color,
          sex: a.sex,
          age: a.age ?? "—",
          weight: a.weight ?? "—",
          intake_date: a.intake_date,
          intake_type: a.intake_type,
          status: a.status,
          kennel: a.kennel ?? "—",
          microchip: a.microchip ?? "—",
          fixed: a.fixed ? 1 : 0,
          days_in_shelter: days(a.intake_date),
          circumstance: a.circumstance ?? "—",
          intake_condition: a.intake_condition ?? "—",
        } as ReportRow));
    },
  },

  {
    id: "adoptions",
    title: "Adoption Report",
    icon: "🏠",
    description: "Completed adoptions with adopter information and associated receipts.",
    category: "Outcome Reports",
    filters: [
      { key: "species", label: "Species", type: "select", options: ["Dog", "Cat", "Other"] },
      { key: "processed_by", label: "Processed By", type: "text" },
    ],
    fields: [
      { key: "animal_id", label: "Animal ID" },
      { key: "animal_name", label: "Animal Name" },
      { key: "species", label: "Species" },
      { key: "breed", label: "Breed" },
      { key: "adopter_name", label: "Adopter Name" },
      { key: "adoption_date", label: "Adoption Date", format: (val) => fmtDate(val as string) },
      { key: "notes", label: "Notes" },
      { key: "receipt_id", label: "Receipt #" },
    ],
    fetchData: async (dateFrom, dateTo, filters) => {
      const [adoptions, animals] = await Promise.all([fetchAdoptions(), fetchAnimals()]);
      const animalMap = new Map(animals.map((a) => [a.id, a]));
      return adoptions
        .filter((r) => {
          if (!inRange(r.adoption_date, dateFrom, dateTo)) return false;
          const animal = animalMap.get(r.animal_id);
          if (filters.species && filters.species !== "All") {
            if (!match(animal?.species, filters.species)) return false;
          }
          return true;
        })
        .map((r) => {
          const animal = animalMap.get(r.animal_id);
          return {
            animal_id: r.animal_id,
            animal_name: r.animal_name,
            species: animal?.species ?? "—",
            breed: animal?.breed ?? "—",
            adopter_name: r.adopter_name,
            adoption_date: r.adoption_date,
            notes: r.notes ?? "—",
            receipt_id: r.receipt_id ?? "—",
          } as ReportRow;
        });
    },
  },

  {
    id: "transfers",
    title: "Transfer Report",
    icon: "🚛",
    description: "Animals transferred to rescue groups or partner agencies.",
    category: "Outcome Reports",
    filters: [
      { key: "species", label: "Species", type: "select", options: ["Dog", "Cat", "Other"] },
      { key: "rescue_group_name", label: "Receiving Agency", type: "text" },
    ],
    fields: [
      { key: "transfer_number", label: "Transfer #" },
      { key: "date", label: "Date", format: (val) => fmtDate(val as string) },
      { key: "animal_name", label: "Animal Name" },
      { key: "species", label: "Species" },
      { key: "breed", label: "Breed" },
      { key: "rescue_group_name", label: "Receiving Agency" },
      { key: "officer", label: "Officer" },
      { key: "condition_at_transfer", label: "Condition" },
      { key: "notes", label: "Notes" },
    ],
    fetchData: async (dateFrom, dateTo, filters) => {
      const [transfers, animals] = await Promise.all([fetchTransfers(), fetchAnimals()]);
      const animalMap = new Map(animals.map((a) => [a.id, a]));
      const rows: ReportRow[] = [];
      for (const t of transfers) {
        if (!inRange(t.date, dateFrom, dateTo)) continue;
        if (!match(t.rescue_group_name, filters.rescue_group_name)) continue;
        const ids = Array.isArray(t.animal_ids) ? t.animal_ids : [];
        const names = Array.isArray(t.animal_names) ? t.animal_names : [];
        if (ids.length === 0) continue;
        for (let i = 0; i < ids.length; i++) {
          const animalId = ids[i];
          const animalName = names[i] || animalId;
          const animal = animalMap.get(animalId);
          if (filters.species && filters.species !== "All") {
            if (!match(animal?.species, filters.species)) continue;
          }
          rows.push({
            transfer_number: t.transfer_number,
            date: t.date,
            animal_name: animalName,
            species: animal?.species ?? "—",
            breed: animal?.breed ?? "—",
            rescue_group_name: t.rescue_group_name ?? "—",
            officer: t.officer ?? "—",
            condition_at_transfer: t.condition_at_transfer ?? "—",
            notes: t.notes ?? "—",
          });
        }
      }
      return rows;
    },
  },

  {
    id: "redemptions",
    title: "Redemption Report",
    icon: "🔑",
    description: "Owner redemptions with fees collected and payment details.",
    category: "Outcome Reports",
    filters: [
      { key: "species", label: "Species", type: "select", options: ["Dog", "Cat", "Other"] },
      { key: "payment_method", label: "Payment Method", type: "select", options: ["Cash", "Check", "Credit", "Debit", "Money Order"] },
    ],
    fields: [
      { key: "receipt_number", label: "Receipt #" },
      { key: "departure_date", label: "Date", format: (val) => fmtDate(val as string) },
      { key: "animal_name", label: "Animal Name" },
      { key: "species", label: "Species" },
      { key: "person_name", label: "Owner Name" },
      { key: "total_fees", label: "Total Fees", format: (val) => fmtMoney(val as number) },
      { key: "payment_method", label: "Payment Method" },
      { key: "officer_name", label: "Officer" },
      { key: "notes", label: "Notes" },
    ],
    fetchData: async (dateFrom, dateTo, filters) => {
      const [receipts, animals] = await Promise.all([fetchDepartureReceipts(), fetchAnimals()]);
      const animalMap = new Map(animals.map((a) => [a.id, a]));
      return receipts
        .filter((r) => {
          const t = (r.departure_type ?? "").toLowerCase();
          if (!t.includes("redeem") && !t.includes("redemption")) return false;
          if (!inRange(r.departure_date, dateFrom, dateTo)) return false;
          if (!match(r.payment_method, filters.payment_method)) return false;
          const animal = animalMap.get(r.animal_id);
          if (filters.species && filters.species !== "All") {
            if (!match(animal?.species, filters.species)) return false;
          }
          return true;
        })
        .map((r) => {
          const animal = animalMap.get(r.animal_id);
          return {
            receipt_number: r.receipt_number,
            departure_date: r.departure_date,
            animal_name: r.animal_name,
            species: animal?.species ?? "—",
            person_name: r.person_name ?? "—",
            total_fees: r.total_fees,
            payment_method: r.payment_method ?? "—",
            officer_name: r.officer_name ?? "—",
            notes: r.notes ?? "—",
          } as ReportRow;
        });
    },
  },

  {
    id: "citations",
    title: "Citation Report",
    icon: "📋",
    description: "Issued citations with violator info, fines, and court dates.",
    category: "Field Reports",
    filters: [
      { key: "violation_type", label: "Violation Type", type: "text" },
      { key: "status", label: "Status", type: "select", options: ["Issued", "Pending Court", "Paid", "Dismissed", "Guilty", "Not Guilty"] },
      { key: "court_type", label: "Court", type: "select", options: ["Magistrate", "Municipal", "State"] },
      { key: "issuing_officer", label: "Officer", type: "text" },
    ],
    fields: [
      { key: "citation_number", label: "Citation #" },
      { key: "date", label: "Date", format: (val) => fmtDate(val as string) },
      { key: "violator_name", label: "Violator Name" },
      { key: "violator_address", label: "Address" },
      { key: "violator_city", label: "City" },
      { key: "violation_type", label: "Violation Type" },
      { key: "fine_amount", label: "Fine Amount", format: (val) => fmtMoney(val as number) },
      { key: "court_date", label: "Court Date", format: (val) => fmtDate(val as string) },
      { key: "court_type", label: "Court" },
      { key: "status", label: "Status" },
      { key: "issuing_officer", label: "Officer" },
      { key: "fine_paid", label: "Paid", format: (val) => (val ? "Yes" : "No") },
      { key: "location", label: "Location" },
      { key: "animal_desc", label: "Animal Description" },
    ],
    fetchData: async (dateFrom, dateTo, filters) => {
      const citations = await fetchCitations();
      return citations
        .filter((c) => {
          if (!inRange(c.date, dateFrom, dateTo)) return false;
          if (!match(c.violation_type, filters.violation_type)) return false;
          if (!match(c.status, filters.status)) return false;
          if (!match(c.court_type, filters.court_type)) return false;
          if (!match(c.issuing_officer, filters.issuing_officer)) return false;
          return true;
        })
        .map((c) => ({
          citation_number: c.citation_number,
          date: c.date,
          violator_name: c.violator_name || [c.violator_first, c.violator_last].filter(Boolean).join(" ") || "—",
          violator_address: c.violator_address ?? "—",
          violator_city: c.violator_city ?? "—",
          violation_type: c.violation_type ?? "—",
          fine_amount: c.fine_amount ?? null,
          court_date: c.court_date ?? null,
          court_type: c.court_type ?? "—",
          status: c.status ?? "—",
          issuing_officer: c.issuing_officer ?? "—",
          fine_paid: c.fine_paid ? 1 : 0,
          location: c.location ?? "—",
          animal_desc: c.animal_desc ?? "—",
        } as ReportRow));
    },
  },

  {
    id: "euthanasia",
    title: "Euthanasia Report",
    icon: "💔",
    description: "Euthanasia records with reasons, drug information, and authorizations.",
    category: "Shelter Reports",
    filters: [
      { key: "species", label: "Species", type: "select", options: ["Dog", "Cat", "Other"] },
      {
        key: "reason",
        label: "Reason",
        type: "select",
        options: [
          "Owner Request",
          "Medical — Suffering / Quality of Life",
          "Medical — Untreatable Condition",
          "Medical — Infectious Disease",
          "Kennel Decline",
          "Behavioral — Aggression (Dog to Dog)",
          "Behavioral — Aggression (Dog to Human)",
          "Behavioral — Aggression (Cat)",
          "Behavioral — Feral / Unsocialized",
          "Court Ordered",
          "Bite Case — Rabies Testing Required",
          "Space / Capacity",
          "Other",
        ],
      },
      { key: "performed_by", label: "Performed By", type: "text" },
    ],
    fields: [
      { key: "euth_date", label: "Date", format: (val) => fmtDate(val as string) },
      { key: "animal_id", label: "Animal ID" },
      { key: "name", label: "Name" },
      { key: "species", label: "Species" },
      { key: "breed", label: "Breed" },
      { key: "age", label: "Age" },
      { key: "sex", label: "Sex" },
      { key: "reason", label: "Reason" },
      { key: "performed_by", label: "Performed By" },
      { key: "authorized_by", label: "Authorized By" },
      { key: "drug", label: "Drug" },
      { key: "dosage", label: "Dosage" },
      { key: "intake_date", label: "Intake Date", format: (val) => fmtDate(val as string) },
      { key: "days_in_shelter", label: "Days in Shelter" },
      { key: "notes", label: "Notes" },
    ],
    fetchData: async (dateFrom, dateTo, filters) => {
      const animals = await fetchAnimals();
      return animals
        .filter((a) => {
          if (a.status !== "Euthanized") return false;
          if (!a.euthanasia) return false;
          const euth = typeof a.euthanasia === "string" ? JSON.parse(a.euthanasia as unknown as string) : a.euthanasia;
          if (!inRange(euth?.date, dateFrom, dateTo)) return false;
          if (filters.species && filters.species !== "All" && !match(a.species, filters.species)) return false;
          if (!match(euth?.reason, filters.reason)) return false;
          if (!match(euth?.performed_by, filters.performed_by)) return false;
          return true;
        })
        .map((a) => {
          const euth = typeof a.euthanasia === "string" ? JSON.parse(a.euthanasia as unknown as string) : a.euthanasia;
          return {
            euth_date: euth?.date ?? null,
            animal_id: a.id,
            name: a.name,
            species: a.species,
            breed: a.breed,
            age: a.age ?? "—",
            sex: a.sex,
            reason: euth?.reason ?? "—",
            performed_by: euth?.performed_by ?? "—",
            authorized_by: euth?.authorized_by ?? "—",
            drug: euth?.drug ?? "—",
            dosage: euth?.dosage ?? "—",
            intake_date: a.intake_date,
            days_in_shelter: days(a.intake_date, euth?.date),
            notes: euth?.notes ?? "—",
          } as ReportRow;
        });
    },
  },

  {
    id: "medical",
    title: "Medical Report",
    icon: "🏥",
    description: "Medical treatments, vaccinations, and procedures for all animals.",
    category: "Shelter Reports",
    filters: [
      { key: "species", label: "Species", type: "select", options: ["Dog", "Cat", "Other"] },
      { key: "type", label: "Treatment Type", type: "select", options: ["Vaccination", "Deworming", "Spay/Neuter", "Surgery", "Medication", "Examination", "Microchip", "Other"] },
      { key: "vet", label: "Veterinarian", type: "text" },
    ],
    fields: [
      { key: "date", label: "Date", format: (val) => fmtDate(val as string) },
      { key: "animal_id", label: "Animal ID" },
      { key: "animal_name", label: "Animal Name" },
      { key: "species", label: "Species" },
      { key: "breed", label: "Breed" },
      { key: "type", label: "Treatment Type" },
      { key: "description", label: "Description" },
      { key: "vet", label: "Veterinarian" },
      { key: "lot_number", label: "Lot Number" },
      { key: "manufacturer", label: "Manufacturer" },
      { key: "dosage", label: "Dosage" },
      { key: "route", label: "Route" },
      { key: "next_due", label: "Next Due", format: (val) => fmtDate(val as string), defaultOn: false },
      { key: "cost", label: "Cost", format: (val) => fmtMoney(val as number), defaultOn: false },
      { key: "notes", label: "Notes" },
    ],
    fetchData: async (dateFrom, dateTo, filters) => {
      const [medical, animals] = await Promise.all([fetchMedical(), fetchAnimals()]);
      const animalMap = new Map(animals.map((a) => [a.id, a]));
      return medical
        .filter((m) => {
          if (!inRange(m.date, dateFrom, dateTo)) return false;
          if (!match(m.type, filters.type)) return false;
          if (!match(m.vet, filters.vet)) return false;
          const animal = animalMap.get(m.animal_id);
          if (filters.species && filters.species !== "All" && !match(animal?.species, filters.species)) return false;
          return true;
        })
        .map((m) => {
          const animal = animalMap.get(m.animal_id);
          return {
            date: m.date,
            animal_id: m.animal_id,
            animal_name: m.animal_name,
            species: animal?.species ?? "—",
            breed: animal?.breed ?? "—",
            type: m.type,
            description: m.description,
            vet: m.vet ?? "—",
            lot_number: m.lot_number ?? "—",
            manufacturer: m.manufacturer ?? "—",
            dosage: m.dosage ?? "—",
            route: m.route ?? "—",
            next_due: m.next_due ?? null,
            cost: m.cost ?? null,
            notes: m.notes ?? "—",
          } as ReportRow;
        });
    },
  },

  {
    id: "volunteers",
    title: "Volunteer Hours Report",
    icon: "🙋",
    description: "Volunteer session logs with hours, tasks, and clock-in/out times.",
    category: "Operations Reports",
    filters: [
      { key: "person_name", label: "Volunteer", type: "text" },
      { key: "task", label: "Task", type: "text" },
    ],
    fields: [
      { key: "date", label: "Date", format: (val) => fmtDate(val as string) },
      { key: "person_name", label: "Volunteer Name" },
      { key: "task", label: "Task" },
      { key: "clock_in", label: "Clock In" },
      { key: "clock_out", label: "Clock Out" },
      { key: "hours", label: "Hours", format: (val) => (val != null ? Number(val).toFixed(2) : "—") },
      { key: "notes", label: "Notes" },
    ],
    fetchData: async (dateFrom, dateTo, filters) => {
      const logs = await fetchVolunteerLogs();
      return logs
        .filter((l) => {
          if (!inRange(l.date, dateFrom, dateTo)) return false;
          if (!match(l.person_name, filters.person_name)) return false;
          if (!match(l.task, filters.task)) return false;
          return true;
        })
        .map((l) => ({
          date: l.date,
          person_name: l.person_name,
          task: l.task,
          clock_in: l.clock_in ? l.clock_in.slice(11, 16) : "—",
          clock_out: l.clock_out ? l.clock_out.slice(11, 16) : "—",
          hours: l.hours ?? null,
          notes: l.notes ?? "—",
        } as ReportRow));
    },
    summaryRow: (rows) => ({
      date: "TOTAL",
      person_name: "",
      task: `${rows.length} sessions`,
      clock_in: "",
      clock_out: "",
      hours: rows.reduce((s, r) => s + (Number(r.hours) || 0), 0).toFixed(2),
      notes: "",
    }),
  },

  {
    id: "foster",
    title: "Foster Report",
    icon: "🏡",
    description: "Active and completed foster placements with foster parent and animal info.",
    category: "Outcome Reports",
    filters: [
      { key: "species", label: "Species", type: "select", options: ["Dog", "Cat", "Other"] },
      { key: "status", label: "Status", type: "select", options: ["Active", "Returned", "Extended", "Transferred"] },
    ],
    fields: [
      { key: "animal_id", label: "Animal ID" },
      { key: "animal_name", label: "Animal Name" },
      { key: "species", label: "Species" },
      { key: "breed", label: "Breed" },
      { key: "foster_parent_name", label: "Foster Parent" },
      { key: "start_date", label: "Start Date", format: (val) => fmtDate(val as string) },
      { key: "expected_return_date", label: "Expected Return", format: (val) => fmtDate(val as string) },
      { key: "actual_return_date", label: "Actual Return", format: (val) => fmtDate(val as string) },
      { key: "status", label: "Status" },
      { key: "days_fostered", label: "Days Fostered" },
      { key: "reason", label: "Reason" },
      { key: "care_instructions", label: "Care Notes", defaultOn: false },
    ],
    fetchData: async (dateFrom, dateTo, filters) => {
      const { data } = await supabase
        .from("foster_placements")
        .select("*")
        .order("created_at", { ascending: false });
      const placements = (data as FosterPlacement[]) ?? [];
      const animals = await fetchAnimals();
      const animalMap = new Map(animals.map((a) => [a.id, a]));
      return placements
        .filter((p) => {
          if (!inRange(p.start_date, dateFrom, dateTo)) return false;
          if (!match(p.status, filters.status)) return false;
          const animal = animalMap.get(p.animal_id);
          if (filters.species && filters.species !== "All" && !match(animal?.species, filters.species)) return false;
          return true;
        })
        .map((p) => {
          const animal = animalMap.get(p.animal_id);
          return {
            animal_id: p.animal_id,
            animal_name: p.animal_name ?? animal?.name ?? "—",
            species: animal?.species ?? "—",
            breed: animal?.breed ?? "—",
            foster_parent_name: p.foster_parent_name ?? "—",
            start_date: p.start_date ?? null,
            expected_return_date: p.expected_return_date ?? null,
            actual_return_date: p.actual_return_date ?? null,
            status: p.status ?? "—",
            days_fostered: days(p.start_date ?? null, p.actual_return_date ?? undefined),
            reason: p.reason ?? "—",
            care_instructions: p.care_instructions ?? "—",
          } as ReportRow;
        });
    },
  },

  {
    id: "financial",
    title: "Financial Report",
    icon: "💰",
    description: "Revenue receipts grouped by category with payment method breakdown.",
    category: "Operations Reports",
    filters: [
      { key: "category", label: "Category", type: "select", options: ["Adoption Fees", "Redemption Fees", "Boarding", "Citations", "Merchandise", "Donations", "Services"] },
      { key: "payment_method", label: "Payment Method", type: "select", options: ["Cash", "Check", "Credit Card", "Debit Card", "Money Order", "Online"] },
    ],
    fields: [
      { key: "date", label: "Date", format: (val) => fmtDate(val as string) },
      { key: "category", label: "Category" },
      { key: "description", label: "Description" },
      { key: "amount", label: "Amount", format: (val) => fmtMoney(val as number) },
      { key: "payment_method", label: "Payment Method" },
      { key: "person_name", label: "Person" },
      { key: "notes", label: "Notes" },
    ],
    fetchData: async (dateFrom, dateTo, filters) => {
      const receipts = await fetchReceipts();
      return receipts
        .filter((r) => {
          if (!inRange(r.date, dateFrom, dateTo)) return false;
          if (!match(r.category, filters.category)) return false;
          if (!match(r.payment_method, filters.payment_method)) return false;
          return true;
        })
        .map((r) => ({
          date: r.date,
          category: r.category,
          description: safeLineItems(r.line_items),
          amount: r.total,
          payment_method: r.payment_method,
          person_name: r.anonymous ? "Anonymous" : (r.person_name ?? "—"),
          notes: r.notes ?? "—",
        } as ReportRow));
    },
    summaryRow: (rows) => ({
      date: "TOTAL",
      category: `${rows.length} receipts`,
      description: "",
      amount: rows.reduce((s, r) => s + (Number(r.amount) || 0), 0),
      payment_method: "",
      person_name: "",
      notes: "",
    }),
  },

  {
    id: "lost-found",
    title: "Lost & Found Report",
    icon: "🔍",
    description: "Lost and found pet reports with reporter contact info and resolution status.",
    category: "Operations Reports",
    filters: [
      { key: "type", label: "Type", type: "select", options: ["lost", "found"] },
      { key: "species", label: "Species", type: "select", options: ["Dog", "Cat", "Other"] },
      { key: "status", label: "Status", type: "select", options: ["active", "matched", "reunited", "archived"] },
    ],
    fields: [
      { key: "date_lost_found", label: "Date", format: (val) => fmtDate(val as string) },
      { key: "type", label: "Type", format: (val) => (val === "lost" ? "Lost" : "Found") },
      { key: "species", label: "Species" },
      { key: "breed", label: "Breed" },
      { key: "pet_name", label: "Pet Name" },
      { key: "color", label: "Color" },
      { key: "location_city", label: "City" },
      { key: "reporter_name", label: "Reporter Name" },
      { key: "reporter_phone", label: "Reporter Phone" },
      { key: "status", label: "Status" },
      { key: "reunited_date", label: "Resolved Date", format: (val) => fmtDate(val as string) },
    ],
    fetchData: async (dateFrom, dateTo, filters) => {
      const reports = await fetchLostFoundReports();
      return reports
        .filter((r) => {
          if (!inRange(r.date_lost_found, dateFrom, dateTo)) return false;
          if (!match(r.type, filters.type)) return false;
          if (!match(r.species, filters.species)) return false;
          if (!match(r.status, filters.status)) return false;
          return true;
        })
        .map((r) => ({
          date_lost_found: r.date_lost_found,
          type: r.type,
          species: r.species,
          breed: r.breed ?? "—",
          pet_name: r.pet_name ?? "—",
          color: r.color ?? "—",
          location_city: r.location_city ?? "—",
          reporter_name: r.reporter_name ?? "—",
          reporter_phone: r.reporter_phone ?? "—",
          status: r.status,
          reunited_date: r.reunited_date ?? null,
        } as ReportRow));
    },
  },

  {
    id: "microchip",
    title: "Microchip Report",
    icon: "🔬",
    description: "Internal microchip registry with owner info and registration details.",
    category: "Shelter Reports",
    filters: [
      { key: "manufacturer", label: "Manufacturer", type: "text" },
      { key: "species", label: "Species", type: "select", options: ["Dog", "Cat", "Other"] },
    ],
    fields: [
      { key: "chip_number", label: "Chip Number" },
      { key: "manufacturer", label: "Manufacturer" },
      { key: "animal_id", label: "Animal ID" },
      { key: "animal_name", label: "Animal Name" },
      { key: "species", label: "Species" },
      { key: "breed", label: "Breed" },
      { key: "owner_name", label: "Owner Name" },
      { key: "owner_phone", label: "Owner Phone" },
      { key: "registration_date", label: "Reg Date", format: (val) => fmtDate(val as string) },
      { key: "status", label: "Status" },
    ],
    fetchData: async (dateFrom, dateTo, filters) => {
      const registry = await fetchMicrochipRegistry();
      return registry
        .filter((r) => {
          if (!inRange(r.registration_date, dateFrom, dateTo)) return false;
          if (!match(r.manufacturer, filters.manufacturer)) return false;
          if (!match(r.species, filters.species)) return false;
          return true;
        })
        .map((r) => ({
          chip_number: r.chip_number,
          manufacturer: r.manufacturer ?? "—",
          animal_id: r.animal_id ?? "—",
          animal_name: r.animal_name ?? "—",
          species: r.species ?? "—",
          breed: r.breed ?? "—",
          owner_name: r.owner_name ?? "—",
          owner_phone: r.owner_phone ?? "—",
          registration_date: r.registration_date ?? null,
          status: r.status ?? "—",
        } as ReportRow));
    },
  },
];

export const REPORT_CONFIG_MAP: Record<string, ReportConfig> = Object.fromEntries(
  REPORT_CONFIGS.map((c) => [c.id, c])
);
