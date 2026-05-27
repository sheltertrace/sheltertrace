"use client";
import { useState, useEffect, useCallback, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import AppShell from "@/components/layout/AppShell";
import AddVolunteerModal, { printBadge } from "@/components/volunteers/AddVolunteerModal";
import {
  fetchPerson, updatePerson, fetchVolunteerLogs,
  updateVolunteerSession, deleteVolunteerSession, addManualSession,
} from "@/lib/data";
import type { Person, VolunteerLog } from "@/lib/types";
import { formatDate, today } from "@/lib/utils";
import DateInput from "@/components/ui/DateInput";

const TASKS = [
  "Dog Walking","Cat Socialization","Kennel Cleaning","Administrative",
  "Photography","Transport","Training","Events","Laundry / Dishes","Other",
];

function fmt12(iso: string): string {
  const d = new Date(iso);
  let h = d.getHours(), m = d.getMinutes();
  const ap = h >= 12 ? "PM" : "AM";
  h = h % 12 || 12;
  return `${h}:${String(m).padStart(2,"0")} ${ap}`;
}

function toTimeInput(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}`;
}

function dateTimeToIso(dateStr: string, timeStr: string): string {
  return new Date(`${dateStr}T${timeStr}:00`).toISOString();
}

function getWeekStart(d = new Date()): string {
  const copy = new Date(d);
  copy.setDate(copy.getDate() - copy.getDay());
  return copy.toISOString().split("T")[0];
}

function calcStreak(sessions: VolunteerLog[]): number {
  const weeks = new Set<string>();
  sessions.forEach((l) => {
    const d = new Date(l.date + "T00:00:00");
    d.setDate(d.getDate() - d.getDay());
    weeks.add(d.toISOString().split("T")[0]);
  });
  let streak = 0;
  const cur = new Date();
  cur.setDate(cur.getDate() - cur.getDay());
  while (weeks.has(cur.toISOString().split("T")[0])) {
    streak++;
    cur.setDate(cur.getDate() - 7);
  }
  return streak;
}

// ── Edit Session Modal ───────────────────────────────────────────────────────
interface EditSessionModalProps {
  session: VolunteerLog;
  onClose: () => void;
  onSaved: (updated: VolunteerLog) => void;
}
function EditSessionModal({ session, onClose, onSaved }: EditSessionModalProps) {
  const [task, setTask] = useState(session.task);
  const [clockIn, setClockIn] = useState(toTimeInput(session.clock_in));
  const [clockOut, setClockOut] = useState(session.clock_out ? toTimeInput(session.clock_out) : "");
  const [notes, setNotes] = useState(session.notes || "");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  const handleSave = async () => {
    if (!clockIn) { setErr("Clock-in time is required."); return; }
    setSaving(true); setErr("");
    try {
      const newIn = dateTimeToIso(session.date, clockIn);
      const newOut = clockOut ? dateTimeToIso(session.date, clockOut) : undefined;
      if (newOut && newOut <= newIn) { setErr("Clock-out must be after clock-in."); setSaving(false); return; }
      const updated = await updateVolunteerSession(session.id, {
        clock_in: newIn,
        ...(newOut ? { clock_out: newOut } : {}),
        task,
        notes: notes || undefined,
      });
      onSaved(updated);
    } catch (e) { setErr(e instanceof Error ? e.message : String(e)); }
    finally { setSaving(false); }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 420 }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <span className="modal-title">Edit Session — {formatDate(session.date)}</span>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          <div className="form-group">
            <label className="form-label">Task</label>
            <select className="form-select" value={task} onChange={(e) => setTask(e.target.value)}>
              {TASKS.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Clock In</label>
              <input type="time" className="form-input" value={clockIn} onChange={(e) => setClockIn(e.target.value)} />
            </div>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Clock Out</label>
              <input type="time" className="form-input" value={clockOut} onChange={(e) => setClockOut(e.target.value)} placeholder="Still active" />
            </div>
          </div>
          <div className="form-group" style={{ marginTop: 12 }}>
            <label className="form-label">Notes</label>
            <textarea className="form-textarea" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
          {err && <div style={{ color: "#b91c1c", fontSize: 13, marginTop: 8 }}>{err}</div>}
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving}>{saving ? "Saving…" : "Save Changes"}</button>
        </div>
      </div>
    </div>
  );
}

// ── Add Manual Session Modal ─────────────────────────────────────────────────
interface AddSessionModalProps {
  person: Person;
  onClose: () => void;
  onAdded: (session: VolunteerLog) => void;
}
function AddSessionModal({ person, onClose, onAdded }: AddSessionModalProps) {
  const [date, setDate] = useState(today());
  const [task, setTask] = useState(TASKS[0]);
  const [clockIn, setClockIn] = useState("09:00");
  const [clockOut, setClockOut] = useState("12:00");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  const handleSave = async () => {
    if (!date || !clockIn || !clockOut) { setErr("Date, clock-in, and clock-out are required."); return; }
    const inIso = dateTimeToIso(date, clockIn);
    const outIso = dateTimeToIso(date, clockOut);
    if (outIso <= inIso) { setErr("Clock-out must be after clock-in."); return; }
    setSaving(true); setErr("");
    try {
      const session = await addManualSession({
        person_id: person.id,
        person_name: `${person.first_name} ${person.last_name}`,
        task, date,
        clock_in: inIso, clock_out: outIso,
        notes: notes || undefined,
      });
      onAdded(session);
    } catch (e) { setErr(e instanceof Error ? e.message : String(e)); }
    finally { setSaving(false); }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 420 }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <span className="modal-title">Add Manual Session</span>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          <div className="form-group">
            <label className="form-label">Date</label>
            <DateInput className="form-input" value={date} onChange={(e) => setDate(e.target.value)} max={today()} />
          </div>
          <div className="form-group">
            <label className="form-label">Task</label>
            <select className="form-select" value={task} onChange={(e) => setTask(e.target.value)}>
              {TASKS.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Clock In</label>
              <input type="time" className="form-input" value={clockIn} onChange={(e) => setClockIn(e.target.value)} />
            </div>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Clock Out</label>
              <input type="time" className="form-input" value={clockOut} onChange={(e) => setClockOut(e.target.value)} />
            </div>
          </div>
          <div className="form-group" style={{ marginTop: 12 }}>
            <label className="form-label">Notes</label>
            <textarea className="form-textarea" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Reason for manual entry…" />
          </div>
          {err && <div style={{ color: "#b91c1c", fontSize: 13, marginTop: 8 }}>{err}</div>}
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving}>{saving ? "Adding…" : "Add Session"}</button>
        </div>
      </div>
    </div>
  );
}

// ── Profile Page ─────────────────────────────────────────────────────────────
export default function VolunteerProfilePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [person, setPerson] = useState<Person | null>(null);
  const [sessions, setSessions] = useState<VolunteerLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [showEditProfile, setShowEditProfile] = useState(false);
  const [editingSession, setEditingSession] = useState<VolunteerLog | null>(null);
  const [showAddSession, setShowAddSession] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [filterFrom, setFilterFrom] = useState("");
  const [filterTo, setFilterTo] = useState("");
  const [sortDesc, setSortDesc] = useState(true);
  const [deactivating, setDeactivating] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [p, s] = await Promise.all([
        fetchPerson(id),
        fetchVolunteerLogs({ personId: id }),
      ]);
      setPerson(p);
      setSessions(s);
    } finally { setLoading(false); }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  // ── Computed stats ──────────────────────────────────────────────────────
  const completedSessions = useMemo(() => sessions.filter((s) => s.clock_out), [sessions]);

  const yearStart  = `${new Date().getFullYear()}-01-01`;
  const monthStart = useMemo(() => { const d = new Date(); d.setDate(1); return d.toISOString().split("T")[0]; }, []);
  const weekStart  = useMemo(() => getWeekStart(), []);

  const allHours   = useMemo(() => completedSessions.reduce((s, l) => s + (l.hours || 0), 0), [completedSessions]);
  const yearHours  = useMemo(() => completedSessions.filter((l) => l.date >= yearStart).reduce((s, l) => s + (l.hours || 0), 0), [completedSessions, yearStart]);
  const monthHours = useMemo(() => completedSessions.filter((l) => l.date >= monthStart).reduce((s, l) => s + (l.hours || 0), 0), [completedSessions, monthStart]);
  const weekHours  = useMemo(() => completedSessions.filter((l) => l.date >= weekStart).reduce((s, l) => s + (l.hours || 0), 0), [completedSessions, weekStart]);

  const daysThisMonth = useMemo(() => new Set(completedSessions.filter((l) => l.date >= monthStart).map((l) => l.date)).size, [completedSessions, monthStart]);
  const streak = useMemo(() => calcStreak(completedSessions), [completedSessions]);

  const avgPerWeek = useMemo(() => {
    if (completedSessions.length === 0) return 0;
    const first = completedSessions[completedSessions.length - 1]?.date;
    if (!first) return 0;
    const weeks = Math.max(1, Math.ceil((Date.now() - new Date(first + "T00:00:00").getTime()) / (7 * 86400000)));
    return allHours / weeks;
  }, [completedSessions, allHours]);

  // ── Filtered + sorted sessions table ────────────────────────────────────
  const filteredSessions = useMemo(() => {
    let s = [...sessions];
    if (filterFrom) s = s.filter((l) => l.date >= filterFrom);
    if (filterTo)   s = s.filter((l) => l.date <= filterTo);
    s.sort((a, b) => sortDesc
      ? b.clock_in.localeCompare(a.clock_in)
      : a.clock_in.localeCompare(b.clock_in));
    return s;
  }, [sessions, filterFrom, filterTo, sortDesc]);

  // ── Handlers ─────────────────────────────────────────────────────────────
  const handleToggleActive = async () => {
    if (!person) return;
    setDeactivating(true);
    const newRole = person.role === "Volunteer" ? "Volunteer (Inactive)" : "Volunteer";
    const updated = await updatePerson(person.id, { role: newRole });
    setPerson(updated);
    setDeactivating(false);
  };

  const handleDeleteSession = async (sessionId: string) => {
    await deleteVolunteerSession(sessionId);
    setSessions((prev) => prev.filter((s) => s.id !== sessionId));
    setDeletingId(null);
  };

  if (loading) return <AppShell title="Volunteer Profile"><div style={{ padding: 32, color: "var(--text-muted)" }}>Loading…</div></AppShell>;
  if (!person) return <AppShell title="Not Found"><div style={{ padding: 32 }}>Volunteer not found.</div></AppShell>;

  const isActive = person.role === "Volunteer";
  const initials = `${person.first_name[0]}${person.last_name[0]}`.toUpperCase();

  return (
    <AppShell title={`${person.first_name} ${person.last_name}`}>
      {/* ── Back + header ── */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
        <button className="btn btn-ghost btn-sm" onClick={() => router.push("/volunteers")}>← Volunteers</button>
        <div style={{ flex: 1 }} />
        <button className="btn btn-secondary btn-sm" onClick={() => setShowEditProfile(true)}>✏️ Edit</button>
        <button className="btn btn-secondary btn-sm" onClick={() => printBadge(person)}>🖨 Print Badge</button>
        <button
          className={`btn btn-sm ${isActive ? "btn-danger" : "btn-primary"}`}
          onClick={handleToggleActive}
          disabled={deactivating}
          style={isActive ? { background: "#dc2626", color: "#fff", border: "none" } : {}}
        >
          {deactivating ? "…" : isActive ? "🚫 Deactivate" : "✅ Reactivate"}
        </button>
      </div>

      {/* ── Name / status row ── */}
      <div style={{ display: "flex", alignItems: "center", gap: 20, marginBottom: 24 }}>
        <div style={{
          width: 72, height: 72, borderRadius: "50%",
          background: isActive ? "#1a8a8a" : "#94a3b8",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 26, fontWeight: 900, color: "#fff", flexShrink: 0,
        }}>
          {initials}
        </div>
        <div>
          <div style={{ fontSize: 26, fontWeight: 900, color: "var(--text-primary)" }}>
            {person.first_name} {person.last_name}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 4, flexWrap: "wrap" }}>
            <span style={{ fontFamily: "monospace", fontSize: 14, color: "var(--teal)", fontWeight: 700 }}>{person.pid || "No PID"}</span>
            {person.barcode_id && <span style={{ fontSize: 12, color: "var(--text-muted)", fontFamily: "monospace" }}>Barcode: {person.barcode_id}</span>}
            <span style={{
              fontSize: 12, padding: "2px 10px", borderRadius: 10, fontWeight: 700,
              background: isActive ? "#dcfce7" : "#f1f5f9",
              color: isActive ? "#15803d" : "#64748b",
            }}>
              {isActive ? "Active" : "Inactive"}
            </span>
            {person.date_added && <span style={{ fontSize: 12, color: "var(--text-muted)" }}>Joined {formatDate(person.date_added)}</span>}
          </div>
        </div>
      </div>

      {/* ── Stats row ── */}
      <div className="grid-4" style={{ marginBottom: 20 }}>
        {[
          { label: "All-Time Hours",  value: `${allHours.toFixed(1)}h`,  color: "#0ea5e9" },
          { label: "This Year",       value: `${yearHours.toFixed(1)}h`, color: "#6366f1" },
          { label: "This Month",      value: `${monthHours.toFixed(1)}h`,color: "#f59e0b" },
          { label: "This Week",       value: `${weekHours.toFixed(1)}h`, color: "#16a34a" },
        ].map(({ label, value, color }) => (
          <div key={label} className="stat-card">
            <div><div className="stat-value" style={{ color }}>{value}</div><div className="stat-label">{label}</div></div>
          </div>
        ))}
      </div>

      {/* ── Two-column: profile + secondary stats ── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 280px", gap: 16, marginBottom: 20 }}>

        {/* Contact info card */}
        <div className="card">
          <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 14 }}>Contact Information</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 }}>Contact</div>
              {person.phone
                ? <div style={{ fontSize: 13, marginBottom: 3 }}>📞 <a href={`tel:${person.phone}`} style={{ color: "var(--teal)" }}>{person.phone}</a></div>
                : <div style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 3 }}>No phone</div>}
              {person.email
                ? <div style={{ fontSize: 13, marginBottom: 3 }}>✉️ <a href={`mailto:${person.email}`} style={{ color: "var(--teal)" }}>{person.email}</a></div>
                : <div style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 3 }}>No email</div>}
              {(person.address || person.city) && (
                <div style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 4 }}>
                  📍 {[person.address, person.city, person.state, person.zip].filter(Boolean).join(", ")}
                </div>
              )}
            </div>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 }}>Emergency Contact</div>
              {person.emergency_contact_name ? (
                <>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{person.emergency_contact_name}</div>
                  <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>{person.emergency_contact_phone || "No phone"}</div>
                </>
              ) : (
                <div style={{ fontSize: 13, color: "var(--text-muted)" }}>Not on file</div>
              )}
            </div>
          </div>
        </div>

        {/* Secondary stats */}
        <div className="card">
          <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 14 }}>Activity Summary</div>
          {[
            { label: "Avg hrs / week",   value: `${avgPerWeek.toFixed(1)}h` },
            { label: "Days this month",  value: daysThisMonth },
            { label: "Week streak",      value: `${streak} wk${streak !== 1 ? "s" : ""}` },
            { label: "Total sessions",   value: completedSessions.length },
          ].map(({ label, value }) => (
            <div key={label} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid var(--border-light)", fontSize: 13 }}>
              <span style={{ color: "var(--text-secondary)" }}>{label}</span>
              <span style={{ fontWeight: 700, color: "var(--text-primary)" }}>{value}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Session History ── */}
      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <div style={{ fontWeight: 700, fontSize: 14, flex: 1 }}>
            Session History ({filteredSessions.length})
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <DateInput className="form-input" style={{ padding: "4px 8px", fontSize: 12, width: 140 }} value={filterFrom} onChange={(e) => setFilterFrom(e.target.value)} />
            <DateInput className="form-input" style={{ padding: "4px 8px", fontSize: 12, width: 140 }} value={filterTo}   onChange={(e) => setFilterTo(e.target.value)} />
            {(filterFrom || filterTo) && (
              <button className="btn btn-ghost btn-sm" onClick={() => { setFilterFrom(""); setFilterTo(""); }}>✕ Clear</button>
            )}
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => setSortDesc((p) => !p)}
              title="Toggle sort order"
            >
              {sortDesc ? "↓ Newest" : "↑ Oldest"}
            </button>
          </div>
          <button className="btn btn-primary btn-sm" onClick={() => setShowAddSession(true)}>+ Add Manual Session</button>
        </div>

        {filteredSessions.length === 0 ? (
          <div className="empty-state">No sessions match the selected filter</div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Task</th>
                <th>Clock In</th>
                <th>Clock Out</th>
                <th style={{ textAlign: "right" }}>Hours</th>
                <th>Flags</th>
                <th style={{ textAlign: "center" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredSessions.map((s) => {
                const needsReview = (s.hours || 0) > 12;
                const isDeleting  = deletingId === s.id;
                return (
                  <tr key={s.id} style={{ background: needsReview ? "#fffbeb" : undefined }}>
                    <td style={{ fontWeight: 600, whiteSpace: "nowrap" }}>{formatDate(s.date)}</td>
                    <td style={{ fontSize: 13 }}>{s.task}</td>
                    <td style={{ fontSize: 13, fontFamily: "monospace", whiteSpace: "nowrap" }}>{fmt12(s.clock_in)}</td>
                    <td style={{ fontSize: 13, fontFamily: "monospace", whiteSpace: "nowrap" }}>
                      {s.clock_out ? fmt12(s.clock_out) : <span style={{ color: "#16a34a", fontWeight: 600 }}>Active</span>}
                    </td>
                    <td style={{ textAlign: "right", fontWeight: 700, color: s.hours ? "var(--teal)" : "var(--text-muted)" }}>
                      {s.hours != null ? `${s.hours.toFixed(2)}h` : "—"}
                    </td>
                    <td style={{ fontSize: 11 }}>
                      <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                        {needsReview  && <span style={{ background: "#fef9c3", color: "#b45309", padding: "1px 6px", borderRadius: 8, fontWeight: 600 }}>⚠ 12h+</span>}
                        {s.manually_edited && <span style={{ background: "#eff6ff", color: "#3b82f6", padding: "1px 6px", borderRadius: 8, fontWeight: 600 }}>Edited</span>}
                        {s.is_manual      && <span style={{ background: "#f5f3ff", color: "#7c3aed", padding: "1px 6px", borderRadius: 8, fontWeight: 600 }}>Manual</span>}
                      </div>
                    </td>
                    <td>
                      {isDeleting ? (
                        <div style={{ display: "flex", gap: 4, justifyContent: "center" }}>
                          <button className="btn btn-sm" style={{ background: "#dc2626", color: "#fff", border: "none", fontSize: 12, padding: "3px 10px", borderRadius: 6, cursor: "pointer" }} onClick={() => handleDeleteSession(s.id)}>Confirm Delete</button>
                          <button className="btn btn-ghost btn-sm" onClick={() => setDeletingId(null)}>Cancel</button>
                        </div>
                      ) : (
                        <div style={{ display: "flex", gap: 4, justifyContent: "center" }}>
                          <button className="btn btn-ghost btn-sm" title="Edit" onClick={() => setEditingSession(s)}>✏️</button>
                          <button className="btn btn-ghost btn-sm" title="Delete" onClick={() => setDeletingId(s.id)} style={{ color: "#ef4444" }}>🗑</button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* ── Modals ── */}
      {showEditProfile && (
        <AddVolunteerModal
          editPerson={person}
          onClose={() => setShowEditProfile(false)}
          onSaved={(updated) => { setPerson(updated); setShowEditProfile(false); }}
        />
      )}

      {editingSession && (
        <EditSessionModal
          session={editingSession}
          onClose={() => setEditingSession(null)}
          onSaved={(updated) => {
            setSessions((prev) => prev.map((s) => s.id === updated.id ? updated : s));
            setEditingSession(null);
          }}
        />
      )}

      {showAddSession && (
        <AddSessionModal
          person={person}
          onClose={() => setShowAddSession(false)}
          onAdded={(s) => {
            setSessions((prev) => [s, ...prev]);
            setShowAddSession(false);
          }}
        />
      )}
    </AppShell>
  );
}
