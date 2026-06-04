"use client";
import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import AppShell from "@/components/layout/AppShell";
import { fetchAnimals, updateAnimal, fetchShelterConfig, saveShelterConfig, fetchMedical } from "@/lib/data";
import type { Animal, ShelterRoom, MedicalRecord } from "@/lib/types";
import { DEFAULT_SHELTER_CONFIG, STATUS_COLORS, BEHAVIOR_FLAGS } from "@/lib/constants";
import { useAuth, useKennels } from "@/app/providers";
import { useRouter } from "next/navigation";
import { genId, displayAge, isImported, IN_SHELTER_STATUSES, FOSTER_STATUSES } from "@/lib/utils";

// All statuses that should appear on the floorplan (in shelter + fostered).
// Whitelist approach: unknown outcome statuses from imports are automatically excluded.
const FLOORPLAN_STATUSES = new Set([...IN_SHELTER_STATUSES, ...FOSTER_STATUSES]);

function buildKennelCardHTML(animal: Animal, kennel: string, medRecords: MedicalRecord[]): string {
  const todayStr = new Date().toISOString().split("T")[0];
  const activeFlags = BEHAVIOR_FLAGS.filter((f) => (animal.behavior_flags || {})[f.id as string]);
  // Only show records that were explicitly confirmed as administered.
  // NULL status = not yet confirmed, so exclude it just like Scheduled/Declined/Skipped.
  const administered = medRecords.filter((m) => m.status === "Administered" || m.status === "Completed");
  const overdue = administered.filter((m) => m.next_due && m.next_due < todayStr);
  const upcoming = administered.filter((m) => m.next_due && m.next_due >= todayStr);
  const completed = administered.filter((m) => !m.next_due);
  const daysInCare = animal.intake_date ? Math.floor((Date.now() - new Date(animal.intake_date).getTime()) / 86400000) : 0;
  const age = displayAge(animal.age);
  const speciesIcon = animal.species === "Dog" ? "🐕" : animal.species === "Cat" ? "🐈" : "🐾";

  const photoHtml = animal.photo_url
    ? `<img src="${animal.photo_url}" style="width:200px;height:200px;object-fit:cover;border-radius:6px;border:2px solid #e2e8f0;display:block;" />`
    : `<div style="width:200px;height:200px;border-radius:6px;border:2px dashed #cbd5e1;background:#f1f5f9;display:flex;align-items:center;justify-content:center;font-size:72px;">${speciesIcon}</div>`;

  const fld = (label: string, value: string) =>
    `<div style="margin-bottom:7px;"><div style="font-size:10px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.4px;">${label}</div><div style="font-size:14px;font-weight:600;color:#0f172a;margin-top:1px;">${value || "—"}</div></div>`;

  const medRow = (m: MedicalRecord, color: string, bg: string, border: string) =>
    `<tr style="background:${bg};"><td style="padding:3px 6px;border:1px solid ${border};font-size:10px;color:${color};">${m.type}</td><td style="padding:3px 6px;border:1px solid ${border};font-size:10px;color:${color};">${m.description}</td><td style="padding:3px 6px;border:1px solid ${border};font-size:10px;color:${color};font-weight:${m.next_due ? "700" : "400"};">${m.next_due || m.date || "—"}</td><td style="padding:3px 6px;border:1px solid ${border};font-size:10px;color:${color};">${m.vet || "—"}</td></tr>`;

  const medTable = (rows: MedicalRecord[], headerBg: string, headerColor: string, border: string, rowBg: string, altBg: string) =>
    `<table style="width:100%;border-collapse:collapse;font-size:10px;margin-bottom:8px;">
      <thead><tr style="background:${headerBg};">
        <th style="padding:3px 6px;text-align:left;color:${headerColor};font-weight:700;border:1px solid ${border};">Type</th>
        <th style="padding:3px 6px;text-align:left;color:${headerColor};font-weight:700;border:1px solid ${border};">Description</th>
        <th style="padding:3px 6px;text-align:left;color:${headerColor};font-weight:700;border:1px solid ${border};">Date / Due</th>
        <th style="padding:3px 6px;text-align:left;color:${headerColor};font-weight:700;border:1px solid ${border};">Vet / Staff</th>
      </tr></thead>
      <tbody>${rows.map((m, i) => medRow(m, i % 2 === 0 ? "#0f172a" : "#334155", i % 2 === 0 ? rowBg : altBg, border)).join("")}</tbody>
    </table>`;

  const alertsHtml = [
    animal.is_dangerous ? `<div style="background:#fee2e2;border:2px solid #dc2626;border-radius:5px;padding:5px 10px;font-size:11px;font-weight:700;color:#dc2626;margin-bottom:6px;">🚨 DANGEROUS ANIMAL — HANDLE WITH EXTREME CAUTION</div>` : "",
    animal.is_cruelty_case ? `<div style="background:#fef3c7;border:2px solid #f59e0b;border-radius:5px;padding:5px 10px;font-size:11px;font-weight:700;color:#b45309;margin-bottom:6px;">⚠️ CRUELTY CASE — EVIDENCE HOLD — DO NOT RELEASE WITHOUT AUTHORIZATION</div>` : "",
  ].filter(Boolean).join("");

  const statusColor = { Available: "#15803d", Adopted: "#6366f1", "Medical Hold": "#b45309", Quarantine: "#dc2626", Foster: "#0369a1", Pending: "#0369a1", Euthanized: "#dc2626" }[animal.status] || "#475569";
  const statusBg = { Available: "#f0fdf4", "Medical Hold": "#fef3c7", Quarantine: "#fee2e2" }[animal.status] || "#f0f9ff";

  return `
  <div style="width:7.5in;padding:0.2in;box-sizing:border-box;font-family:Arial,Helvetica,sans-serif;page-break-after:always;page-break-inside:avoid;">

    <!-- Header -->
    <div style="background:#0f2942;color:#fff;padding:10px 16px;border-radius:6px 6px 0 0;display:flex;justify-content:space-between;align-items:center;">
      <div>
        <div style="font-size:15px;font-weight:800;letter-spacing:0.5px;">MORGAN COUNTY ANIMAL SERVICES</div>
        <div style="font-size:10px;color:#93c5fd;margin-top:2px;font-weight:500;">ShelterTrace · Shelter Data Systems</div>
      </div>
      <div style="background:#1a8a8a;padding:6px 18px;border-radius:5px;text-align:center;">
        <div style="font-size:9px;color:#99f6e4;font-weight:700;letter-spacing:1px;text-transform:uppercase;">Kennel</div>
        <div style="font-size:24px;font-weight:900;letter-spacing:1px;line-height:1;">${kennel}</div>
      </div>
    </div>

    ${alertsHtml ? `<div style="padding:8px;background:#fef2f2;border-left:2px solid #dc2626;border-right:2px solid #dc2626;">${alertsHtml}</div>` : ""}

    <!-- Main body -->
    <div style="border:2px solid #0f2942;border-top:none;border-radius:0 0 6px 6px;padding:14px;margin-bottom:10px;">
      <div style="display:flex;gap:16px;align-items:flex-start;">

        <!-- Left: photo + key IDs + status -->
        <div style="flex-shrink:0;width:200px;">
          ${photoHtml}
          <div style="margin-top:8px;text-align:center;padding-bottom:8px;border-bottom:1px solid #e2e8f0;">
            <div style="font-size:32px;font-weight:900;color:#0f2942;line-height:1.1;">${animal.name}</div>
            <div style="font-family:monospace;font-size:16px;color:#475569;margin-top:4px;font-weight:700;">${animal.id}</div>
          </div>
          <div style="margin-top:8px;padding:7px;background:${statusBg};border:1px solid ${statusColor}40;border-radius:5px;text-align:center;">
            <div style="font-size:10px;color:#64748b;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;">Status</div>
            <div style="font-size:16px;font-weight:800;color:${statusColor};margin-top:1px;">${animal.status}</div>
            ${animal.sub_status ? `<div style="font-size:12px;color:${statusColor};font-weight:600;">${animal.sub_status}</div>` : ""}
            <div style="font-size:12px;color:#64748b;margin-top:3px;">${daysInCare} day${daysInCare !== 1 ? "s" : ""} in care</div>
          </div>
          ${animal.microchip ? `<div style="margin-top:6px;padding:4px 6px;background:#eff6ff;border-radius:4px;font-size:10px;color:#1d4ed8;text-align:center;">🔬 Chip: <strong>${animal.microchip}</strong></div>` : ""}
          ${animal.rabies_tag ? `<div style="margin-top:4px;padding:4px 6px;background:#f5f3ff;border-radius:4px;font-size:10px;color:#6d28d9;text-align:center;">💉 Rabies Tag: <strong>${animal.rabies_tag}</strong></div>` : ""}
        </div>

        <!-- Right: all details -->
        <div style="flex:1;display:grid;grid-template-columns:1fr 1fr;gap:0 20px;">
          ${fld("Species", animal.species || "")}
          ${fld("Breed", animal.breed || "")}
          ${fld("Sex", animal.sex || "")}
          ${fld("Age", age)}
          ${fld("Weight", animal.weight || "")}
          ${fld("Size", animal.size || "")}
          ${fld("Primary Color", animal.color || "")}
          ${fld("Secondary Color", animal.secondary_color || "")}
          ${fld("Coat Type", animal.coat_type || "")}
          ${fld("Fixed / Altered", animal.fixed ? "Yes" : "No")}
          ${fld("Intake Date", animal.intake_date || "")}
          ${fld("Intake Type", animal.intake_type || "")}
          ${animal.markings ? `<div style="grid-column:1/-1;margin-bottom:7px;padding-top:4px;border-top:1px solid #f1f5f9;"><div style="font-size:9px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.4px;">Markings / Distinguishing Features</div><div style="font-size:11px;color:#0f172a;margin-top:2px;font-style:italic;">${animal.markings}</div></div>` : ""}
          ${activeFlags.length > 0 ? `
          <div style="grid-column:1/-1;padding-top:6px;border-top:1px solid #f1f5f9;">
            <div style="font-size:9px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.4px;margin-bottom:5px;">Behavior Flags</div>
            <div style="display:flex;flex-wrap:wrap;gap:4px;">
              ${activeFlags.map((f) => `<span style="display:inline-flex;align-items:center;gap:3px;padding:3px 8px;border-radius:12px;font-size:10px;font-weight:700;background:${f.color}18;color:${f.color};border:1px solid ${f.color}50;">${f.icon} ${f.label}</span>`).join("")}
            </div>
          </div>` : ""}
        </div>
      </div>
    </div>

    <!-- Medical Section -->
    <div style="border:1.5px solid #e2e8f0;border-radius:6px;overflow:hidden;">
      <div style="background:#1e3a5f;color:#fff;padding:7px 14px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;display:flex;justify-content:space-between;align-items:center;">
        <span>Medical Summary</span>
        <span style="font-size:10px;font-weight:400;color:#93c5fd;">${administered.length} record${administered.length !== 1 ? "s" : ""} on file</span>
      </div>
      <div style="padding:10px 12px;">
        ${administered.length === 0
          ? `<div style="color:#94a3b8;font-style:italic;font-size:11px;padding:6px 0;">No administered records on file</div>`
          : `
          ${overdue.length > 0 ? `
            <div style="font-size:10px;font-weight:800;color:#dc2626;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:4px;">⚠ Overdue — Action Required (${overdue.length})</div>
            ${medTable(overdue, "#fee2e2", "#991b1b", "#fca5a5", "#fff5f5", "#fef2f2")}` : ""}
          ${upcoming.length > 0 ? `
            <div style="font-size:10px;font-weight:800;color:#0369a1;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:4px;">Upcoming / Scheduled (${upcoming.length})</div>
            ${medTable(upcoming, "#e0f2fe", "#0369a1", "#bae6fd", "#f0f9ff", "#e0f2fe")}` : ""}
          ${completed.length > 0 ? `
            <div style="font-size:10px;font-weight:800;color:#15803d;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:4px;">Completed Treatments (${completed.length})</div>
            ${medTable(completed, "#dcfce7", "#15803d", "#86efac", "#f0fdf4", "#dcfce7")}` : ""}`}
      </div>
    </div>

    <!-- Footer -->
    <div style="margin-top:6px;display:flex;justify-content:space-between;font-size:9px;color:#94a3b8;">
      <span>Printed ${new Date().toLocaleString()}</span>
      <span>ShelterTrace v1.0 · Shelter Data Systems · © ${new Date().getFullYear()}</span>
    </div>
  </div>`;
}

function printKennelCard(animal: Animal, kennel: string, medRecords: MedicalRecord[] = []) {
  const w = window.open("", "_blank", "width=820,height=1060");
  if (!w) return;
  w.document.write(`<html><head><title>Kennel Card — ${animal.name}</title>
  <style>*{-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important;color-adjust:exact!important;box-sizing:border-box;margin:0;padding:0;}body{background:#fff;}@media print{@page{size:letter;margin:0}}</style>
  </head><body>${buildKennelCardHTML(animal, kennel, medRecords)}</body></html>`);
  w.document.close();
  w.onload = () => w.print();
}

function printMultipleKennelCards(items: Array<{ animal: Animal; kennel: string; medRecords: MedicalRecord[] }>) {
  if (items.length === 0) return;
  const w = window.open("", "_blank", "width=820,height=1060");
  if (!w) return;
  const body = items.map((i) => buildKennelCardHTML(i.animal, i.kennel, i.medRecords)).join("");
  w.document.write(`<html><head><title>Kennel Cards (${items.length})</title>
  <style>*{-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important;color-adjust:exact!important;box-sizing:border-box;margin:0;padding:0;}body{background:#fff;}@media print{@page{size:letter;margin:0}}</style>
  </head><body>${body}</body></html>`);
  w.document.close();
  w.onload = () => w.print();
}

// Always returns a valid ShelterRoom[] regardless of what Supabase returns
function normalizeConfig(raw: unknown): ShelterRoom[] {
  if (Array.isArray(raw) && raw.length > 0) return raw as ShelterRoom[];
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    const obj = raw as Record<string, unknown>;
    if (Array.isArray(obj.rooms) && obj.rooms.length > 0) return obj.rooms as ShelterRoom[];
  }
  return DEFAULT_SHELTER_CONFIG as ShelterRoom[];
}

function getOccupancyColor(count: number): string {
  if (count === 0) return "#e8f4e8";
  if (count === 1) return "#dbeafe";
  if (count === 2) return "#bfdbfe";
  return "#fecaca";
}

function getRabiesStatus(animal: Animal, medRecords: MedicalRecord[]): "current" | "expired" | "none" {
  const today = new Date().toISOString().split("T")[0];
  if (animal.rabies_tag) return "current";
  const rabiesRec = medRecords
    .filter((m) => m.animal_id === animal.id && m.type === "Vaccination" && /rabies/i.test(m.description))
    .sort((a, b) => (a.next_due || "") > (b.next_due || "") ? -1 : 1)[0];
  if (!rabiesRec) return "none";
  if (rabiesRec.next_due && rabiesRec.next_due >= today) return "current";
  if (!rabiesRec.next_due) return "current";
  return "expired";
}

function RabiesBadge({ status, size = "cell" }: { status: "current" | "expired" | "none"; size?: "cell" | "inline" }) {
  if (status === "none") return null;
  const isCurrent = status === "current";
  if (size === "cell") {
    return (
      <div style={{
        position: "absolute", bottom: 1, right: 1,
        background: isCurrent ? "#15803d" : "#dc2626",
        color: "#fff", borderRadius: 2,
        fontSize: 5, fontWeight: 800, padding: "0px 2px", lineHeight: "9px",
        letterSpacing: "0.2px",
      }}>
        {isCurrent ? "R✓" : "R✗"}
      </div>
    );
  }
  return (
    <span style={{
      display: "inline-block",
      background: isCurrent ? "#dcfce7" : "#fee2e2",
      color: isCurrent ? "#15803d" : "#dc2626",
      border: `1px solid ${isCurrent ? "#86efac" : "#fca5a5"}`,
      borderRadius: 4, fontSize: 10, fontWeight: 700,
      padding: "1px 5px", marginLeft: 4,
    }}>
      {isCurrent ? "R✓ Current" : "R✗ Expired"}
    </span>
  );
}

// ── Shelter Designer ──────────────────────────────────────────────────────────
interface DesignerProps {
  initial: ShelterRoom[];
  onSave: (rooms: ShelterRoom[]) => void;
  onClose: () => void;
}

function ShelterDesigner({ initial, onSave, onClose }: DesignerProps) {
  const [rooms, setRooms] = useState<ShelterRoom[]>(() => initial.map((r) => ({ ...r })));
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [labelsInput, setLabelsInput] = useState("");
  const canvasRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ id: string; startX: number; startY: number; origX: number; origY: number } | null>(null);

  const selected = rooms.find((r) => r.id === selectedId) || null;

  useEffect(() => {
    if (selected?.type === "kennels") {
      setLabelsInput((selected.labels || []).join("\n"));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  const updateRoom = (id: string, patch: Partial<ShelterRoom>) =>
    setRooms((prev) => prev.map((r) => r.id === id ? { ...r, ...patch } : r));

  // ── Drag handlers ────────────────────────────────────────────────────────────
  const handleMouseDown = (e: React.MouseEvent, id: string) => {
    e.preventDefault();
    e.stopPropagation();
    setSelectedId(id);
    const room = rooms.find((r) => r.id === id)!;
    dragRef.current = { id, startX: e.clientX, startY: e.clientY, origX: room.x, origY: room.y };
  };

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!dragRef.current) return;
    const dx = e.clientX - dragRef.current.startX;
    const dy = e.clientY - dragRef.current.startY;
    updateRoom(dragRef.current.id, {
      x: Math.max(0, dragRef.current.origX + dx),
      y: Math.max(0, dragRef.current.origY + dy),
    });
  }, []);

  const handleMouseUp = useCallback(() => { dragRef.current = null; }, []);

  useEffect(() => {
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [handleMouseMove, handleMouseUp]);

  // ── Add / delete rooms ───────────────────────────────────────────────────────
  const addKennelRoom = () => {
    const id = `room-${genId()}`;
    const newRoom: ShelterRoom = { id, name: "New Wing", type: "kennels", x: 20, y: 20, w: 120, h: 200, labels: ["New-1", "New-2"] };
    setRooms((prev) => [...prev, newRoom]);
    setSelectedId(id);
  };

  const addLabelRoom = () => {
    const id = `lbl-${genId()}`;
    const newRoom: ShelterRoom = { id, name: "New Area", type: "label", x: 20, y: 20, w: 160, h: 50, bg: "#e5e7eb" };
    setRooms((prev) => [...prev, newRoom]);
    setSelectedId(id);
  };

  const deleteSelected = () => {
    if (!selectedId) return;
    setRooms((prev) => prev.filter((r) => r.id !== selectedId));
    setSelectedId(null);
  };

  const handleSave = async () => {
    setSaving(true);
    await onSave(rooms);
    setSaving(false);
  };

  const canvasW = Math.max(...rooms.map((r) => r.x + r.w), 760);
  const canvasH = Math.max(...rooms.map((r) => r.y + r.h), 560);

  return (
    <div className="modal-overlay" style={{ alignItems: "stretch", padding: 0 }}>
      <div style={{ display: "flex", width: "100%", height: "100vh", background: "#f1f5f9" }}>

        {/* Left: Canvas */}
        <div style={{ flex: 1, overflow: "auto", padding: 20, position: "relative" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <div>
              <span style={{ fontWeight: 800, fontSize: 18 }}>🔧 Shelter Designer</span>
              <span style={{ fontSize: 12, color: "var(--text-secondary)", marginLeft: 12 }}>Drag rooms to reposition · Select to edit</span>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button className="btn btn-secondary btn-sm" onClick={addLabelRoom}>+ Label Area</button>
              <button className="btn btn-secondary btn-sm" onClick={addKennelRoom}>+ Kennel Room</button>
              <button className="btn btn-secondary btn-sm" onClick={onClose}>Cancel</button>
              <button className="btn btn-primary btn-sm" onClick={handleSave} disabled={saving}>
                {saving ? "Saving…" : "💾 Save Layout"}
              </button>
            </div>
          </div>

          <div
            ref={canvasRef}
            style={{
              position: "relative",
              width: canvasW + 40,
              height: canvasH + 40,
              background: "#fff",
              border: "2px dashed #cbd5e1",
              borderRadius: 8,
              userSelect: "none",
            }}
            onClick={() => setSelectedId(null)}
          >
            {rooms.map((room) => {
              const isSelected = selectedId === room.id;
              return (
                <div
                  key={room.id}
                  onMouseDown={(e) => handleMouseDown(e, room.id)}
                  onClick={(e) => { e.stopPropagation(); setSelectedId(room.id); }}
                  style={{
                    position: "absolute",
                    left: room.x,
                    top: room.y,
                    width: room.w,
                    height: room.h,
                    background: room.type === "label" ? (room.bg || "#e5e7eb") : "#f8fafc",
                    border: isSelected ? "2px solid var(--teal)" : "1.5px solid #94a3b8",
                    borderRadius: 6,
                    cursor: "grab",
                    boxShadow: isSelected ? "0 0 0 3px #99f6e440" : undefined,
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    overflow: "hidden",
                    transition: "box-shadow 0.1s",
                  }}
                >
                  <div style={{ fontSize: 9, fontWeight: 800, color: "#374151", textAlign: "center", padding: "0 4px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: "100%" }}>
                    {room.name}
                  </div>
                  {room.type === "kennels" && room.labels && (
                    <div style={{ fontSize: 7, color: "#64748b", marginTop: 2 }}>{room.labels.length} kennels</div>
                  )}
                  {isSelected && (
                    <div style={{ position: "absolute", top: 2, right: 3, fontSize: 8, background: "var(--teal)", color: "#fff", borderRadius: 3, padding: "1px 4px" }}>
                      selected
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Right: Properties Panel */}
        <div style={{ width: 300, background: "#fff", borderLeft: "1px solid var(--border)", padding: 20, overflowY: "auto" }}>
          {!selected ? (
            <div style={{ color: "var(--text-muted)", textAlign: "center", padding: "40px 0", fontSize: 13 }}>
              Click a room to edit its properties
            </div>
          ) : (
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                <div style={{ fontWeight: 700, fontSize: 15 }}>Edit Room</div>
                <button className="btn btn-danger btn-sm" onClick={deleteSelected}>🗑 Delete</button>
              </div>

              <div className="form-group">
                <label className="form-label">Room Name</label>
                <input className="form-input" value={selected.name} onChange={(e) => updateRoom(selected.id, { name: e.target.value })} />
              </div>

              <div className="form-group">
                <label className="form-label">Type</label>
                <select className="form-select" value={selected.type} onChange={(e) => updateRoom(selected.id, { type: e.target.value as "label" | "kennels" })}>
                  <option value="kennels">Kennel Room</option>
                  <option value="label">Label / Area</option>
                </select>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                {(["x", "y", "w", "h"] as const).map((k) => (
                  <div key={k} className="form-group">
                    <label className="form-label">{k === "x" ? "Left (X)" : k === "y" ? "Top (Y)" : k === "w" ? "Width" : "Height"}</label>
                    <input
                      className="form-input"
                      type="number"
                      min={k === "w" || k === "h" ? 40 : 0}
                      value={selected[k]}
                      onChange={(e) => updateRoom(selected.id, { [k]: Math.max(k === "w" || k === "h" ? 40 : 0, Number(e.target.value)) })}
                    />
                  </div>
                ))}
              </div>

              {selected.type === "label" && (
                <div className="form-group">
                  <label className="form-label">Background Color</label>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 4 }}>
                    {["#e5e7eb", "#dbeafe", "#fef9c3", "#dcfce7", "#fce7f3", "#ede9fe", "#fee2e2", "#b8c6f0"].map((c) => (
                      <div key={c} onClick={() => updateRoom(selected.id, { bg: c })}
                        style={{ width: 24, height: 24, borderRadius: 4, background: c, border: selected.bg === c ? "2px solid var(--teal)" : "1px solid #cbd5e1", cursor: "pointer" }} />
                    ))}
                    <input type="color" value={selected.bg || "#e5e7eb"} onChange={(e) => updateRoom(selected.id, { bg: e.target.value })}
                      style={{ width: 24, height: 24, padding: 0, border: "1px solid #cbd5e1", borderRadius: 4, cursor: "pointer" }} />
                  </div>
                </div>
              )}

              {selected.type === "kennels" && (
                <>
                  <div className="form-group">
                    <label className="form-label">Layout</label>
                    <select className="form-select" value={selected.layout || "col-1"} onChange={(e) => updateRoom(selected.id, { layout: e.target.value })}>
                      <option value="col-1">Single Column</option>
                      <option value="grid-2">2-Column Grid</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Kennel Labels (one per line)</label>
                    <textarea
                      className="form-textarea"
                      rows={8}
                      value={labelsInput}
                      onChange={(e) => setLabelsInput(e.target.value)}
                      onBlur={() => updateRoom(selected.id, {
                        labels: labelsInput.split(/[\n,]+/).map((s) => s.trim()).filter(Boolean),
                      })}
                      style={{ fontFamily: "monospace", fontSize: 12 }}
                    />
                    <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 3 }}>{(selected.labels || []).length} kennels</div>
                  </div>
                </>
              )}
            </div>
          )}

          {/* Room list */}
          <div style={{ marginTop: 24, borderTop: "1px solid var(--border)", paddingTop: 14 }}>
            <div style={{ fontWeight: 700, fontSize: 12, textTransform: "uppercase", color: "var(--text-secondary)", marginBottom: 8 }}>All Rooms ({rooms.length})</div>
            {rooms.map((r) => (
              <div key={r.id} onClick={() => setSelectedId(r.id)}
                style={{ padding: "6px 8px", borderRadius: 6, marginBottom: 3, cursor: "pointer", background: selectedId === r.id ? "#f0fdfa" : "transparent", border: selectedId === r.id ? "1px solid var(--teal)" : "1px solid transparent", fontSize: 12 }}>
                <span style={{ fontWeight: 600 }}>{r.name}</span>
                <span style={{ color: "var(--text-muted)", marginLeft: 6 }}>{r.type === "kennels" ? `${(r.labels || []).length} kennels` : "label"}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main Kennel Page ──────────────────────────────────────────────────────────
export default function KennelPage() {
  const { user } = useAuth();
  const { refreshKennels } = useKennels();
  const router = useRouter();
  const isAdmin = user?.permissions?.includes("all") ?? false;
  const [animals, setAnimals] = useState<Animal[]>([]);
  const [medRecordsAll, setMedRecordsAll] = useState<MedicalRecord[]>([]);
  const [shelterConfig, setShelterConfig] = useState<ShelterRoom[]>(DEFAULT_SHELTER_CONFIG as ShelterRoom[]);
  const [loading, setLoading] = useState(true);
  const [selectedKennel, setSelectedKennel] = useState<string | null>(null);
  const [showDesigner, setShowDesigner] = useState(false);
  const [movingAnimal, setMovingAnimal] = useState<Animal | null>(null);
  const [showMultiPrint, setShowMultiPrint] = useState(false);
  const [confirmRemoveId, setConfirmRemoveId] = useState<string | null>(null);
  const [multiPrintKennels, setMultiPrintKennels] = useState<string[]>([]);

  const load = useCallback(async () => {
    try {
      const [a, config, med] = await Promise.all([fetchAnimals(), fetchShelterConfig(), fetchMedical()]);
      setAnimals(a);
      setShelterConfig(normalizeConfig(config));
      setMedRecordsAll(med);
    } catch { } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Guard: ensure shelterConfig is always an array before memos run
  const safeConfig = Array.isArray(shelterConfig) ? shelterConfig : (DEFAULT_SHELTER_CONFIG as ShelterRoom[]);

  const labelMap = useMemo(() => {
    const map: Record<string, Animal[]> = {};
    const allLabels: string[] = [];
    safeConfig.forEach((room) => { if (room.type === "kennels" && room.labels) allLabels.push(...room.labels); });
    allLabels.forEach((label) => { map[label] = []; });
    animals.forEach((a) => {
      if (!FLOORPLAN_STATUSES.has(a.status)) return;   // only active + fostered statuses
      // Show in the floorplan if the animal has a kennel — regardless of import source.
      // An imported ShelterBuddy animal that still occupies a kennel is a current animal.
      if (a.kennel && map[a.kennel] !== undefined) map[a.kennel].push(a);
    });
    return map;
  }, [animals, safeConfig]);

  // Unassigned = in the building, no valid kennel, not imported.
  // Uses IN_SHELTER_STATUSES whitelist — fostered animals are excluded because
  // they are physically outside the building.
  const unassigned = useMemo(() =>
    animals.filter((a) =>
      IN_SHELTER_STATUSES.has(a.status) &&
      !isImported(a) &&
      (!a.kennel || !Object.keys(labelMap).includes(a.kennel))
    ),
    [animals, labelMap]
  );

  const occupiedCount = Object.values(labelMap).filter((a) => a.length > 0).length;
  const totalKennels = Object.keys(labelMap).length;

  const handleMoveAnimal = async (animal: Animal, destination: string) => {
    const newKennel = destination === "Unassigned" ? undefined : destination;
    await updateAnimal(animal.id, { kennel: newKennel });
    setAnimals((prev) => prev.map((a) => a.id === animal.id ? { ...a, kennel: newKennel } : a));
    setMovingAnimal(null);
    setSelectedKennel(null);
  };

  const handleDesignerSave = async (rooms: ShelterRoom[]) => {
    await saveShelterConfig(rooms);
    setShelterConfig(rooms);
    setShowDesigner(false);
    refreshKennels(); // update the global kennel list cache
  };

  const canvasW = useMemo(() => Math.max(...safeConfig.map((r) => r.x + r.w), 760), [safeConfig]);
  const canvasH = useMemo(() => Math.max(...safeConfig.map((r) => r.y + r.h), 560), [safeConfig]);

  const selectedAnimals = selectedKennel ? (labelMap[selectedKennel] || []) : [];

  return (
    <AppShell title="Virtual Shelter" action={
      <div style={{ display: "flex", gap: 8 }}>
        <button className="btn btn-secondary btn-sm" onClick={() => document.getElementById("unassigned-section")?.scrollIntoView({ behavior: "smooth", block: "start" })}>
          📋 Unassigned ({unassigned.length})
        </button>
        <button className="btn btn-secondary btn-sm" onClick={() => { setMultiPrintKennels([]); setShowMultiPrint(true); }}>
          🖨 Print Cards
        </button>
        {isAdmin && (
          <button className="btn btn-secondary btn-sm" onClick={() => setShowDesigner(true)}>
            🔧 Design Layout
          </button>
        )}
      </div>
    }>
      <div style={{ display: "grid", gridTemplateColumns: selectedKennel ? "1fr 280px" : "1fr", gap: 16, alignItems: "start" }}>
        <div>
          {/* Stats */}
          <div className="grid-4" style={{ marginBottom: 14 }}>
            {[
              { label: "Total Kennels", value: totalKennels, icon: "🏠", color: "#64748b" },
              { label: "Occupied", value: occupiedCount, icon: "🐾", color: "#0ea5e9" },
              { label: "Empty", value: totalKennels - occupiedCount, icon: "✅", color: "#22c55e" },
              { label: "Unassigned", value: unassigned.length, icon: "📋", color: "#f59e0b" },
            ].map(({ label, value, icon, color }) => (
              <div key={label} className="stat-card">
                <div className="stat-icon" style={{ background: `${color}20` }}><span style={{ fontSize: 20 }}>{icon}</span></div>
                <div><div className="stat-value" style={{ color }}>{value}</div><div className="stat-label">{label}</div></div>
              </div>
            ))}
          </div>

          {/* Legend */}
          <div style={{ display: "flex", gap: 12, marginBottom: 10, fontSize: 11, flexWrap: "wrap" }}>
            {[
              { color: "#e8f4e8", label: "Empty" },
              { color: "#dbeafe", label: "1 Animal" },
              { color: "#bfdbfe", label: "2 Animals" },
              { color: "#fecaca", label: "3+ Animals" },
            ].map(({ color, label }) => (
              <div key={label} style={{ display: "flex", alignItems: "center", gap: 5 }}>
                <div style={{ width: 14, height: 14, borderRadius: 3, background: color, border: "1px solid rgba(0,0,0,0.15)" }} />
                <span>{label}</span>
              </div>
            ))}
          </div>

          {/* Floorplan */}
          {loading ? (
            <div style={{ textAlign: "center", color: "var(--text-muted)", padding: 40 }}>Loading shelter map…</div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <div style={{ position: "relative", width: canvasW + 20, height: canvasH + 20, background: "#f8fafc", border: "1px solid var(--border)", borderRadius: 8 }}>
                {safeConfig.map((room) => {
                  if (room.type === "label") {
                    return (
                      <div key={room.id} style={{ position: "absolute", left: room.x, top: room.y, width: room.w, height: room.h, background: room.bg || "#e5e7eb", border: "1px solid #cbd5e1", borderRadius: 4, display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <span style={{ fontSize: 11, fontWeight: 700, color: "#4b5563" }}>{room.name}</span>
                      </div>
                    );
                  }
                  if (room.type === "kennels" && room.labels) {
                    const numCols = room.layout === "grid-2" ? 2 : 1;
                    return (
                      <div key={room.id} style={{ position: "absolute", left: room.x, top: room.y, width: room.w, height: room.h, background: "#f0f4f8", border: "1.5px solid #94a3b8", borderRadius: 5, padding: 3, display: "flex", flexDirection: "column", overflow: "hidden" }}>
                        <div style={{ fontSize: 8, fontWeight: 800, color: "#4b5563", textAlign: "center", marginBottom: 2, letterSpacing: "0.3px" }}>{room.name}</div>
                        <div style={{ display: "grid", gridTemplateColumns: `repeat(${numCols}, 1fr)`, gap: 2, flex: 1 }}>
                          {room.labels.map((label) => {
                            const occupants = labelMap[label] || [];
                            const isSelected = selectedKennel === label;
                            const rabiesStatuses = occupants.map((a) => getRabiesStatus(a, medRecordsAll));
                            const cellRabies = rabiesStatuses.includes("expired") ? "expired" : rabiesStatuses.includes("current") ? "current" : "none";
                            return (
                              <div
                                key={label}
                                style={{
                                  background: getOccupancyColor(occupants.length),
                                  border: isSelected ? "2px solid var(--teal)" : "1px solid rgba(0,0,0,0.15)",
                                  borderRadius: 3,
                                  cursor: "pointer",
                                  display: "flex",
                                  flexDirection: "column",
                                  alignItems: "center",
                                  justifyContent: "center",
                                  minHeight: 18,
                                  padding: "1px 2px",
                                  position: "relative",
                                }}
                                onClick={() => { setSelectedKennel(isSelected ? null : label); setConfirmRemoveId(null); }}
                              >
                                <div style={{ fontSize: 7, fontWeight: 700, color: "#374151" }}>{label}</div>
                                {occupants.length > 0 && (
                                  <div style={{ fontSize: 6, maxWidth: "100%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: "#64748b" }}>
                                    {occupants[0].name}{occupants.length > 1 ? ` +${occupants.length - 1}` : ""}
                                  </div>
                                )}
                                {occupants.length > 0 && <RabiesBadge status={cellRabies} size="cell" />}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  }
                  return null;
                })}
              </div>
            </div>
          )}
        </div>

        {/* Selected Kennel Panel */}
        {selectedKennel && (
          <div className="card" style={{ position: "sticky", top: 76 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
              <h3 style={{ fontSize: 15, fontWeight: 800 }}>Kennel {selectedKennel}</h3>
              <button className="btn btn-ghost btn-sm" onClick={() => setSelectedKennel(null)}>✕</button>
            </div>
            <div style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 10 }}>
              {selectedAnimals.length === 0 ? "Empty" : `${selectedAnimals.length} animal${selectedAnimals.length !== 1 ? "s" : ""}`}
            </div>
            {selectedAnimals.map((a) => {
              const rStatus = getRabiesStatus(a, medRecordsAll);
              const confirming = confirmRemoveId === a.id;
              return (
                <div key={a.id} style={{ padding: "8px 0", borderBottom: "1px solid var(--border-light)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 6 }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap" }}>
                        <span style={{ fontWeight: 700, fontSize: 14, cursor: "pointer", color: "var(--teal)" }} onClick={() => router.push(`/animals/${a.id}`)}>
                          {a.name}
                        </span>
                        <RabiesBadge status={rStatus} size="inline" />
                      </div>
                      <div style={{ fontSize: 11, color: "var(--text-secondary)" }}>{a.species} · {a.breed}</div>
                      <span className="badge" style={{ background: `${STATUS_COLORS[a.status]}20`, color: STATUS_COLORS[a.status], marginTop: 3 }}>{a.status}</span>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 4, flexShrink: 0 }}>
                      <button className="btn btn-secondary btn-sm" onClick={() => { setMovingAnimal(a); setConfirmRemoveId(null); }}>Move</button>
                      {confirming ? (
                        <div style={{ display: "flex", gap: 3 }}>
                          <button
                            className="btn btn-sm"
                            style={{ background: "#dc2626", color: "#fff", borderColor: "#dc2626", fontSize: 10, padding: "2px 6px" }}
                            onClick={() => { handleMoveAnimal(a, "Unassigned"); setConfirmRemoveId(null); }}
                          >
                            Confirm
                          </button>
                          <button className="btn btn-ghost btn-sm" style={{ fontSize: 10, padding: "2px 6px" }} onClick={() => setConfirmRemoveId(null)}>✕</button>
                        </div>
                      ) : (
                        <button
                          className="btn btn-sm"
                          style={{ background: "#fee2e2", color: "#dc2626", borderColor: "#fca5a5", fontSize: 10, padding: "2px 7px" }}
                          onClick={() => setConfirmRemoveId(a.id)}
                        >
                          Remove
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
            {selectedAnimals.length === 0 && (
              <div style={{ color: "var(--text-muted)", fontSize: 12, textAlign: "center", padding: "12px 0" }}>No animals in this kennel</div>
            )}
            {selectedAnimals.length > 0 && (
              <button className="btn btn-secondary btn-sm" style={{ width: "100%", marginTop: 8 }} onClick={() => {
                const items = selectedAnimals.map((a) => ({ animal: a, kennel: selectedKennel!, medRecords: medRecordsAll.filter((m) => m.animal_id === a.id) }));
                items.length === 1 ? printKennelCard(items[0].animal, items[0].kennel, items[0].medRecords) : printMultipleKennelCards(items);
              }}>
                🖨 Print Kennel Card{selectedAnimals.length > 1 ? "s" : ""}
              </button>
            )}
          </div>
        )}
      </div>

      {/* Unassigned Animals — always visible when animals exist without kennels */}
      <div style={{ marginTop: 20, border: "1px solid #fde68a", borderRadius: 8, overflow: "hidden", background: "#fff" }} id="unassigned-section">
        <div style={{ padding: "10px 16px", background: "#fffbeb", borderBottom: "1px solid #fde68a", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ fontWeight: 700, fontSize: 14, color: "#b45309" }}>
            📋 Unassigned Animals
            <span style={{ marginLeft: 8, background: "#fef3c7", color: "#92400e", border: "1px solid #fde68a", borderRadius: 10, fontSize: 11, padding: "1px 7px", fontWeight: 700 }}>
              {unassigned.length}
            </span>
          </div>
          <div style={{ fontSize: 11, color: "#92400e" }}>Animals in the shelter with no kennel assignment</div>
        </div>
        {unassigned.length === 0 ? (
          <div style={{ padding: "18px 16px", textAlign: "center", color: "var(--text-muted)", fontSize: 13 }}>
            ✅ All shelter animals are assigned to a kennel
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))" }}>
            {unassigned.map((a) => {
              const rStatus = getRabiesStatus(a, medRecordsAll);
              return (
                <div key={a.id} style={{ padding: "10px 14px", borderBottom: "1px solid var(--border-light)", borderRight: "1px solid var(--border-light)", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 4, flexWrap: "wrap" }}>
                      <span
                        style={{ fontWeight: 700, fontSize: 13, cursor: "pointer", color: "var(--teal)" }}
                        onClick={() => router.push(`/animals/${a.id}`)}
                      >
                        {a.name}
                      </span>
                      <RabiesBadge status={rStatus} size="inline" />
                    </div>
                    <div style={{ fontSize: 11, color: "var(--text-secondary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {a.species} · {a.breed}
                    </div>
                    <span className="badge" style={{ background: `${STATUS_COLORS[a.status]}20`, color: STATUS_COLORS[a.status], marginTop: 2, display: "inline-block" }}>
                      {a.status}
                    </span>
                  </div>
                  <button
                    className="btn btn-primary btn-sm"
                    style={{ flexShrink: 0 }}
                    onClick={() => setMovingAnimal(a)}
                  >
                    Assign Kennel
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Move Animal Modal */}
      {movingAnimal && (
        <div className="modal-overlay" onClick={() => setMovingAnimal(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 440 }}>
            <div className="modal-header">
              <span className="modal-title">Move {movingAnimal.name}</span>
              <button className="btn btn-ghost btn-sm" onClick={() => setMovingAnimal(null)}>✕</button>
            </div>
            <div className="modal-body">
              <p style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 12 }}>
                Current: <strong>{movingAnimal.kennel || "Unassigned"}</strong>. Select destination:
              </p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                <button className="btn btn-secondary btn-sm" onClick={() => handleMoveAnimal(movingAnimal, "Unassigned")}>Unassigned</button>
                {Object.keys(labelMap).map((label) => (
                  <button
                    key={label}
                    className="btn btn-sm"
                    style={{ background: getOccupancyColor(labelMap[label].length), border: "1px solid rgba(0,0,0,0.15)", color: "#374151" }}
                    onClick={() => handleMoveAnimal(movingAnimal, label)}
                  >
                    {label} {labelMap[label].length > 0 ? `(${labelMap[label].length})` : ""}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Multi-Print Kennel Cards */}
      {showMultiPrint && (
        <div className="modal-overlay" onClick={() => setShowMultiPrint(false)}>
          <div className="modal modal-lg" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <span className="modal-title">🖨 Print Multiple Kennel Cards</span>
              <button className="btn btn-ghost btn-sm" onClick={() => setShowMultiPrint(false)}>✕</button>
            </div>
            <div className="modal-body">
              <p style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 12 }}>
                Select the kennels to print cards for. Only occupied kennels are shown.
              </p>
              <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
                <button className="btn btn-secondary btn-sm" onClick={() => setMultiPrintKennels(Object.keys(labelMap).filter((k) => labelMap[k].length > 0))}>Select All Occupied</button>
                <button className="btn btn-ghost btn-sm" onClick={() => setMultiPrintKennels([])}>Clear</button>
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, maxHeight: 280, overflowY: "auto" }}>
                {Object.keys(labelMap).filter((k) => labelMap[k].length > 0).map((label) => {
                  const checked = multiPrintKennels.includes(label);
                  return (
                    <label key={label} style={{ display: "flex", alignItems: "center", gap: 6, padding: "5px 10px", border: `1px solid ${checked ? "var(--teal)" : "var(--border)"}`, borderRadius: 6, cursor: "pointer", background: checked ? "#f0fdfa" : "#fff", fontSize: 12 }}>
                      <input type="checkbox" checked={checked} onChange={() => setMultiPrintKennels((prev) => checked ? prev.filter((k) => k !== label) : [...prev, label])} style={{ accentColor: "var(--teal)" }} />
                      <strong>{label}</strong>
                      <span style={{ color: "var(--text-secondary)" }}>({labelMap[label].map((a) => a.name).join(", ")})</span>
                    </label>
                  );
                })}
              </div>
            </div>
            <div className="modal-footer">
              <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>{multiPrintKennels.length} kennel{multiPrintKennels.length !== 1 ? "s" : ""} selected · {multiPrintKennels.reduce((s, k) => s + (labelMap[k]?.length || 0), 0)} card{multiPrintKennels.reduce((s, k) => s + (labelMap[k]?.length || 0), 0) !== 1 ? "s" : ""} to print</span>
              <button className="btn btn-secondary" onClick={() => setShowMultiPrint(false)}>Cancel</button>
              <button className="btn btn-primary" disabled={multiPrintKennels.length === 0} onClick={() => {
                const items = multiPrintKennels.flatMap((k) =>
                  (labelMap[k] || []).map((a) => ({ animal: a, kennel: k, medRecords: medRecordsAll.filter((m) => m.animal_id === a.id) }))
                );
                printMultipleKennelCards(items);
                setShowMultiPrint(false);
              }}>Print {multiPrintKennels.reduce((s, k) => s + (labelMap[k]?.length || 0), 0)} Card{multiPrintKennels.reduce((s, k) => s + (labelMap[k]?.length || 0), 0) !== 1 ? "s" : ""}</button>
            </div>
          </div>
        </div>
      )}

      {/* Shelter Designer */}
      {showDesigner && (
        <ShelterDesigner
          initial={safeConfig}
          onSave={handleDesignerSave}
          onClose={() => setShowDesigner(false)}
        />
      )}
    </AppShell>
  );
}
