"use client";
import { useState, useEffect, useMemo } from "react";
import { useAuth } from "@/app/providers";
import { useClinic } from "@/components/clinic/ClinicShell";
import { fetchClinicAppointments, createClinicAppointment, updateClinicAppointment, fetchClinicAnimals } from "@/lib/clinicData";
import type { ClinicAppointment, ClinicAnimal } from "@/lib/clinicTypes";
import { APPOINTMENT_TYPES, APPOINTMENT_STATUSES } from "@/lib/clinicTypes";
import DateInput from "@/components/ui/DateInput";
import { today } from "@/lib/utils";

function F({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="form-group"><label className="form-label">{label}</label>{children}</div>;
}

const STATUS_COLORS: Record<string, { bg: string; color: string }> = {
  Scheduled: { bg: "#dbeafe", color: "#1d4ed8" },
  Confirmed: { bg: "#dcfce7", color: "#15803d" },
  Completed: { bg: "#f0fdf4", color: "#166534" },
  "No-Show":  { bg: "#fee2e2", color: "#dc2626" },
  Cancelled:  { bg: "#f1f5f9", color: "#64748b" },
};

export default function AppointmentsPage() {
  const { user } = useAuth();
  const { selectedClientId, clients: shellClients } = useClinic();
  const [appts, setAppts] = useState<ClinicAppointment[]>([]);
  const [animals, setAnimals] = useState<ClinicAnimal[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<"list" | "calendar">("list");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterType, setFilterType] = useState("all");
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<ClinicAppointment | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<Partial<ClinicAppointment>>({});
  const [showComplete, setShowComplete] = useState<ClinicAppointment | null>(null);
  const todayStr = today();

  useEffect(() => {
    if (!user?.id) return;
    setLoading(true);
    Promise.all([
      fetchClinicAppointments(user.id, selectedClientId || undefined),
      fetchClinicAnimals(user.id, selectedClientId || undefined),
    ]).then(([a, an]) => { setAppts(a); setAnimals(an); }).finally(() => setLoading(false));
  }, [user?.id, selectedClientId]);

  const filtered = useMemo(() => {
    let list = appts;
    if (filterStatus !== "all") list = list.filter((a) => a.status === filterStatus);
    if (filterType !== "all") list = list.filter((a) => a.appointment_type === filterType);
    if (search.trim()) { const q = search.toLowerCase(); list = list.filter((a) => (a.animal_name || "").toLowerCase().includes(q)); }
    return list.sort((a, b) => (a.appointment_date || "") < (b.appointment_date || "") ? -1 : 1);
  }, [appts, filterStatus, filterType, search]);

  const upcoming = filtered.filter((a) => (a.appointment_date || "") >= todayStr && a.status !== "Cancelled");
  const past     = filtered.filter((a) => (a.appointment_date || "") < todayStr || a.status === "Completed");

  const openAdd = () => { setEditing(null); setForm({ appointment_date: todayStr, status: "Scheduled", appointment_type: "Wellness Exam", clinic_account_id: user!.id, client_id: selectedClientId || undefined }); setShowForm(true); };
  const openEdit = (a: ClinicAppointment) => { setEditing(a); setForm({ ...a }); setShowForm(true); };

  const handleSave = async () => {
    if (!form.appointment_date || !form.client_id || !user?.id) return;
    setSaving(true);
    try {
      if (editing) {
        const u = await updateClinicAppointment(editing.id, form);
        setAppts((prev) => prev.map((a) => a.id === u.id ? u : a));
      } else {
        const c = await createClinicAppointment({ ...form, clinic_account_id: user.id } as Omit<ClinicAppointment, "id" | "created_at">);
        setAppts((prev) => [c, ...prev]);
      }
      setShowForm(false);
    } catch (e: unknown) { alert(`Failed: ${(e as { message?: string }).message}`); }
    finally { setSaving(false); }
  };

  const markComplete = async (a: ClinicAppointment) => {
    const u = await updateClinicAppointment(a.id, { status: "Completed" });
    setAppts((prev) => prev.map((x) => x.id === u.id ? u : x));
    setShowComplete(a);
  };

  const clientName = (id?: string) => shellClients.find((c) => c.id === id)?.county_name || "—";

  // Simple calendar
  const calYear = new Date().getFullYear();
  const calMonth = new Date().getMonth();
  const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
  const firstDay = new Date(calYear, calMonth, 1).getDay();
  const monthLabel = new Date().toLocaleString("en-US", { month: "long", year: "numeric" });

  const ApptRow = ({ a }: { a: ClinicAppointment }) => {
    const sc = STATUS_COLORS[a.status] || STATUS_COLORS.Scheduled;
    return (
      <tr>
        <td style={{ fontSize: 12, fontWeight: 600 }}>{a.appointment_date}</td>
        <td style={{ fontSize: 12 }}>{a.appointment_time || "—"}</td>
        <td style={{ fontWeight: 600 }}><a href={`/clinic-portal/animals/${a.animal_id || "search"}`} style={{ color: "var(--teal)", textDecoration: "none" }}>{a.animal_name || "—"}</a></td>
        <td style={{ fontSize: 12 }}>{clientName(a.client_id)}</td>
        <td style={{ fontSize: 12 }}>{a.appointment_type}</td>
        <td><span className="badge" style={{ background: sc.bg, color: sc.color, fontSize: 10 }}>{a.status}</span></td>
        <td>
          <div style={{ display: "flex", gap: 4 }}>
            <button className="btn btn-ghost btn-sm" style={{ fontSize: 11 }} onClick={() => openEdit(a)}>Edit</button>
            {a.status !== "Completed" && a.status !== "Cancelled" && <button className="btn btn-ghost btn-sm" style={{ fontSize: 11, color: "#15803d" }} onClick={() => markComplete(a)}>✓ Done</button>}
          </div>
        </td>
      </tr>
    );
  };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <h1 style={{ fontSize: 20, fontWeight: 800 }}>📅 Appointments</h1>
        <div style={{ display: "flex", gap: 8 }}>
          <button className={`btn btn-sm ${view === "list" ? "btn-primary" : "btn-secondary"}`} onClick={() => setView("list")}>List</button>
          <button className={`btn btn-sm ${view === "calendar" ? "btn-primary" : "btn-secondary"}`} onClick={() => setView("calendar")}>Calendar</button>
          <button className="btn btn-primary btn-sm" onClick={openAdd}>+ New Appointment</button>
        </div>
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
        <input className="form-input" placeholder="Search animal…" value={search} onChange={(e) => setSearch(e.target.value)} style={{ maxWidth: 200 }} />
        <select className="form-select" value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} style={{ maxWidth: 130 }}>
          <option value="all">All Status</option>
          {APPOINTMENT_STATUSES.map((s) => <option key={s}>{s}</option>)}
        </select>
        <select className="form-select" value={filterType} onChange={(e) => setFilterType(e.target.value)} style={{ maxWidth: 160 }}>
          <option value="all">All Types</option>
          {APPOINTMENT_TYPES.map((t) => <option key={t}>{t}</option>)}
        </select>
      </div>

      {loading ? <div style={{ padding: 40, color: "var(--text-muted)" }}>Loading…</div> : view === "list" ? (
        <div>
          {upcoming.length > 0 && (
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontWeight: 700, fontSize: 11, textTransform: "uppercase", color: "var(--teal)", letterSpacing: 0.5, marginBottom: 6 }}>Upcoming ({upcoming.length})</div>
              <div className="card" style={{ padding: 0, overflow: "auto" }}>
                <table className="data-table"><thead><tr><th>Date</th><th>Time</th><th>Animal</th><th>Client</th><th>Type</th><th>Status</th><th></th></tr></thead>
                <tbody>{upcoming.map((a) => <ApptRow key={a.id} a={a} />)}</tbody></table>
              </div>
            </div>
          )}
          {past.length > 0 && (
            <div>
              <div style={{ fontWeight: 700, fontSize: 11, textTransform: "uppercase", color: "var(--text-muted)", letterSpacing: 0.5, marginBottom: 6 }}>Past ({past.length})</div>
              <div className="card" style={{ padding: 0, overflow: "auto", opacity: 0.75 }}>
                <table className="data-table"><thead><tr><th>Date</th><th>Time</th><th>Animal</th><th>Client</th><th>Type</th><th>Status</th><th></th></tr></thead>
                <tbody>{past.map((a) => <ApptRow key={a.id} a={a} />)}</tbody></table>
              </div>
            </div>
          )}
          {filtered.length === 0 && <div className="card" style={{ padding: 30, textAlign: "center", color: "var(--text-muted)" }}>No appointments. Click "+ New Appointment" to add one.</div>}
        </div>
      ) : (
        <div className="card" style={{ padding: 16 }}>
          <div style={{ fontWeight: 700, fontSize: 14, textAlign: "center", marginBottom: 12 }}>{monthLabel}</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 1, marginBottom: 4 }}>
            {["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].map((d) => <div key={d} style={{ textAlign: "center", fontSize: 10, fontWeight: 700, color: "var(--text-muted)", padding: 2 }}>{d}</div>)}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 2 }}>
            {Array.from({ length: firstDay }).map((_, i) => <div key={`e${i}`} />)}
            {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((day) => {
              const ds = `${calYear}-${String(calMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
              const da = appts.filter((a) => a.appointment_date === ds);
              const isT = ds === todayStr;
              return (
                <div key={day} style={{ minHeight: 56, border: `1px solid ${isT ? "var(--teal)" : "var(--border)"}`, borderRadius: 3, padding: 3, background: isT ? "#f0fdfa" : "#fff", cursor: "pointer" }}
                  onClick={() => { setForm({ appointment_date: ds, status: "Scheduled", appointment_type: "Wellness Exam", clinic_account_id: user!.id, client_id: selectedClientId || undefined }); setEditing(null); setShowForm(true); }}>
                  <div style={{ fontSize: 10, fontWeight: isT ? 800 : 400, color: isT ? "var(--teal)" : "var(--text-muted)" }}>{day}</div>
                  {da.slice(0, 2).map((a) => { const sc = STATUS_COLORS[a.status] || STATUS_COLORS.Scheduled; return <div key={a.id} style={{ fontSize: 9, background: sc.bg, color: sc.color, borderRadius: 2, padding: "1px 3px", marginTop: 1, overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }} onClick={(e) => { e.stopPropagation(); openEdit(a); }}>{a.animal_name}</div>; })}
                  {da.length > 2 && <div style={{ fontSize: 9, color: "var(--text-muted)" }}>+{da.length - 2}</div>}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {showForm && (
        <div className="modal-overlay" onClick={() => setShowForm(false)}>
          <div className="modal modal-lg" style={{ maxWidth: 540 }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header"><span className="modal-title">{editing ? "Edit Appointment" : "New Appointment"}</span><button className="btn btn-ghost btn-sm" onClick={() => setShowForm(false)}>✕</button></div>
            <div className="modal-body">
              <div className="grid-2">
                <F label="County Client *">
                  <select className="form-select" value={form.client_id || ""} onChange={(e) => setForm((f) => ({ ...f, client_id: e.target.value }))}>
                    <option value="">— Select —</option>
                    {shellClients.filter((c) => c.active).map((c) => <option key={c.id} value={c.id}>{c.county_name}</option>)}
                  </select>
                </F>
                <F label="Animal Name">
                  <input className="form-input" value={form.animal_name || ""} onChange={(e) => setForm((f) => ({ ...f, animal_name: e.target.value }))} list="al" placeholder="Type or select…" />
                  <datalist id="al">{animals.map((a) => <option key={a.id} value={a.name || ""} />)}</datalist>
                </F>
                <F label="Date *"><DateInput className="form-input" value={form.appointment_date || ""} onChange={(e) => setForm((f) => ({ ...f, appointment_date: e.target.value }))} /></F>
                <F label="Time"><input className="form-input" type="time" value={form.appointment_time || ""} onChange={(e) => setForm((f) => ({ ...f, appointment_time: e.target.value }))} /></F>
                <F label="Type">
                  <select className="form-select" value={form.appointment_type || "Wellness Exam"} onChange={(e) => setForm((f) => ({ ...f, appointment_type: e.target.value }))}>
                    {APPOINTMENT_TYPES.map((t) => <option key={t}>{t}</option>)}
                  </select>
                </F>
                <F label="Status">
                  <select className="form-select" value={form.status || "Scheduled"} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}>
                    {APPOINTMENT_STATUSES.map((s) => <option key={s}>{s}</option>)}
                  </select>
                </F>
              </div>
              <F label="Notes"><textarea className="form-textarea" rows={2} value={form.notes || ""} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} /></F>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowForm(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleSave} disabled={saving || !form.appointment_date || !form.client_id}>{saving ? "Saving…" : editing ? "Save" : "Create"}</button>
            </div>
          </div>
        </div>
      )}

      {showComplete && (
        <div className="modal-overlay" onClick={() => setShowComplete(null)}>
          <div className="modal" style={{ maxWidth: 380, textAlign: "center", padding: 24 }} onClick={(e) => e.stopPropagation()}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>✅</div>
            <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 6 }}>Appointment Completed</div>
            <div style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 14 }}>Add a record for this visit?</div>
            <div style={{ display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap" }}>
              <a href={`/clinic-portal/medical?add=1&animal=${encodeURIComponent(showComplete.animal_name || "")}&client=${showComplete.client_id || ""}`} className="btn btn-primary btn-sm" style={{ textDecoration: "none" }} onClick={() => setShowComplete(null)}>💊 Medical Record</a>
              <a href={`/clinic-portal/procedures?add=1&animal=${encodeURIComponent(showComplete.animal_name || "")}&client=${showComplete.client_id || ""}`} className="btn btn-secondary btn-sm" style={{ textDecoration: "none" }} onClick={() => setShowComplete(null)}>🔬 Procedure</a>
              <button className="btn btn-ghost btn-sm" onClick={() => setShowComplete(null)}>Skip</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
