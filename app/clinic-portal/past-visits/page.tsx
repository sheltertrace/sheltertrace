"use client";
import { useState, useEffect, useMemo, useCallback } from "react";
import { useAuth } from "@/app/providers";
import { useClinic } from "@/components/clinic/ClinicShell";
import { fetchClinicAppointments, fetchClinicMedical, fetchClinicProcedures, fetchClinicSettings } from "@/lib/clinicData";
import type { ClinicAppointment, ClinicMedicalRecord, ClinicProcedure, ClinicSettings } from "@/lib/clinicTypes";
import { APPOINTMENT_TYPES } from "@/lib/clinicTypes";
import DateInput from "@/components/ui/DateInput";
import { printVisitSummary as printVisitDoc } from "@/lib/visitSummaryPrint";

function F({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="form-group" style={{ marginBottom: 0 }}><label className="form-label" style={{ marginBottom: 2 }}>{label}</label>{children}</div>;
}

function fmtDate(d?: string): string {
  if (!d) return "—";
  const [y, m, day] = d.split("-");
  return m && day ? `${m}/${day}/${y}` : d;
}

const PAGE_SIZE = 25;

export default function PastVisitsPage() {
  const { user } = useAuth();
  const { clients, selectedClientId, shelterLinks } = useClinic();
  const [appts, setAppts] = useState<ClinicAppointment[]>([]);
  const [medRecords, setMedRecords] = useState<ClinicMedicalRecord[]>([]);
  const [procedures, setProcedures] = useState<ClinicProcedure[]>([]);
  const [settings, setSettings] = useState<ClinicSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterClient, setFilterClient] = useState<string>("all");
  const [filterType, setFilterType] = useState<string>("all");
  const [filterSpecies, setFilterSpecies] = useState<string>("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [sortBy, setSortBy] = useState<"recent" | "name" | "client">("recent");
  const [page, setPage] = useState(0);
  const [detail, setDetail] = useState<ClinicAppointment | null>(null);

  useEffect(() => {
    if (!user?.id) return;
    setLoading(true);
    const cid = selectedClientId && !shelterLinks.find((l) => l.id === selectedClientId) ? selectedClientId : undefined;
    Promise.all([
      fetchClinicAppointments(user.id, cid),
      fetchClinicMedical(user.id, cid),
      fetchClinicProcedures(user.id, cid),
      fetchClinicSettings(user.id),
    ]).then(([a, m, p, s]) => {
      setAppts(a.filter((x) => x.status === "Completed"));
      setMedRecords(m);
      setProcedures(p);
      setSettings(s);
    }).finally(() => setLoading(false));
  }, [user?.id, selectedClientId, shelterLinks]);

  const clientMap = useMemo(() => {
    const m = new Map<string, string>();
    clients.forEach((c) => m.set(c.id, c.county_name));
    shelterLinks.forEach((l) => m.set(l.id, l.shelter_name || "Linked Shelter"));
    return m;
  }, [clients, shelterLinks]);

  const medByApptDate = useMemo(() => {
    const m = new Map<string, ClinicMedicalRecord[]>();
    medRecords.forEach((r) => {
      const key = `${r.animal_id}-${r.date}`;
      if (!m.has(key)) m.set(key, []);
      m.get(key)!.push(r);
    });
    return m;
  }, [medRecords]);

  const procByApptDate = useMemo(() => {
    const m = new Map<string, ClinicProcedure[]>();
    procedures.forEach((p) => {
      const key = `${p.animal_id}-${p.procedure_date}`;
      if (!m.has(key)) m.set(key, []);
      m.get(key)!.push(p);
    });
    return m;
  }, [procedures]);

  const filtered = useMemo(() => {
    let list = appts;
    if (filterClient !== "all") list = list.filter((a) => a.client_id === filterClient);
    if (filterType !== "all") list = list.filter((a) => a.appointment_type === filterType);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((a) =>
        (a.animal_name || "").toLowerCase().includes(q) ||
        (a.notes || "").toLowerCase().includes(q) ||
        (clientMap.get(a.client_id || "") || "").toLowerCase().includes(q)
      );
    }
    if (dateFrom) list = list.filter((a) => (a.appointment_date || "") >= dateFrom);
    if (dateTo) list = list.filter((a) => (a.appointment_date || "") <= dateTo);
    if (sortBy === "name") list = [...list].sort((a, b) => (a.animal_name || "").localeCompare(b.animal_name || ""));
    else if (sortBy === "client") list = [...list].sort((a, b) => (clientMap.get(a.client_id || "") || "").localeCompare(clientMap.get(b.client_id || "") || ""));
    return list;
  }, [appts, search, filterClient, filterType, filterSpecies, dateFrom, dateTo, sortBy, clientMap]);

  const paged = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);

  // Quick stats
  const todayMonth = new Date().toISOString().slice(0, 7);
  const todayYear = new Date().getFullYear().toString();
  const thisMonth = appts.filter((a) => (a.appointment_date || "").startsWith(todayMonth)).length;
  const thisYear = appts.filter((a) => (a.appointment_date || "").startsWith(todayYear)).length;

  const clearFilters = () => { setSearch(""); setFilterClient("all"); setFilterType("all"); setFilterSpecies("all"); setDateFrom(""); setDateTo(""); setPage(0); };

  const getVisitServices = (a: ClinicAppointment): string => {
    const key = `${a.animal_id}-${a.appointment_date}`;
    const meds = medByApptDate.get(key) || [];
    const procs = procByApptDate.get(key) || [];
    const items = [...meds.map((m) => m.description || m.type || "—"), ...procs.map((p) => p.procedure_type || "—")];
    return items.length > 0 ? items.slice(0, 3).join(", ") + (items.length > 3 ? ` +${items.length - 3} more` : "") : "—";
  };

  const printVisitSummary = (a: ClinicAppointment) => {
    const key = `${a.animal_id}-${a.appointment_date}`;
    const meds = medByApptDate.get(key) || [];
    const procs = procByApptDate.get(key) || [];
    const clientName = clientMap.get(a.client_id || "") || "—";
    const vetLine = settings ? [settings.vet_name, settings.vet_credentials].filter(Boolean).join(", ") : "";
    printVisitDoc({
      clinicName: settings?.clinic_name || "Veterinary Clinic",
      logoUrl: settings?.logo_url,
      vetLine,
      licenseNumber: settings?.license_number,
      addressLine: [settings?.clinic_address, settings?.clinic_phone].filter(Boolean).join(" · "),
      animalName: a.animal_name || "—",
      clientName,
      visitDate: a.appointment_date || "",
      visitType: a.appointment_type,
      notes: a.notes,
      medRecords: meds,
      procedures: procs,
    });
  };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <h1 style={{ fontSize: 20, fontWeight: 800 }}>🗂️ Past Visits</h1>
      </div>

      {/* Quick stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 10, marginBottom: 20 }}>
        {[
          { label: "This Month", value: thisMonth, icon: "📅", color: "#6366f1" },
          { label: "This Year", value: thisYear, icon: "📊", color: "#1a8a8a" },
          { label: "Total Visits", value: appts.length, icon: "🗂️", color: "#0369a1" },
        ].map((s) => (
          <div key={s.label} className="card" style={{ padding: 12, display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 20 }}>{s.icon}</span>
            <div><div style={{ fontSize: 18, fontWeight: 800, color: s.color }}>{loading ? "—" : s.value}</div><div style={{ fontSize: 10, color: "var(--text-secondary)" }}>{s.label}</div></div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="card" style={{ padding: 12, marginBottom: 16 }}>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "flex-end" }}>
          <div style={{ flex: 1, minWidth: 200 }}>
            <input className="form-input" placeholder="Search animal, client, notes…" value={search} onChange={(e) => { setSearch(e.target.value); setPage(0); }} />
          </div>
          <F label="Client">
            <select className="form-select" value={filterClient} onChange={(e) => { setFilterClient(e.target.value); setPage(0); }} style={{ minWidth: 140 }}>
              <option value="all">All Clients</option>
              {clients.filter((c) => c.active).map((c) => <option key={c.id} value={c.id}>{c.county_name}</option>)}
              {shelterLinks.map((l) => <option key={l.id} value={l.id}>🏠 {l.shelter_name}</option>)}
            </select>
          </F>
          <F label="Type">
            <select className="form-select" value={filterType} onChange={(e) => { setFilterType(e.target.value); setPage(0); }} style={{ minWidth: 120 }}>
              <option value="all">All Types</option>
              {APPOINTMENT_TYPES.map((t) => <option key={t}>{t}</option>)}
            </select>
          </F>
          <F label="From"><DateInput className="form-input" value={dateFrom} onChange={(e) => { setDateFrom(e.target.value); setPage(0); }} /></F>
          <F label="To"><DateInput className="form-input" value={dateTo} onChange={(e) => { setDateTo(e.target.value); setPage(0); }} /></F>
          <F label="Sort">
            <select className="form-select" value={sortBy} onChange={(e) => setSortBy(e.target.value as typeof sortBy)} style={{ minWidth: 120 }}>
              <option value="recent">Most Recent</option>
              <option value="name">Animal Name</option>
              <option value="client">Client</option>
            </select>
          </F>
          <button className="btn btn-ghost btn-sm" onClick={clearFilters} style={{ fontSize: 11, alignSelf: "flex-end" }}>Clear</button>
        </div>
        <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 6 }}>{filtered.length} completed visit{filtered.length !== 1 ? "s" : ""}</div>
      </div>

      {/* Visit list */}
      {loading ? <div style={{ padding: 40, color: "var(--text-muted)" }}>Loading…</div> : (
        <div className="card" style={{ padding: 0, overflow: "auto" }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Animal</th>
                <th>Client</th>
                <th>Type</th>
                <th>Services</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {paged.length === 0 ? (
                <tr><td colSpan={6} style={{ textAlign: "center", padding: 24, color: "var(--text-muted)" }}>No completed visits found{search || filterClient !== "all" || filterType !== "all" ? " — try adjusting filters" : ""}</td></tr>
              ) : paged.map((a) => (
                <tr key={a.id}>
                  <td style={{ fontSize: 12, whiteSpace: "nowrap" }}>{fmtDate(a.appointment_date)}{a.appointment_time ? ` ${a.appointment_time}` : ""}</td>
                  <td style={{ fontWeight: 600 }}>{a.animal_name || "—"}</td>
                  <td style={{ fontSize: 12 }}>{clientMap.get(a.client_id || "") || "—"}</td>
                  <td><span className="badge" style={{ background: "#ede9fe", color: "#6d28d9", fontSize: 10 }}>{a.appointment_type || "—"}</span></td>
                  <td style={{ fontSize: 12, color: "var(--text-secondary)", maxWidth: 240, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{getVisitServices(a)}</td>
                  <td>
                    <div style={{ display: "flex", gap: 4 }}>
                      <button className="btn btn-ghost btn-sm" style={{ fontSize: 11 }} onClick={() => setDetail(a)}>View</button>
                      <button className="btn btn-ghost btn-sm" style={{ fontSize: 11 }} onClick={() => printVisitSummary(a)}>🖨</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {totalPages > 1 && (
        <div style={{ display: "flex", gap: 8, marginTop: 12, justifyContent: "center", alignItems: "center" }}>
          <button className="btn btn-ghost btn-sm" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>← Prev</button>
          <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>Page {page + 1} of {totalPages}</span>
          <button className="btn btn-ghost btn-sm" disabled={page >= totalPages - 1} onClick={() => setPage((p) => p + 1)}>Next →</button>
        </div>
      )}

      {/* Detail modal */}
      {detail && (() => {
        const key = `${detail.animal_id}-${detail.appointment_date}`;
        const meds = medByApptDate.get(key) || [];
        const procs = procByApptDate.get(key) || [];
        const clientName = clientMap.get(detail.client_id || "") || "—";
        return (
          <div className="modal-overlay" onClick={() => setDetail(null)}>
            <div className="modal modal-lg" style={{ maxWidth: 640, maxHeight: "90vh", overflow: "auto" }} onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <span className="modal-title">Visit Details — {detail.animal_name || "—"}</span>
                <button className="btn btn-ghost btn-sm" onClick={() => setDetail(null)}>✕</button>
              </div>
              <div className="modal-body">
                <div className="grid-2" style={{ marginBottom: 14 }}>
                  <div><div style={{ fontSize: 10, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase" }}>Animal</div><div style={{ fontSize: 14, fontWeight: 700 }}>{detail.animal_name || "—"}</div></div>
                  <div><div style={{ fontSize: 10, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase" }}>Client</div><div style={{ fontSize: 14, fontWeight: 700 }}>{clientName}</div></div>
                  <div><div style={{ fontSize: 10, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase" }}>Date</div><div style={{ fontSize: 13 }}>{fmtDate(detail.appointment_date)}{detail.appointment_time ? ` at ${detail.appointment_time}` : ""}</div></div>
                  <div><div style={{ fontSize: 10, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase" }}>Type</div><span className="badge" style={{ background: "#ede9fe", color: "#6d28d9" }}>{detail.appointment_type || "—"}</span></div>
                </div>
                {detail.notes && <div style={{ marginBottom: 14, padding: "8px 12px", background: "#f8fafc", borderRadius: 6, fontSize: 13, color: "#374151" }}>{detail.notes}</div>}

                {meds.length > 0 && (
                  <div style={{ marginBottom: 14 }}>
                    <div style={{ fontWeight: 700, fontSize: 12, color: "var(--teal)", marginBottom: 6 }}>💊 Medical Records ({meds.length})</div>
                    {meds.map((m) => (
                      <div key={m.id} style={{ padding: "6px 10px", borderBottom: "1px solid var(--border-light)", fontSize: 12, display: "flex", justifyContent: "space-between" }}>
                        <div><span style={{ fontWeight: 600 }}>{m.type}</span> — {m.description || "—"}{m.test_result ? ` → ${m.test_result}` : ""}</div>
                        <span style={{ color: "var(--text-muted)" }}>{m.administered_by || "—"}</span>
                      </div>
                    ))}
                  </div>
                )}

                {procs.length > 0 && (
                  <div style={{ marginBottom: 14 }}>
                    <div style={{ fontWeight: 700, fontSize: 12, color: "#7c3aed", marginBottom: 6 }}>🔬 Procedures ({procs.length})</div>
                    {procs.map((p) => (
                      <div key={p.id} style={{ padding: "6px 10px", borderBottom: "1px solid var(--border-light)", fontSize: 12, display: "flex", justifyContent: "space-between" }}>
                        <div><span style={{ fontWeight: 600 }}>{p.procedure_type}</span> — {p.outcome || "Completed"}</div>
                        <span style={{ color: "var(--text-muted)" }}>{p.performed_by || "—"}</span>
                      </div>
                    ))}
                  </div>
                )}

                {meds.length === 0 && procs.length === 0 && (
                  <div style={{ color: "var(--text-muted)", textAlign: "center", padding: 16, fontSize: 13 }}>No medical records or procedures recorded for this visit.</div>
                )}
              </div>
              <div className="modal-footer">
                <button className="btn btn-secondary" onClick={() => printVisitSummary(detail)}>🖨 Print Summary</button>
                <button className="btn btn-secondary" onClick={() => setDetail(null)}>Close</button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
