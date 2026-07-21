"use client";
import { supabase } from "./supabase";
import type { BiteReport } from "./biteReportTypes";
import { nullifyEmptyDates } from "./sanitize";

// Top-level DATE/TIME columns in bite_reports that must never receive "".
const BITE_DATE_FIELDS = [
  "incident_date", "incident_time", "follow_up_date", "quarantine_release_date",
] as const;

async function genReportNumber(type: string): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = type === "animal_human" ? "BR-H" : "BR-A";
  const { count } = await supabase.from("bite_reports").select("*", { count: "exact", head: true }).eq("report_type", type);
  return `${prefix}-${year}-${String((count || 0) + 1).padStart(4, "0")}`;
}

export async function createBiteReport(report: BiteReport): Promise<BiteReport> {
  const report_number = await genReportNumber(report.report_type);
  const payload = nullifyEmptyDates(
    { ...report, report_number, updated_at: new Date().toISOString() },
    BITE_DATE_FIELDS
  );
  const { data, error } = await supabase.from("bite_reports").insert(payload).select().single();
  if (error) throw error;
  return data as BiteReport;
}

export async function updateBiteReport(id: string, updates: Partial<BiteReport>): Promise<BiteReport> {
  const payload = nullifyEmptyDates(
    { ...updates, updated_at: new Date().toISOString() },
    BITE_DATE_FIELDS
  );
  const { data, error } = await supabase.from("bite_reports").update(payload).eq("id", id).select().single();
  if (error) throw error;
  return data as BiteReport;
}

export async function fetchBiteReports(opts?: { type?: string; status?: string; limit?: number }): Promise<BiteReport[]> {
  let q = supabase.from("bite_reports").select("*").order("incident_date", { ascending: false });
  if (opts?.type) q = q.eq("report_type", opts.type);
  if (opts?.status) q = q.eq("status", opts.status);
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
