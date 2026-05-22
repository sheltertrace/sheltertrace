"use client";

import { useState, useEffect, useCallback } from "react";
import AppShell from "@/components/layout/AppShell";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import {
  fetchSchedules,
  fetchOverrides,
  fetchOnCallShifts,
  upsertScheduleDays,
  upsertOverride,
  deleteOverride,
  copySchedule,
  fmt12,
  localDateStr,
  DAY_LABELS,
} from "@/lib/schedules";
import type { OfficerSchedule, ScheduleOverride } from "@/lib/types";

interface StaffRow { id: string; first_name: string; last_name: string; role: string; badge?: string; phone?: string }

function fullName(s: StaffRow) { return `${s.first_name || ""} ${s.last_name || ""}`.trim(); }

// ── Shift type config ─────────────────────────────────────────────────────────

const SHIFT_TYPES = ["On-Call", "Weekend Duty", "Holiday Coverage", "Emergency"] as const;
type ShiftType = typeof SHIFT_TYPES[number];

const SHIFT_STYLE: Record<ShiftType, { bg: string; color: string; border: string }> = {
  "On-Call":          { bg: "#fef3c7", color: "#92400e", border: "#fbbf24" },
  "Weekend Duty":     { bg: "#f0fdfa", color: "#0d9488", border: "#5eead4" },
  "Holiday Coverage": { bg: "#fee2e2", color: "#b91c1c", border: "#fca5a5" },
  "Emergency":        { bg: "#faf5ff", color: "#7c3aed", border: "#c4b5fd" },
};

function shiftStyle(t?: string) {
  return SHIFT_STYLE[(t as ShiftType) ?? "On-Call"] ?? SHIFT_STYLE["On-Call"];
}

function shiftBadge(t?: string) {
  const s = shiftStyle(t);
  return (
    <span style={{ padding: "2px 8px", borderRadius: 12, fontSize: 11, fontWeight: 700, background: s.bg, color: s.color, border: `1px solid ${s.border}`, whiteSpace: "nowrap" }}>
      {t ?? "On-Call"}
    </span>
  );
}

// ── Date helpers ──────────────────────────────────────────────────────────────

function addDays(dateStr: string, n: number): string {
  const d = new Date(`${dateStr}T12:00:00`);
  d.setDate(d.getDate() + n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function displayDate(dateStr: string) {
  return new Date(`${dateStr}T12:00:00`).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

function nextSameDow(dateStr: string) {
  // Returns same day-of-week next week
  return addDays(dateStr, 7);
}

// ── Monthly calendar ──────────────────────────────────────────────────────────

function buildCalendarCells(year: number, month: number): Array<string | null> {
  const firstDow = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: Array<string | null> = Array(firstDow).fill(null);
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push(
      `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`
    );
  }
  // Pad to full weeks
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

// ── Schedule grid cell ────────────────────────────────────────────────────────

interface CellState { is_scheduled: boolean; start_time: string; end_time: string }

function ScheduleCell({ cell, onChange }: { cell: CellState; onChange: (c: CellState) => void }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(cell);

  function toggle() {
    if (!cell.is_scheduled) { setEditing(true); setDraft({ is_scheduled: true, start_time: cell.start_time || "08:00", end_time: cell.end_time || "17:00" }); }
    else onChange({ ...cell, is_scheduled: false });
  }

  function save() { onChange(draft); setEditing(false); }

  if (editing) {
    return (
      <td style={{ padding: "4px 6px", minWidth: 130 }}>
        <div style={{ background: "#f0f9ff", border: "1px solid #0ea5e9", borderRadius: 6, padding: "6px 8px" }}>
          <div style={{ display: "flex", gap: 4, marginBottom: 4 }}>
            <input type="time" value={draft.start_time} onChange={(e) => setDraft((d) => ({ ...d, start_time: e.target.value }))}
              style={{ flex: 1, border: "1px solid #ccc", borderRadius: 4, padding: "2px 4px", fontSize: 11 }} />
            <span style={{ fontSize: 11, alignSelf: "center" }}>–</span>
            <input type="time" value={draft.end_time} onChange={(e) => setDraft((d) => ({ ...d, end_time: e.target.value }))}
              style={{ flex: 1, border: "1px solid #ccc", borderRadius: 4, padding: "2px 4px", fontSize: 11 }} />
          </div>
          <div style={{ display: "flex", gap: 4 }}>
            <button onClick={save} style={{ flex: 1, background: "#0ea5e9", color: "#fff", border: "none", borderRadius: 4, padding: "3px 0", fontSize: 11, cursor: "pointer" }}>Save</button>
            <button onClick={() => setEditing(false)} style={{ flex: 1, background: "#e5e7eb", border: "none", borderRadius: 4, padding: "3px 0", fontSize: 11, cursor: "pointer" }}>Cancel</button>
          </div>
        </div>
      </td>
    );
  }

  return (
    <td style={{ padding: "4px 6px", textAlign: "center", cursor: "pointer" }} onClick={() => cell.is_scheduled ? setEditing(true) : toggle()}>
      {cell.is_scheduled ? (
        <div style={{ background: "#dbeafe", border: "1px solid #3b82f6", borderRadius: 6, padding: "4px 6px" }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: "#1d4ed8" }}>✓ ON</div>
          <div style={{ fontSize: 10, color: "#1e40af" }}>{fmt12(cell.start_time)}–{fmt12(cell.end_time)}</div>
          <button
            onClick={(e) => { e.stopPropagation(); onChange({ ...cell, is_scheduled: false }); }}
            style={{ background: "none", border: "none", color: "#6b7280", fontSize: 10, cursor: "pointer", marginTop: 2 }}
          >✕ remove</button>
        </div>
      ) : (
        <div style={{ border: "1px dashed #d1d5db", borderRadius: 6, padding: "6px 4px", color: "#9ca3af", fontSize: 10 }}>
          Off<br /><span style={{ fontSize: 9 }}>click to schedule</span>
        </div>
      )}
    </td>
  );
}

// ── Override form ─────────────────────────────────────────────────────────────

function OverrideForm({ officers, onSaved }: { officers: StaffRow[]; onSaved: () => void }) {
  const [officerId, setOfficerId] = useState("");
  const [date, setDate] = useState(localDateStr());
  const [isWorking, setIsWorking] = useState(false);
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (!officerId || !date) return;
    setSaving(true);
    const officer = officers.find((o) => o.id === officerId);
    await upsertOverride({
      officer_id: officerId,
      officer_name: officer ? fullName(officer) : undefined,
      override_date: date,
      is_working: isWorking,
      start_time: startTime || null,
      end_time: endTime || null,
      reason: reason || undefined,
    });
    setSaving(false);
    setOfficerId(""); setDate(localDateStr()); setIsWorking(false); setStartTime(""); setEndTime(""); setReason("");
    onSaved();
  }

  return (
    <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 8, padding: "16px 18px", marginBottom: 20 }}>
      <div style={{ fontWeight: 700, fontSize: 13, color: "#0f2942", marginBottom: 12 }}>Add / Edit Override</div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
        <div>
          <label style={{ fontSize: 12, fontWeight: 600, color: "#555", display: "block", marginBottom: 3 }}>Officer</label>
          <select value={officerId} onChange={(e) => setOfficerId(e.target.value)}
            style={{ width: "100%", border: "1px solid #d1d5db", borderRadius: 6, padding: "7px 10px", fontSize: 13 }}>
            <option value="">Select officer…</option>
            {officers.map((o) => <option key={o.id} value={o.id}>{fullName(o)}</option>)}
          </select>
        </div>
        <div>
          <label style={{ fontSize: 12, fontWeight: 600, color: "#555", display: "block", marginBottom: 3 }}>Date</label>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)}
            style={{ width: "100%", border: "1px solid #d1d5db", borderRadius: 6, padding: "7px 10px", fontSize: 13, boxSizing: "border-box" }} />
        </div>
      </div>
      <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 10 }}>
        <label style={{ fontSize: 13, fontWeight: 600, color: "#0f2942" }}>Status on this date:</label>
        <button onClick={() => setIsWorking(false)}
          style={{ background: !isWorking ? "#fee2e2" : "#f3f4f6", color: !isWorking ? "#b91c1c" : "#6b7280", border: `2px solid ${!isWorking ? "#ef4444" : "#d1d5db"}`, borderRadius: 6, padding: "5px 14px", fontWeight: 700, fontSize: 12, cursor: "pointer" }}>
          Off (Vacation / Sick / Training)
        </button>
        <button onClick={() => setIsWorking(true)}
          style={{ background: isWorking ? "#fef3c7" : "#f3f4f6", color: isWorking ? "#92400e" : "#6b7280", border: `2px solid ${isWorking ? "#f59e0b" : "#d1d5db"}`, borderRadius: 6, padding: "5px 14px", fontWeight: 700, fontSize: 12, cursor: "pointer" }}>
          On (Coverage / Extra Shift)
        </button>
      </div>
      {isWorking && (
        <div style={{ display: "flex", gap: 10, marginBottom: 10 }}>
          <div style={{ flex: 1 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: "#555", display: "block", marginBottom: 3 }}>Start time (optional)</label>
            <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)}
              style={{ width: "100%", border: "1px solid #d1d5db", borderRadius: 6, padding: "7px 10px", fontSize: 13, boxSizing: "border-box" }} />
          </div>
          <div style={{ flex: 1 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: "#555", display: "block", marginBottom: 3 }}>End time (optional)</label>
            <input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)}
              style={{ width: "100%", border: "1px solid #d1d5db", borderRadius: 6, padding: "7px 10px", fontSize: 13, boxSizing: "border-box" }} />
          </div>
        </div>
      )}
      <div style={{ marginBottom: 12 }}>
        <label style={{ fontSize: 12, fontWeight: 600, color: "#555", display: "block", marginBottom: 3 }}>Reason / Notes</label>
        <input type="text" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Vacation, Sick, Training at POST, Covering for Casey…"
          style={{ width: "100%", border: "1px solid #d1d5db", borderRadius: 6, padding: "7px 10px", fontSize: 13, boxSizing: "border-box" }} />
      </div>
      <button onClick={handleSave} disabled={!officerId || !date || saving}
        style={{ background: saving || !officerId ? "#9ca3af" : "#0f2942", color: "#fff", border: "none", borderRadius: 6, padding: "8px 20px", fontWeight: 700, fontSize: 13, cursor: officerId && !saving ? "pointer" : "not-allowed" }}>
        {saving ? "Saving…" : "Save Override"}
      </button>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

type Tab = "schedules" | "overrides" | "oncall";

export default function SchedulesPage() {
  const [tab, setTab] = useState<Tab>("schedules");
  const [officers, setOfficers] = useState<StaffRow[]>([]);
  const [schedules, setSchedules] = useState<OfficerSchedule[]>([]);
  const [overrides, setOverrides] = useState<ScheduleOverride[]>([]);
  const [onCallShifts, setOnCallShifts] = useState<ScheduleOverride[]>([]);
  const [loading, setLoading] = useState(true);
  const [saveMsg, setSaveMsg] = useState("");
  const [saveError, setSaveError] = useState("");
  const [saving, setSaving] = useState(false);

  // Weekly schedule cells: officerId → day → CellState
  const [cells, setCells] = useState<Record<string, Record<number, CellState>>>({});

  // Copy schedule
  const [copyFrom, setCopyFrom] = useState("");
  const [copyTo, setCopyTo] = useState("");
  const [copying, setCopying] = useState(false);

  // On-Call form state
  const [ocOfficerId, setOcOfficerId] = useState("");
  const [ocDate, setOcDate] = useState(localDateStr());
  const [ocStartTime, setOcStartTime] = useState("17:00");
  const [ocEndTime, setOcEndTime] = useState("08:00");
  const [ocShiftType, setOcShiftType] = useState<ShiftType>("On-Call");
  const [ocNotes, setOcNotes] = useState("");
  const [ocSaving, setOcSaving] = useState(false);
  const [ocMsg, setOcMsg] = useState("");
  const [ocError, setOcError] = useState("");

  // Calendar navigation
  const now = new Date();
  const [calYear, setCalYear] = useState(now.getFullYear());
  const [calMonth, setCalMonth] = useState(now.getMonth());

  const todayStr = localDateStr();

  const loadOnCall = useCallback(async () => {
    const from = new Date();
    from.setDate(from.getDate() - 1);
    const to = new Date();
    to.setDate(to.getDate() + 90);
    const fmt = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    const shifts = await fetchOnCallShifts({ from: fmt(from), to: fmt(to) });
    setOnCallShifts(shifts);
  }, []);

  const load = useCallback(async () => {
    const [staffResult, sched, ovr] = await Promise.all([
      supabase.from("staff_accounts").select("*").eq("active", true).neq("role", "Volunteer").order("last_name"),
      fetchSchedules(),
      fetchOverrides({ from: todayStr }),
    ]);
    const { data: staffData, error: staffErr } = staffResult;
    console.log("[on-call] staff query result:", staffData, staffErr);
    if (staffErr) console.error("[schedules load] staff error:", staffErr.message, staffErr.details);
    const staff = (staffData as StaffRow[] | null) ?? [];
    setOfficers(staff);
    setSchedules(sched);
    setOverrides(ovr);

    const initial: Record<string, Record<number, CellState>> = {};
    for (const o of staff) {
      initial[o.id] = {};
      for (let d = 0; d < 7; d++) {
        const row = sched.find((s) => s.officer_id === o.id && s.day_of_week === d);
        initial[o.id][d] = {
          is_scheduled: row?.is_scheduled ?? false,
          start_time: row?.start_time ?? "08:00",
          end_time: row?.end_time ?? "17:00",
        };
      }
    }
    setCells(initial);
    setLoading(false);
    await loadOnCall();
  }, [todayStr, loadOnCall]);

  useEffect(() => { load(); }, [load]);

  function updateCell(officerId: string, day: number, cell: CellState) {
    setCells((prev) => ({ ...prev, [officerId]: { ...prev[officerId], [day]: cell } }));
  }

  async function handleSaveAll() {
    setSaving(true);
    setSaveMsg("");
    setSaveError("");
    const rows: Omit<OfficerSchedule, "id" | "created_at" | "updated_at">[] = [];
    for (const [officerId, days] of Object.entries(cells)) {
      for (const [dayStr, cell] of Object.entries(days)) {
        rows.push({
          officer_id: officerId,
          day_of_week: parseInt(dayStr),
          is_scheduled: cell.is_scheduled,
          start_time: cell.is_scheduled ? (cell.start_time || null) : null,
          end_time: cell.is_scheduled ? (cell.end_time || null) : null,
        });
      }
    }
    try {
      await upsertScheduleDays(rows);
      setSaveMsg("Schedule saved.");
      setTimeout(() => setSaveMsg(""), 5000);
    } catch (err: unknown) {
      const msg = (err as { message?: string })?.message ?? "Save failed — check console for details.";
      setSaveError(msg);
      console.error("[handleSaveAll] error:", err);
    } finally {
      setSaving(false);
    }
  }

  async function handleCopy() {
    if (!copyFrom || !copyTo || copyFrom === copyTo) return;
    setCopying(true);
    await copySchedule(copyFrom, copyTo);
    await load();
    setCopying(false);
    setCopyFrom(""); setCopyTo("");
    setSaveMsg("Schedule copied.");
    setTimeout(() => setSaveMsg(""), 3000);
  }

  // ── On-Call save ────────────────────────────────────────────────────────────

  async function handleSaveOnCall() {
    if (!ocOfficerId || !ocDate) return;
    setOcSaving(true);
    setOcMsg("");
    setOcError("");
    try {
      const officer = officers.find((o) => o.id === ocOfficerId);
      await upsertOverride({
        officer_id: ocOfficerId,
        officer_name: officer ? fullName(officer) : undefined,
        override_date: ocDate,
        is_working: true,
        start_time: ocStartTime || null,
        end_time: ocEndTime || null,
        reason: ocNotes || undefined,
        shift_type: ocShiftType,
      });
      await loadOnCall();
      setOcOfficerId("");
      setOcDate(localDateStr());
      setOcStartTime("17:00");
      setOcEndTime("08:00");
      setOcShiftType("On-Call");
      setOcNotes("");
      setOcMsg("On-call shift saved.");
      setTimeout(() => setOcMsg(""), 4000);
    } catch (err: unknown) {
      setOcError((err as { message?: string })?.message ?? "Save failed.");
    } finally {
      setOcSaving(false);
    }
  }

  async function handleDeleteOnCall(id: string) {
    await deleteOverride(id);
    await loadOnCall();
  }

  async function handleCopyToNextWeek(ov: ScheduleOverride) {
    const nextDate = nextSameDow(ov.override_date);
    await upsertOverride({
      officer_id: ov.officer_id,
      officer_name: ov.officer_name,
      override_date: nextDate,
      is_working: true,
      start_time: ov.start_time ?? null,
      end_time: ov.end_time ?? null,
      reason: ov.reason,
      shift_type: ov.shift_type,
    });
    await loadOnCall();
  }

  function prefillFromCalendar(dateStr: string) {
    setOcDate(dateStr);
    const d = new Date(`${dateStr}T12:00:00`).getDay();
    if (d === 0 || d === 6) setOcShiftType("Weekend Duty");
    document.getElementById("oncall-officer")?.focus();
  }

  // Calendar data
  const calCells = buildCalendarCells(calYear, calMonth);
  const calMonthLabel = new Date(calYear, calMonth, 1).toLocaleDateString("en-US", { month: "long", year: "numeric" });
  const upcomingOnCall = onCallShifts.filter((s) => s.override_date >= todayStr).slice(0, 30);

  // Shifts indexed by date for calendar lookup
  const shiftsByDate: Record<string, ScheduleOverride[]> = {};
  for (const s of onCallShifts) {
    if (!shiftsByDate[s.override_date]) shiftsByDate[s.override_date] = [];
    shiftsByDate[s.override_date].push(s);
  }

  const today = todayStr;
  const upcoming = overrides.filter((o) => o.override_date >= today).sort((a, b) => a.override_date.localeCompare(b.override_date));

  return (
    <AppShell
      title="Officer Schedules"
      action={
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          {tab === "schedules" && !loading && (
            <>
              {saveMsg   && <span style={{ color: "#16a34a", fontWeight: 700, fontSize: 13 }}>✓ {saveMsg}</span>}
              {saveError && <span style={{ color: "#dc2626", fontWeight: 600, fontSize: 13 }} title={saveError}>⚠ Save failed</span>}
              <button
                onClick={handleSaveAll}
                disabled={saving}
                style={{
                  background: saving ? "#9ca3af" : "#1a8a8a",
                  color: "#fff", border: "none", borderRadius: 6,
                  padding: "8px 20px", fontWeight: 700, fontSize: 14,
                  cursor: saving ? "not-allowed" : "pointer",
                }}
              >
                {saving ? "Saving…" : "💾 Save Schedule"}
              </button>
            </>
          )}
          <Link href="/field-ops" style={{ fontSize: 13, color: "#1a8a8a", textDecoration: "none", fontWeight: 600 }}>
            ← Back to Field Ops
          </Link>
        </div>
      }
    >
      <div style={{ padding: "24px", maxWidth: 1200, margin: "0 auto" }}>

        {/* Tabs */}
        <div style={{ display: "flex", gap: 0, marginBottom: 24, borderBottom: "2px solid #e2e8f0" }}>
          {([
            ["schedules", "📅 Weekly Schedules"],
            ["overrides", "📌 Date Overrides"],
            ["oncall",    "📞 On-Call Schedule"],
          ] as [Tab, string][]).map(([t, label]) => (
            <button key={t} onClick={() => setTab(t)} style={{
              background: "none", border: "none", padding: "10px 22px", fontWeight: 700, fontSize: 14, cursor: "pointer",
              color: tab === t ? "#0f2942" : "#6b7280",
              borderBottom: tab === t ? "2px solid #0f2942" : "2px solid transparent",
              marginBottom: -2,
            }}>
              {label}
            </button>
          ))}
        </div>

        {loading ? (
          <p style={{ color: "#888" }}>Loading…</p>
        ) : tab === "schedules" ? (
          <>
            <div style={{ display: "flex", gap: 16, marginBottom: 16, flexWrap: "wrap" }}>
              <span style={{ fontSize: 12, color: "#555" }}>
                <span style={{ background: "#dbeafe", border: "1px solid #3b82f6", borderRadius: 4, padding: "2px 8px", marginRight: 4 }}>Blue</span>
                = Scheduled
              </span>
              <span style={{ fontSize: 12, color: "#555" }}>
                <span style={{ border: "1px dashed #d1d5db", borderRadius: 4, padding: "2px 8px", marginRight: 4, color: "#9ca3af" }}>Dashed</span>
                = Off / click to schedule
              </span>
              <span style={{ fontSize: 12, color: "#888" }}>Click any cell to set times · Click ✕ to remove</span>
            </div>

            <div style={{ overflowX: "auto", marginBottom: 20 }}>
              <table style={{ borderCollapse: "collapse", fontSize: 13, minWidth: 900 }}>
                <thead>
                  <tr style={{ background: "#f0f4f8" }}>
                    <th style={{ padding: "10px 14px", textAlign: "left", fontWeight: 700, color: "#0f2942", borderBottom: "2px solid #ddd", minWidth: 180 }}>Officer</th>
                    {DAY_LABELS.map((d) => (
                      <th key={d} style={{ padding: "10px 8px", textAlign: "center", fontWeight: 700, color: "#0f2942", borderBottom: "2px solid #ddd", minWidth: 120 }}>{d}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {officers.map((o) => (
                    <tr key={o.id} style={{ borderBottom: "1px solid #eee" }}>
                      <td style={{ padding: "10px 14px", fontWeight: 600, verticalAlign: "top" }}>
                        <div>{fullName(o)}</div>
                        <div style={{ fontSize: 11, color: "#888" }}>{o.role}{o.badge ? ` · #${o.badge}` : ""}</div>
                      </td>
                      {Array.from({ length: 7 }, (_, d) => (
                        <ScheduleCell
                          key={d}
                          cell={cells[o.id]?.[d] ?? { is_scheduled: false, start_time: "08:00", end_time: "17:00" }}
                          onChange={(c) => updateCell(o.id, d, c)}
                        />
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div style={{ display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap", marginBottom: 24 }}>
              <button onClick={handleSaveAll} disabled={saving}
                style={{ background: saving ? "#9ca3af" : "#1a8a8a", color: "#fff", border: "none", borderRadius: 6, padding: "10px 24px", fontWeight: 700, fontSize: 14, cursor: saving ? "not-allowed" : "pointer" }}>
                {saving ? "Saving…" : "💾 Save Schedule"}
              </button>
              {saveMsg   && <span style={{ color: "#16a34a", fontWeight: 700, fontSize: 13 }}>✓ {saveMsg}</span>}
              {saveError && <span style={{ color: "#dc2626", fontWeight: 600, fontSize: 13 }}>⚠ {saveError}</span>}
            </div>

            <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 8, padding: "14px 18px" }}>
              <div style={{ fontWeight: 700, fontSize: 13, color: "#0f2942", marginBottom: 10 }}>Copy Schedule</div>
              <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                <select value={copyFrom} onChange={(e) => setCopyFrom(e.target.value)}
                  style={{ border: "1px solid #d1d5db", borderRadius: 6, padding: "7px 10px", fontSize: 13 }}>
                  <option value="">Copy from…</option>
                  {officers.map((o) => <option key={o.id} value={o.id}>{fullName(o)}</option>)}
                </select>
                <span style={{ color: "#888", fontSize: 18 }}>→</span>
                <select value={copyTo} onChange={(e) => setCopyTo(e.target.value)}
                  style={{ border: "1px solid #d1d5db", borderRadius: 6, padding: "7px 10px", fontSize: 13 }}>
                  <option value="">Copy to…</option>
                  {officers.filter((o) => o.id !== copyFrom).map((o) => <option key={o.id} value={o.id}>{fullName(o)}</option>)}
                </select>
                <button onClick={handleCopy} disabled={!copyFrom || !copyTo || copyFrom === copyTo || copying}
                  style={{ background: copyFrom && copyTo && copyFrom !== copyTo ? "#0f2942" : "#9ca3af", color: "#fff", border: "none", borderRadius: 6, padding: "8px 16px", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>
                  {copying ? "Copying…" : "Copy"}
                </button>
                <span style={{ fontSize: 12, color: "#888" }}>Overwrites the target officer&apos;s entire weekly schedule.</span>
              </div>
            </div>
          </>

        ) : tab === "overrides" ? (
          <>
            <OverrideForm officers={officers} onSaved={load} />
            <h3 style={{ fontSize: 14, fontWeight: 700, color: "#0f2942", marginBottom: 12 }}>
              Upcoming Overrides ({upcoming.length})
            </h3>
            {upcoming.length === 0 ? (
              <p style={{ color: "#888", fontSize: 13 }}>No upcoming overrides.</p>
            ) : (
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr style={{ background: "#f0f4f8" }}>
                    {["Date", "Officer", "Status", "Times", "Reason", ""].map((h) => (
                      <th key={h} style={{ padding: "8px 12px", textAlign: "left", fontWeight: 700, color: "#0f2942", borderBottom: "2px solid #ddd" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {upcoming.map((ov) => {
                    const officer = officers.find((o) => o.id === ov.officer_id);
                    return (
                      <tr key={ov.id} style={{ borderBottom: "1px solid #eee" }}>
                        <td style={{ padding: "8px 12px", fontWeight: 600 }}>{ov.override_date}</td>
                        <td style={{ padding: "8px 12px" }}>{officer ? fullName(officer) : ov.officer_id}</td>
                        <td style={{ padding: "8px 12px" }}>
                          <span style={{ background: ov.is_working ? "#fef3c7" : "#fee2e2", color: ov.is_working ? "#92400e" : "#b91c1c", borderRadius: 12, padding: "2px 10px", fontWeight: 700, fontSize: 12 }}>
                            {ov.is_working ? "Working (Override)" : "Off (Override)"}
                          </span>
                        </td>
                        <td style={{ padding: "8px 12px", color: "#555" }}>
                          {ov.start_time && ov.end_time ? `${fmt12(ov.start_time)} – ${fmt12(ov.end_time)}` : "—"}
                        </td>
                        <td style={{ padding: "8px 12px", color: "#555" }}>{ov.reason || "—"}</td>
                        <td style={{ padding: "8px 12px" }}>
                          <button onClick={async () => { if (!ov.id) return; await deleteOverride(ov.id); load(); }}
                            style={{ background: "#fee2e2", color: "#b91c1c", border: "none", borderRadius: 5, padding: "4px 10px", fontSize: 12, cursor: "pointer", fontWeight: 600 }}>
                            Delete
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </>

        ) : (
          /* ── On-Call tab ── */
          <div style={{ display: "grid", gridTemplateColumns: "360px 1fr", gap: 28, alignItems: "start" }}>

            {/* Left: Add form + upcoming list */}
            <div>
              {/* Add On-Call Shift form */}
              <div style={{ background: "#fff", border: "2px solid #f59e0b", borderRadius: 12, padding: "18px 20px", marginBottom: 24 }}>
                <div style={{ fontSize: 15, fontWeight: 800, color: "#0f2942", marginBottom: 14 }}>📞 Add On-Call Shift</div>

                <div style={{ marginBottom: 10 }}>
                  <label style={{ fontSize: 12, fontWeight: 600, color: "#555", display: "block", marginBottom: 3 }}>Officer</label>
                  <select
                    id="oncall-officer"
                    value={ocOfficerId}
                    onChange={(e) => setOcOfficerId(e.target.value)}
                    style={{ width: "100%", border: "1px solid #d1d5db", borderRadius: 6, padding: "8px 10px", fontSize: 13, boxSizing: "border-box" }}
                  >
                    <option value="">Select officer…</option>
                    {officers.map((o) => <option key={o.id} value={o.id}>{fullName(o)}{o.phone ? ` · ${o.phone}` : ""}</option>)}
                  </select>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, color: "#555", display: "block", marginBottom: 3 }}>Date</label>
                    <input type="date" value={ocDate} onChange={(e) => setOcDate(e.target.value)}
                      style={{ width: "100%", border: "1px solid #d1d5db", borderRadius: 6, padding: "8px 10px", fontSize: 13, boxSizing: "border-box" }} />
                  </div>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, color: "#555", display: "block", marginBottom: 3 }}>Shift Type</label>
                    <select value={ocShiftType} onChange={(e) => setOcShiftType(e.target.value as ShiftType)}
                      style={{ width: "100%", border: "1px solid #d1d5db", borderRadius: 6, padding: "8px 10px", fontSize: 13 }}>
                      {SHIFT_TYPES.map((t) => <option key={t}>{t}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, color: "#555", display: "block", marginBottom: 3 }}>Start Time</label>
                    <input type="time" value={ocStartTime} onChange={(e) => setOcStartTime(e.target.value)}
                      style={{ width: "100%", border: "1px solid #d1d5db", borderRadius: 6, padding: "8px 10px", fontSize: 13, boxSizing: "border-box" }} />
                  </div>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, color: "#555", display: "block", marginBottom: 3 }}>End Time</label>
                    <input type="time" value={ocEndTime} onChange={(e) => setOcEndTime(e.target.value)}
                      style={{ width: "100%", border: "1px solid #d1d5db", borderRadius: 6, padding: "8px 10px", fontSize: 13, boxSizing: "border-box" }} />
                  </div>
                </div>

                <div style={{ marginBottom: 14 }}>
                  <label style={{ fontSize: 12, fontWeight: 600, color: "#555", display: "block", marginBottom: 3 }}>Notes (optional)</label>
                  <input type="text" value={ocNotes} onChange={(e) => setOcNotes(e.target.value)}
                    placeholder="Holiday, special event, etc."
                    style={{ width: "100%", border: "1px solid #d1d5db", borderRadius: 6, padding: "8px 10px", fontSize: 13, boxSizing: "border-box" }} />
                </div>

                <button onClick={handleSaveOnCall} disabled={ocSaving || !ocOfficerId}
                  style={{
                    width: "100%", background: ocSaving || !ocOfficerId ? "#9ca3af" : "#f59e0b",
                    color: "#fff", border: "none", borderRadius: 8, padding: "11px 0",
                    fontWeight: 800, fontSize: 14, cursor: ocSaving || !ocOfficerId ? "not-allowed" : "pointer",
                  }}>
                  {ocSaving ? "Saving…" : "✓ Save On-Call Shift"}
                </button>

                {ocMsg   && <div style={{ marginTop: 8, color: "#16a34a", fontWeight: 700, fontSize: 13 }}>✓ {ocMsg}</div>}
                {ocError && <div style={{ marginTop: 8, color: "#dc2626", fontSize: 13 }}>⚠ {ocError}</div>}
              </div>

              {/* Upcoming 30-day list */}
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: "#0f2942", marginBottom: 10 }}>
                  Upcoming On-Call ({upcomingOnCall.length})
                </div>
                {upcomingOnCall.length === 0 ? (
                  <div style={{ color: "#888", fontSize: 13, fontStyle: "italic" }}>No on-call shifts scheduled.</div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {upcomingOnCall.map((ov) => {
                      const sty = shiftStyle(ov.shift_type);
                      return (
                        <div key={ov.id} style={{ border: `1px solid ${sty.border}`, borderRadius: 8, padding: "10px 12px", background: sty.bg }}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                            <div>
                              <div style={{ fontWeight: 700, fontSize: 13, color: "#0f2942" }}>
                                {ov.officer_name || officers.find((o) => o.id === ov.officer_id)?.first_name || "Officer"}
                              </div>
                              <div style={{ fontSize: 12, color: "#555", marginTop: 1 }}>
                                {displayDate(ov.override_date)}
                                {ov.start_time && ov.end_time && ` · ${fmt12(ov.start_time)}–${fmt12(ov.end_time)}`}
                              </div>
                              <div style={{ marginTop: 4 }}>{shiftBadge(ov.shift_type)}</div>
                              {ov.reason && <div style={{ fontSize: 11, color: "#64748b", marginTop: 3 }}>{ov.reason}</div>}
                            </div>
                            <div style={{ display: "flex", flexDirection: "column", gap: 4, flexShrink: 0 }}>
                              <button
                                onClick={() => { prefillFromCalendar(nextSameDow(ov.override_date)); setOcOfficerId(ov.officer_id); setOcShiftType((ov.shift_type as ShiftType) ?? "On-Call"); if (ov.start_time) setOcStartTime(ov.start_time); if (ov.end_time) setOcEndTime(ov.end_time); if (ov.reason) setOcNotes(ov.reason); handleCopyToNextWeek(ov); }}
                                style={{ background: "#fff", border: "1px solid #d1d5db", borderRadius: 5, padding: "3px 8px", fontSize: 11, cursor: "pointer", fontWeight: 600, color: "#374151" }}
                                title="Copy to next week (same day)"
                              >
                                ↻ Copy +7
                              </button>
                              <button
                                onClick={() => ov.id && handleDeleteOnCall(ov.id)}
                                style={{ background: "#fee2e2", border: "1px solid #fca5a5", borderRadius: 5, padding: "3px 8px", fontSize: 11, cursor: "pointer", fontWeight: 600, color: "#b91c1c" }}
                              >
                                Delete
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Right: Monthly calendar */}
            <div>
              {/* Calendar header */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                <button onClick={() => { if (calMonth === 0) { setCalMonth(11); setCalYear((y) => y - 1); } else setCalMonth((m) => m - 1); }}
                  style={{ background: "#f0f4f8", border: "1px solid #d1d5db", borderRadius: 6, padding: "6px 12px", cursor: "pointer", fontWeight: 700 }}>←</button>
                <div style={{ fontWeight: 700, fontSize: 16, color: "#0f2942" }}>{calMonthLabel}</div>
                <button onClick={() => { if (calMonth === 11) { setCalMonth(0); setCalYear((y) => y + 1); } else setCalMonth((m) => m + 1); }}
                  style={{ background: "#f0f4f8", border: "1px solid #d1d5db", borderRadius: 6, padding: "6px 12px", cursor: "pointer", fontWeight: 700 }}>→</button>
              </div>

              {/* Calendar grid */}
              <table style={{ width: "100%", borderCollapse: "collapse", tableLayout: "fixed" }}>
                <thead>
                  <tr>
                    {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d, i) => (
                      <th key={d} style={{ padding: "6px 0", textAlign: "center", fontSize: 11, fontWeight: 700, color: i === 0 || i === 6 ? "#d97706" : "#64748b", borderBottom: "2px solid #e2e8f0" }}>{d}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {Array.from({ length: calCells.length / 7 }, (_, weekIdx) => (
                    <tr key={weekIdx}>
                      {calCells.slice(weekIdx * 7, weekIdx * 7 + 7).map((dateStr, dowIdx) => {
                        if (!dateStr) return <td key={dowIdx} style={{ padding: 4, background: "#fafafa", border: "1px solid #f0f0f0" }} />;
                        const isToday = dateStr === todayStr;
                        const isWeekend = dowIdx === 0 || dowIdx === 6;
                        const isPast = dateStr < todayStr;
                        const dayShifts = shiftsByDate[dateStr] ?? [];
                        const day = parseInt(dateStr.split("-")[2]);
                        return (
                          <td
                            key={dowIdx}
                            onClick={() => { if (!isPast) prefillFromCalendar(dateStr); }}
                            style={{
                              padding: "4px 4px 6px",
                              verticalAlign: "top",
                              cursor: isPast ? "default" : "pointer",
                              background: isToday ? "#eff6ff" : isWeekend ? "#fffbeb" : "#fff",
                              border: isToday ? "2px solid #3b82f6" : "1px solid #e5e7eb",
                              minHeight: 60,
                              opacity: isPast ? 0.5 : 1,
                            }}
                          >
                            <div style={{ fontSize: 12, fontWeight: isToday ? 800 : 500, color: isToday ? "#1d4ed8" : isWeekend ? "#d97706" : "#374151", marginBottom: 3 }}>
                              {day}
                            </div>
                            {dayShifts.map((s, i) => {
                              const sty = shiftStyle(s.shift_type);
                              return (
                                <div key={i} style={{ fontSize: 9, background: sty.bg, color: sty.color, borderRadius: 3, padding: "1px 3px", marginBottom: 2, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={`${s.officer_name} · ${s.shift_type}`}>
                                  {(s.officer_name ?? "?").split(" ")[0]}
                                </div>
                              );
                            })}
                            {!isPast && dayShifts.length === 0 && (
                              <div style={{ fontSize: 9, color: "#d1d5db", textAlign: "center", marginTop: 4 }}>+</div>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Legend */}
              <div style={{ display: "flex", gap: 12, marginTop: 12, flexWrap: "wrap" }}>
                {SHIFT_TYPES.map((t) => {
                  const sty = SHIFT_STYLE[t];
                  return (
                    <span key={t} style={{ fontSize: 11, display: "flex", alignItems: "center", gap: 4 }}>
                      <span style={{ width: 10, height: 10, borderRadius: 2, background: sty.bg, border: `1px solid ${sty.border}`, display: "inline-block" }} />
                      <span style={{ color: sty.color, fontWeight: 600 }}>{t}</span>
                    </span>
                  );
                })}
                <span style={{ fontSize: 11, color: "#d97706", fontWeight: 600 }}>🟡 Weekend</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
