"use client";
import { supabase } from "./supabase";
import type { BiteReport, AttackingAnimalEntry, VictimAnimalEntry, BiteAnimalData } from "./biteReportTypes";
import { nullifyEmptyDates, nullifyEmptyBooleans } from "./sanitize";
import { linkAnimalToCall, DuplicateCallAnimalLinkError } from "./data";
import { getCurrentUserName } from "./auth";

// Top-level DATE/TIME columns in bite_reports that must never receive "".
const BITE_DATE_FIELDS = [
  "incident_date", "incident_time", "follow_up_date", "quarantine_release_date",
] as const;

// Top-level BOOLEAN columns in bite_reports that must never receive "".
const BITE_BOOL_FIELDS = [
  "law_enforcement_notified", "quarantine_ordered",
  "quarantine_released", "follow_up_required",
] as const;

// Every real Animal record referenced by a bite report's biting/victim
// entries, with the dispatch_call_animals role each should get.
export function extractLinkedAnimals(report: BiteReport): { animalId: string; role: string }[] {
  const out: { animalId: string; role: string }[] = [];
  if (report.report_type === "animal_human") {
    const id = (report.biting_animal_data as BiteAnimalData)?.linked_animal_id;
    if (id) out.push({ animalId: id, role: "Bit Someone" });
  } else {
    (report.biting_animal_data as AttackingAnimalEntry[] | undefined)?.forEach((e) => {
      if (e.animal?.linked_animal_id) out.push({ animalId: e.animal.linked_animal_id, role: "Bit Another Animal" });
    });
    (report.victim_data as VictimAnimalEntry[] | undefined)?.forEach?.((e) => {
      if (e.animal?.linked_animal_id) out.push({ animalId: e.animal.linked_animal_id, role: "Involved" });
    });
  }
  return out;
}

// Mirrors the corresponding dispatch_call_animals link for every animal
// record the bite report actually references, so the linkage is symmetric —
// visible from both the call and the animal record, not just the report.
// Failures here (including "already linked") never block the bite report
// save itself.
async function syncCallAnimalLinks(report: BiteReport): Promise<void> {
  if (!report.dispatch_call_id) return;
  const officer = report.investigating_officer || getCurrentUserName();
  for (const { animalId, role } of extractLinkedAnimals(report)) {
    try {
      await linkAnimalToCall({
        dispatch_call_id: report.dispatch_call_id,
        animal_id: animalId,
        role,
        notes: `Auto-linked from bite report ${report.report_number || ""}`.trim(),
        added_by: officer,
      });
    } catch (e) {
      if (!(e instanceof DuplicateCallAnimalLinkError)) {
        console.error("[syncCallAnimalLinks] failed to link animal to call:", e);
      }
    }
  }
}

async function genReportNumber(type: string): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = type === "animal_human" ? "BR-H" : "BR-A";
  const { count } = await supabase.from("bite_reports").select("*", { count: "exact", head: true }).eq("report_type", type);
  return `${prefix}-${year}-${String((count || 0) + 1).padStart(4, "0")}`;
}

export async function createBiteReport(report: BiteReport): Promise<BiteReport> {
  const report_number = await genReportNumber(report.report_type);
  const payload = nullifyEmptyBooleans(
    nullifyEmptyDates(
      { ...report, report_number, updated_at: new Date().toISOString() },
      BITE_DATE_FIELDS
    ),
    BITE_BOOL_FIELDS
  );
  const { data, error } = await supabase.from("bite_reports").insert(payload).select().single();
  if (error) throw error;
  const created = data as BiteReport;
  await syncCallAnimalLinks(created);
  return created;
}

export async function updateBiteReport(id: string, updates: Partial<BiteReport>): Promise<BiteReport> {
  const payload = nullifyEmptyBooleans(
    nullifyEmptyDates(
      { ...updates, updated_at: new Date().toISOString() },
      BITE_DATE_FIELDS
    ),
    BITE_BOOL_FIELDS
  );
  const { data, error } = await supabase.from("bite_reports").update(payload).eq("id", id).select().single();
  if (error) throw error;
  const saved = data as BiteReport;
  await syncCallAnimalLinks(saved);
  return saved;
}

export async function fetchBiteReports(opts?: { type?: string; status?: string; limit?: number; dispatchCallId?: string }): Promise<BiteReport[]> {
  let q = supabase.from("bite_reports").select("*").order("incident_date", { ascending: false });
  if (opts?.type) q = q.eq("report_type", opts.type);
  if (opts?.status) q = q.eq("status", opts.status);
  if (opts?.dispatchCallId) q = q.eq("dispatch_call_id", opts.dispatchCallId);
  if (opts?.limit) q = q.limit(opts.limit);
  const { data } = await q;
  return (data || []) as BiteReport[];
}

export async function fetchBiteReport(id: string): Promise<BiteReport | null> {
  const { data } = await supabase.from("bite_reports").select("*").eq("id", id).limit(1);
  return (data?.[0] as BiteReport) || null;
}

export async function fetchBiteReportsByAnimal(animalId: string): Promise<BiteReport[]> {
  const { data } = await supabase.from("bite_reports").select("*").eq("biting_animal_id", animalId).order("incident_date", { ascending: false });
  return (data || []) as BiteReport[];
}

export async function fetchActiveQuarantines() {
  const { data } = await supabase.from("bite_quarantines").select("*").eq("status", "Active").order("end_date");
  return data || [];
}
