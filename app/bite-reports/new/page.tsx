"use client";
import { Suspense, useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import AppShell from "@/components/layout/AppShell";
import BiteReportForm from "@/components/forms/BiteReportForm";
import type { BiteReport } from "@/lib/biteReportTypes";
import { blankBiteReport } from "@/lib/biteReportTypes";
import { fetchPeopleForCall } from "@/lib/data";
import type { DispatchCallPerson } from "@/lib/types";

function NewBiteReportContent() {
  const params = useSearchParams();
  const router = useRouter();
  const type = (params.get("type") || "animal_human") as "animal_human" | "animal_animal";
  const callId = params.get("callId");

  // Pre-fill from animal record or dispatch call query params
  const basePrefill = blankBiteReport(type);
  const animalId = params.get("animalId");
  if (animalId) {
    basePrefill.biting_animal_id = animalId;
    basePrefill.biting_animal_data = {
      ...basePrefill.biting_animal_data,
      linked_animal_id: animalId,
      name: params.get("animalName") || "",
      species: params.get("species") || "",
      breed: params.get("breed") || "",
      color: params.get("color") || "",
      microchip: params.get("microchip") || "",
    };
  }
  const callAddr = params.get("address");
  if (callAddr) {
    basePrefill.incident_address = callAddr;
    basePrefill.incident_city = params.get("city") || basePrefill.incident_city;
    basePrefill.incident_date = params.get("date") || basePrefill.incident_date;
    basePrefill.investigating_officer = params.get("officer") || basePrefill.investigating_officer;
  }
  if (callId) basePrefill.dispatch_call_id = callId;

  // Pre-populate owner (from the call's Suspect) and victim (from the call's
  // Victim) sections from dispatch_call_people. If there's more than one of
  // either, the officer picks which one maps onto the report below.
  const [loadingCallPeople, setLoadingCallPeople] = useState(!!callId && type === "animal_human");
  const [suspects, setSuspects] = useState<DispatchCallPerson[]>([]);
  const [victims, setVictims] = useState<DispatchCallPerson[]>([]);
  const [selectedSuspectId, setSelectedSuspectId] = useState("");
  const [selectedVictimId, setSelectedVictimId] = useState("");
  const [prefill, setPrefill] = useState<BiteReport>(basePrefill);
  const [formKey, setFormKey] = useState(0);

  useEffect(() => {
    if (!callId || type !== "animal_human") return;
    fetchPeopleForCall(callId).then((people) => {
      const s = people.filter((p) => p.role === "Suspect" && !p.skipped);
      const v = people.filter((p) => p.role === "Victim" && !p.skipped);
      setSuspects(s);
      setVictims(v);
      const initialSuspectId = s.length > 0 ? s[0].id : "";
      const initialVictimId = v.length > 0 ? v[0].id : "";
      setSelectedSuspectId(initialSuspectId);
      setSelectedVictimId(initialVictimId);
      setPrefill((prev) => applySelections(prev, s, v, initialSuspectId, initialVictimId));
    }).catch(() => {}).finally(() => setLoadingCallPeople(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [callId, type]);

  function applySelections(base: BiteReport, s: DispatchCallPerson[], v: DispatchCallPerson[], suspectId: string, victimId: string): BiteReport {
    const suspect = s.find((p) => p.id === suspectId);
    const victim = v.find((p) => p.id === victimId);
    const next = { ...base };
    if (suspect) {
      next.owner_data = {
        ...next.owner_data,
        known: "Yes",
        linked_person_id: suspect.person_id || undefined,
        first_name: suspect.first_name || "",
        last_name: suspect.last_name || "",
        address: suspect.address || "",
        city: suspect.city || "",
        state: suspect.state || next.owner_data.state,
        zip: suspect.zip || "",
        phone: suspect.phone || "",
        dl_number: suspect.drivers_license || "",
      };
    }
    if (victim) {
      next.victim_data = {
        ...(next.victim_data as BiteReport["victim_data"]),
        first_name: victim.first_name || "",
        last_name: victim.last_name || "",
        dob: victim.dob || "",
        address: victim.address || "",
        city: victim.city || "",
        state: victim.state || (next.victim_data as { state?: string }).state || "GA",
        zip: victim.zip || "",
        phone: victim.phone || "",
      } as BiteReport["victim_data"];
    }
    return next;
  }

  const handleChangeSuspect = (id: string) => {
    setSelectedSuspectId(id);
    setPrefill((prev) => applySelections(prev, suspects, victims, id, selectedVictimId));
    setFormKey((k) => k + 1);
  };
  const handleChangeVictim = (id: string) => {
    setSelectedVictimId(id);
    setPrefill((prev) => applySelections(prev, suspects, victims, selectedSuspectId, id));
    setFormKey((k) => k + 1);
  };

  const title = type === "animal_human" ? "Animal to Human Bite Report" : "Animal to Animal Bite Report";
  const personLabel = (p: DispatchCallPerson) => [p.first_name, p.last_name].filter(Boolean).join(" ") || "Unnamed";

  if (loadingCallPeople) {
    return <AppShell title={`New ${title}`}><div style={{ padding: 40, textAlign: "center", color: "var(--text-muted)" }}>Loading call information…</div></AppShell>;
  }

  return (
    <AppShell title={`New ${title}`}>
      {(suspects.length > 1 || victims.length > 1) && (
        <div className="card" style={{ padding: "14px 16px", marginBottom: 16, background: "#f8fafc", border: "1px solid var(--border)" }}>
          <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 10 }}>This call has multiple people on file — pick who this report is about:</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            {suspects.length > 1 && (
              <div className="form-group">
                <label className="form-label">Owner (from Suspects on this call)</label>
                <select className="form-select" value={selectedSuspectId} onChange={(e) => handleChangeSuspect(e.target.value)}>
                  <option value="">— None —</option>
                  {suspects.map((s) => <option key={s.id} value={s.id}>{personLabel(s)}{s.phone ? ` · ${s.phone}` : ""}</option>)}
                </select>
              </div>
            )}
            {victims.length > 1 && (
              <div className="form-group">
                <label className="form-label">Victim (from Victims on this call)</label>
                <select className="form-select" value={selectedVictimId} onChange={(e) => handleChangeVictim(e.target.value)}>
                  <option value="">— None —</option>
                  {victims.map((v) => <option key={v.id} value={v.id}>{personLabel(v)}{v.phone ? ` · ${v.phone}` : ""}</option>)}
                </select>
              </div>
            )}
          </div>
        </div>
      )}
      <BiteReportForm
        key={formKey}
        reportType={type}
        initialData={prefill}
        onSave={(report: BiteReport) => { if (report.id) router.replace(`/bite-reports/${report.id}`); }}
        onCancel={() => router.push("/bite-reports")}
      />
    </AppShell>
  );
}

export default function NewBiteReportPage() {
  return <Suspense><NewBiteReportContent /></Suspense>;
}
