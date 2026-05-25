"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import AppShell from "@/components/layout/AppShell";
import PhotoIdThumb from "@/components/ui/PhotoIdThumb";
import CollapsibleSection from "@/components/ui/CollapsibleSection";
import {
  fetchPerson, updatePerson, addPersonNote, fetchPersonNotes,
  uploadPersonPhotoId, deletePersonPhotoId, fetchFormsByLinked,
  fetchAdoptionsByPerson, fetchReceiptsByPerson,
  fetchCallsByPerson, fetchCitationsByPerson, fetchLicensesByPerson,
} from "@/lib/data";
import type { Person, ShelterForm, FormPreFill, AdoptionRecord, Receipt, DispatchCall, Citation, PetLicense } from "@/lib/types";
import GenerateFormButton from "@/components/forms/GenerateFormButton";
import ReprintFormButton from "@/components/forms/ReprintFormButton";
import ScanLicenseButton from "@/components/ui/ScanLicenseButton";
import type { AamvaData } from "@/lib/parseAamva";
import { PERSON_ROLES } from "@/lib/constants";
import { formatDate, today, nowTime, genId } from "@/lib/utils";

const HAIR_COLORS = ["", "Black", "Brown", "Dark Brown", "Light Brown", "Blonde", "Red", "Auburn", "Gray", "White", "Salt & Pepper", "Bald", "Other"];
const PERSON_EYE_COLORS = ["", "Brown", "Blue", "Green", "Hazel", "Gray", "Amber", "Other"];
const SEXES = ["", "Male", "Female", "Non-binary", "Other", "Unknown"];
const ID_TYPES = ["", "Driver's License", "State ID", "Passport", "Military ID", "Other"];
const NOTE_TYPES = ["General", "Complaint", "Follow-up", "Legal", "Administrative", "Adoption", "Foster", "Other"];

function F({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="form-group">
      <label className="form-label">{label}</label>
      {children}
    </div>
  );
}

function calcAge(dob: string): string {
  const birth = new Date(dob);
  const now = new Date();
  const y = now.getFullYear() - birth.getFullYear();
  const m = now.getMonth() - birth.getMonth();
  const adj = m < 0 || (m === 0 && now.getDate() < birth.getDate()) ? y - 1 : y;
  return `${adj} yrs`;
}

export default function PersonDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [person, setPerson] = useState<Person | null>(null);
  const [notes, setNotes] = useState<Array<{ id: string; text: string; type: string; date: string; time: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [adoptions, setAdoptions] = useState<AdoptionRecord[]>([]);
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [calls, setCalls] = useState<DispatchCall[]>([]);
  const [citations, setCitations] = useState<Citation[]>([]);
  const [personLicenses, setPersonLicenses] = useState<PetLicense[]>([]);
  const [personForms, setPersonForms] = useState<ShelterForm[]>([]);

  const [newNote, setNewNote] = useState("");
  const [noteType, setNoteType] = useState("General");
  const [scanKey, setScanKey] = useState(0);
  const [uploadingId, setUploadingId] = useState(false);
  const [deletingId, setDeletingId] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState(false);

  const load = useCallback(async () => {
    try {
      const p = await fetchPerson(id);
      if (!p) { router.replace("/people"); return; }
      setPerson(p);
      const fullName = `${p.first_name} ${p.last_name}`;
      const [n, forms, ads, recs, cls, cits, lics] = await Promise.all([
        fetchPersonNotes(id),
        fetchFormsByLinked({ personId: id }),
        fetchAdoptionsByPerson(id),
        fetchReceiptsByPerson(id),
        fetchCallsByPerson(id, fullName),
        fetchCitationsByPerson(p.first_name, p.last_name),
        fetchLicensesByPerson(id),
      ]);
      setNotes(n as typeof notes);
      setPersonForms(forms);
      setAdoptions(ads);
      setReceipts(recs);
      setCalls(cls);
      setCitations(cits);
      setPersonLicenses(lics);
    } catch { router.replace("/people"); } finally { setLoading(false); }
  }, [id, router]);

  useEffect(() => { load(); }, [load]);

  const save = useCallback(async (updates: Partial<Person>) => {
    if (!person) return;
    setSaving(true);
    try {
      const updated = await updatePerson(person.id, updates);
      setPerson(updated);
    } catch (e) { console.error(e); } finally { setSaving(false); }
  }, [person]);

  const handleLicenseScan = useCallback(async (data: AamvaData) => {
    const updates: Partial<Person> = {};
    if (data.firstName)     updates.first_name   = data.firstName;
    if (data.middleName)    updates.middle_name  = data.middleName;
    if (data.lastName)      updates.last_name    = data.lastName;
    if (data.address)       updates.address      = data.address;
    if (data.city)          updates.city         = data.city;
    if (data.state)         updates.state        = data.state;
    if (data.zip)           updates.zip          = data.zip;
    if (data.dob)           updates.dob          = data.dob;
    if (data.sex)           updates.sex          = data.sex;
    if (data.licenseNumber) { updates.id_type = "Driver's License"; updates.id_number = data.licenseNumber; }
    if (data.expiration)    updates.id_expiration = data.expiration;
    await save(updates);
    setScanKey((k) => k + 1); // remount uncontrolled inputs to show new values
  }, [save]);

  const handleAddNote = async () => {
    if (!newNote.trim() || !person) return;
    await addPersonNote(person.id, newNote.trim(), noteType);
    setNotes((prev) => [{ id: genId(), text: newNote.trim(), type: noteType, date: today(), time: nowTime() }, ...prev]);
    setNewNote("");
  };

  const handlePhotoIdFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !person) return;
    setUploadingId(true);
    try {
      const url = await uploadPersonPhotoId(person.id, file);
      setPerson((p) => p ? { ...p, photo_id_url: url } : p);
    } catch (err: unknown) {
      alert(`Upload failed: ${(err as { message?: string })?.message || "Unknown error"}`);
    } finally {
      setUploadingId(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleDeletePhotoId = async () => {
    if (!person?.photo_id_url) return;
    setDeletingId(true);
    try {
      await deletePersonPhotoId(person.id, person.photo_id_url);
      setPerson((p) => p ? { ...p, photo_id_url: undefined } : p);
      setConfirmDeleteId(false);
    } catch { } finally { setDeletingId(false); }
  };

  const printProfile = () => {
    if (!person) return;
    const w = window.open("", "_blank", "width=820,height=1060");
    if (!w) return;
    const fullName = `${person.first_name}${person.middle_name ? ` ${person.middle_name}` : ""} ${person.last_name}`;
    const fld = (label: string, value: string) =>
      `<div style="margin-bottom:8px;"><div style="font-size:9px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.4px;">${label}</div><div style="font-size:12px;color:#0f172a;margin-top:1px;">${value || "—"}</div></div>`;
    const section = (title: string, color: string, content: string) =>
      `<div style="margin-bottom:10px;border:1px solid ${color}40;border-radius:6px;overflow:hidden;"><div style="background:${color}18;padding:6px 12px;font-size:10px;font-weight:700;color:${color};text-transform:uppercase;">${title}</div><div style="padding:10px 12px;display:grid;grid-template-columns:1fr 1fr 1fr;gap:4px 16px;">${content}</div></div>`;
    w.document.write(`<html><head><title>Contact Profile — ${fullName}</title>
    <style>*{box-sizing:border-box;margin:0;padding:0;}body{background:#fff;font-family:Arial,sans-serif;}@media print{@page{size:letter;margin:0}}</style>
    </head><body>
    <div style="width:7.5in;padding:0.25in;">
      <div style="background:#0f2942;color:#fff;padding:10px 16px;border-radius:6px 6px 0 0;display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
        <div><div style="font-size:15px;font-weight:800;">MORGAN COUNTY ANIMAL SERVICES</div><div style="font-size:10px;color:#93c5fd;margin-top:2px;">ShelterTrace · Contact Profile</div></div>
        <div style="text-align:right;"><div style="font-size:18px;font-weight:800;">${fullName}</div><div style="font-size:11px;color:#93c5fd;">${person.pid} · ${person.role}</div></div>
      </div>
      ${section("#0f766e", "#0f766e", fld("First Name", person.first_name) + fld("Middle Name", person.middle_name || "") + fld("Last Name", person.last_name) + fld("Role", person.role) + fld("Phone", person.phone || "") + fld("Email", person.email || "") + fld("Date of Birth", person.dob ? `${person.dob} (${calcAge(person.dob)})` : "") + fld("Sex", person.sex || "") + fld("Date Added", formatDate(person.date_added || "")))}
      ${section("Address", "#1d4ed8", fld("Street", person.address || "") + fld("City", person.city || "") + fld("State", person.state || "") + fld("ZIP", person.zip || ""))}
      ${section("Identification", "#d97706", fld("ID Type", person.id_type || "") + fld("ID Number", person.id_number || "") + fld("ID State", person.id_state || "") + fld("ID Expiration", person.id_expiration ? formatDate(person.id_expiration) : ""))}
      ${(person.hair_color || person.eye_color || person.height || person.weight) ? section("Physical Description", "#7c3aed", fld("Hair", person.hair_color || "") + fld("Eyes", person.eye_color || "") + fld("Height", person.height || "") + fld("Weight", person.weight || "")) : ""}
      ${adoptions.length > 0 ? `<div style="margin-bottom:10px;"><div style="font-size:10px;font-weight:700;color:#16a34a;text-transform:uppercase;margin-bottom:4px;">Adoptions (${adoptions.length})</div><table style="width:100%;border-collapse:collapse;font-size:11px;"><thead><tr style="background:#dcfce7;"><th style="padding:3px 8px;text-align:left;border:1px solid #bbf7d0;">Animal</th><th style="padding:3px 8px;text-align:left;border:1px solid #bbf7d0;">Date</th></tr></thead><tbody>${adoptions.map((a) => `<tr><td style="padding:3px 8px;border:1px solid #e2e8f0;">${a.animal_name}</td><td style="padding:3px 8px;border:1px solid #e2e8f0;">${a.adoption_date}</td></tr>`).join("")}</tbody></table></div>` : ""}
      ${notes.length > 0 ? `<div style="margin-bottom:10px;"><div style="font-size:10px;font-weight:700;color:#475569;text-transform:uppercase;margin-bottom:4px;">Notes (${notes.length})</div>${notes.map((n) => `<div style="padding:5px 8px;border:1px solid #e2e8f0;border-radius:4px;margin-bottom:4px;font-size:11px;"><span style="font-weight:600;color:#475569;">${n.type} · ${n.date} ${n.time}</span><br/>${n.text}</div>`).join("")}</div>` : ""}
      <div style="margin-top:8px;display:flex;justify-content:space-between;font-size:9px;color:#94a3b8;"><span>Printed ${new Date().toLocaleString()}</span><span>ShelterTrace v1.0 · Shelter Data Systems · © ${new Date().getFullYear()}</span></div>
    </div>
    <script>window.onload=()=>window.print()</script>
    </body></html>`);
    w.document.close();
  };

  if (loading) return <AppShell title="Contact"><div style={{ textAlign: "center", color: "var(--text-muted)", padding: 40 }}>Loading…</div></AppShell>;
  if (!person) return null;

  const initials = `${person.first_name?.[0] || ""}${person.last_name?.[0] || ""}`.toUpperCase();
  const fullName = `${person.first_name}${person.middle_name ? ` ${person.middle_name}` : ""} ${person.last_name}`;

  const roleBgColor: Record<string, string> = {
    "Adopter": "#dcfce7", "Previous Owner": "#fef3c7", "Foster Parent": "#dbeafe",
    "Volunteer": "#f3e8ff", "Witness": "#fce7f3", "Complainant": "#fee2e2",
    "Animal Control Officer": "#ccfbf1",
  };
  const roleTextColor: Record<string, string> = {
    "Adopter": "#15803d", "Previous Owner": "#d97706", "Foster Parent": "#1d4ed8",
    "Volunteer": "#7c3aed", "Witness": "#db2777", "Complainant": "#dc2626",
    "Animal Control Officer": "#0f766e",
  };

  const citStatusColor = (s?: string) => {
    if (!s) return { bg: "#f1f5f9", text: "#475569" };
    if (s === "Paid") return { bg: "#dcfce7", text: "#15803d" };
    if (s === "Dismissed") return { bg: "#e0f2fe", text: "#0369a1" };
    if (s === "Pending") return { bg: "#fef3c7", text: "#d97706" };
    return { bg: "#fee2e2", text: "#dc2626" };
  };

  return (
    <AppShell title={`${person.first_name} ${person.last_name}`}>
      <div style={{ maxWidth: 1100 }}>
        {/* Back + header actions */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
          <button className="btn btn-secondary btn-sm" onClick={() => router.push("/people")}>← Back</button>
          <div style={{ flex: 1 }} />
          {saving && <span style={{ fontSize: 12, color: "var(--teal)" }}>Saving…</span>}
          <button className="btn btn-secondary btn-sm" onClick={printProfile}>🖨 Print Profile</button>
        </div>

        {/* Header card */}
        <div className="card" style={{ marginBottom: 20, padding: "16px 20px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            {person.photo_id_url ? (
              <PhotoIdThumb url={person.photo_id_url} name={fullName} size={64} />
            ) : (
              <div style={{
                width: 64, height: 64, borderRadius: "50%", background: "var(--teal)",
                color: "#fff", fontSize: 22, fontWeight: 800,
                display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
              }}>
                {initials}
              </div>
            )}
            <div style={{ flex: 1 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                <h1 style={{ fontSize: 22, fontWeight: 800, margin: 0 }}>{fullName}</h1>
                <span style={{
                  background: roleBgColor[person.role] || "#f1f5f9",
                  color: roleTextColor[person.role] || "#475569",
                  padding: "2px 10px", borderRadius: 20, fontSize: 11, fontWeight: 700,
                }}>
                  {person.role}
                </span>
              </div>
              <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 4, display: "flex", gap: 16, flexWrap: "wrap" }}>
                <span>{person.pid}</span>
                {person.dob && <span>DOB: {person.dob} · {calcAge(person.dob)}</span>}
                {person.phone && <span>📞 {person.phone}</span>}
                {person.email && <span>✉ {person.email}</span>}
                <span>Added {formatDate(person.date_added || person.created_at || "")}</span>
              </div>
            </div>
            <div style={{ display: "flex", gap: 8, flexShrink: 0, flexWrap: "wrap", justifyContent: "flex-end" }}>
              <div style={{ display: "flex", gap: 6, fontSize: 11, color: "var(--text-secondary)", alignItems: "center" }}>
                {adoptions.length > 0 && <span style={{ background: "#dcfce7", color: "#15803d", padding: "2px 8px", borderRadius: 10, fontWeight: 700 }}>{adoptions.length} adoption{adoptions.length !== 1 ? "s" : ""}</span>}
                {citations.length > 0 && <span style={{ background: "#fee2e2", color: "#dc2626", padding: "2px 8px", borderRadius: 10, fontWeight: 700 }}>{citations.length} citation{citations.length !== 1 ? "s" : ""}</span>}
                {calls.length > 0 && <span style={{ background: "#fff7ed", color: "#ea580c", padding: "2px 8px", borderRadius: 10, fontWeight: 700 }}>{calls.length} call{calls.length !== 1 ? "s" : ""}</span>}
              </div>
            </div>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "180px 1fr", gap: 20, alignItems: "start" }}>
          {/* Left column — avatar + quick stats */}
          <div>
            {person.photo_id_url ? (
              <div style={{ marginBottom: 12, borderRadius: 10, overflow: "hidden", border: "2px solid var(--border)" }}>
                <PhotoIdThumb url={person.photo_id_url} name={fullName} size={160} />
              </div>
            ) : (
              <div style={{
                width: "100%", aspectRatio: "1/1", borderRadius: 10, background: "linear-gradient(135deg, var(--teal), #0d9488)",
                display: "flex", alignItems: "center", justifyContent: "center",
                color: "#fff", fontSize: 52, fontWeight: 800, marginBottom: 12,
              }}>
                {initials}
              </div>
            )}

            {[
              ["PID", person.pid],
              ["Role", person.role],
              ["Phone", person.phone || "—"],
              ["Email", person.email ? person.email.substring(0, 20) + (person.email.length > 20 ? "…" : "") : "—"],
              ["City", person.city || "—"],
              ["Notes", String(notes.length)],
              ["Forms", String(personForms.length)],
            ].map(([l, v]) => (
              <div key={l} style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", borderBottom: "1px solid var(--border-light)", fontSize: 12 }}>
                <span style={{ color: "var(--text-secondary)" }}>{l}</span>
                <span style={{ fontWeight: 600, maxWidth: 100, textAlign: "right", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{v}</span>
              </div>
            ))}

            <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 6 }}>
              <select
                className="form-select"
                value={person.role}
                onChange={(e) => save({ role: e.target.value })}
                style={{ fontSize: 12 }}
              >
                {PERSON_ROLES.map((r) => <option key={r}>{r}</option>)}
              </select>
              <button className="btn btn-secondary btn-sm" onClick={printProfile}>🖨 Print Profile</button>
            </div>
          </div>

          {/* Right column — collapsible sections */}
          <div>

            {/* ── Personal Information ─────────────────────────────────── */}
            <CollapsibleSection title="Personal Information" color="#0f766e" key={`pi-${scanKey}`}>
              <div style={{ marginBottom: 10 }}>
                <ScanLicenseButton onScan={handleLicenseScan} label="Scan Driver's License" />
                <span style={{ fontSize: 11, color: "var(--text-muted)", marginLeft: 10 }}>Auto-fills name, address, DOB, sex, and license number</span>
              </div>
              <div className="grid-3">
                <F label="First Name *">
                  <input className="form-input" defaultValue={person.first_name} onBlur={(e) => { if (e.target.value !== person.first_name) save({ first_name: e.target.value }); }} />
                </F>
                <F label="Middle Name">
                  <input className="form-input" defaultValue={person.middle_name || ""} onBlur={(e) => save({ middle_name: e.target.value || undefined })} />
                </F>
                <F label="Last Name *">
                  <input className="form-input" defaultValue={person.last_name} onBlur={(e) => { if (e.target.value !== person.last_name) save({ last_name: e.target.value }); }} />
                </F>
                <F label="Role">
                  <select className="form-select" value={person.role} onChange={(e) => save({ role: e.target.value })}>
                    {PERSON_ROLES.map((r) => <option key={r}>{r}</option>)}
                  </select>
                </F>
                <F label="Phone">
                  <input className="form-input" defaultValue={person.phone || ""} onBlur={(e) => save({ phone: e.target.value || undefined })} />
                </F>
                <F label="Email">
                  <input className="form-input" type="email" defaultValue={person.email || ""} onBlur={(e) => save({ email: e.target.value || undefined })} />
                </F>
                <F label="Date of Birth">
                  <input className="form-input" type="date" value={person.dob || ""} onChange={(e) => save({ dob: e.target.value || undefined })} />
                  {person.dob && <div style={{ fontSize: 10, color: "var(--teal)", marginTop: 3, fontWeight: 700 }}>Age: {calcAge(person.dob)}</div>}
                </F>
                <F label="Sex">
                  <select className="form-select" value={person.sex || ""} onChange={(e) => save({ sex: e.target.value || undefined })}>
                    {SEXES.map((s) => <option key={s} value={s}>{s || "— Select —"}</option>)}
                  </select>
                </F>
              </div>
            </CollapsibleSection>

            {/* ── Address ──────────────────────────────────────────────── */}
            <CollapsibleSection title="Address" color="#1d4ed8" key={`addr-${scanKey}`}>
              <div className="grid-3">
                <F label="Street Address">
                  <input className="form-input" defaultValue={person.address || ""} onBlur={(e) => save({ address: e.target.value || undefined })} style={{ gridColumn: "1 / -1" }} />
                </F>
                <F label="City">
                  <input className="form-input" defaultValue={person.city || ""} onBlur={(e) => save({ city: e.target.value || undefined })} />
                </F>
                <F label="State">
                  <input className="form-input" defaultValue={person.state || ""} onBlur={(e) => save({ state: e.target.value || undefined })} placeholder="GA" style={{ maxWidth: 80 }} />
                </F>
                <F label="ZIP">
                  <input className="form-input" defaultValue={person.zip || ""} onBlur={(e) => save({ zip: e.target.value || undefined })} placeholder="30655" style={{ maxWidth: 100 }} />
                </F>
              </div>
              {(person.address || person.city) && (
                <div style={{ marginTop: 8 }}>
                  <a
                    href={`https://maps.google.com/?q=${encodeURIComponent([person.address, person.city, person.state, person.zip].filter(Boolean).join(", "))}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn btn-secondary btn-sm"
                    style={{ fontSize: 11 }}
                  >
                    🗺 Open in Maps
                  </a>
                </div>
              )}
            </CollapsibleSection>

            {/* ── Identification ───────────────────────────────────────── */}
            <CollapsibleSection title="Identification" color="#d97706" key={`id-${scanKey}`}>
              <div className="grid-3">
                <F label="ID Type">
                  <select className="form-select" value={person.id_type || ""} onChange={(e) => save({ id_type: e.target.value || undefined })}>
                    {ID_TYPES.map((t) => <option key={t} value={t}>{t || "— Select —"}</option>)}
                  </select>
                </F>
                <F label="ID Number">
                  <input className="form-input" defaultValue={person.id_number || ""} onBlur={(e) => save({ id_number: e.target.value || undefined })} />
                </F>
                <F label="ID State">
                  <input className="form-input" defaultValue={person.id_state || ""} onBlur={(e) => save({ id_state: e.target.value || undefined })} placeholder="GA" style={{ maxWidth: 80 }} />
                </F>
                <F label="ID Expiration">
                  <input className="form-input" type="date" value={person.id_expiration || ""} onChange={(e) => save({ id_expiration: e.target.value || undefined })} />
                </F>
              </div>

              {/* Photo ID */}
              <div style={{ marginTop: 14, paddingTop: 14, borderTop: "1px solid var(--border-light)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                  <span style={{ fontWeight: 700, fontSize: 12, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: 0.5 }}>Photo ID</span>
                  {person.photo_id_url && (
                    <span style={{ fontSize: 11, background: "#dcfce7", color: "#15803d", fontWeight: 700, padding: "2px 8px", borderRadius: 10 }}>✓ On File</span>
                  )}
                </div>
                {person.photo_id_url ? (
                  <div style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>
                    <PhotoIdThumb url={person.photo_id_url} name={fullName} size={90} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 8 }}>Click the thumbnail to view full size.</div>
                      <div style={{ display: "flex", gap: 8 }}>
                        <button className="btn btn-secondary btn-sm" onClick={() => fileInputRef.current?.click()} disabled={uploadingId}>
                          {uploadingId ? "Uploading…" : "🔄 Replace"}
                        </button>
                        {!confirmDeleteId ? (
                          <button className="btn btn-ghost btn-sm" style={{ color: "#dc2626" }} onClick={() => setConfirmDeleteId(true)}>🗑 Delete</button>
                        ) : (
                          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                            <span style={{ fontSize: 12, color: "#dc2626", fontWeight: 600 }}>Delete?</span>
                            <button className="btn btn-sm" style={{ background: "#dc2626", color: "#fff" }} onClick={handleDeletePhotoId} disabled={deletingId}>
                              {deletingId ? "…" : "Yes"}
                            </button>
                            <button className="btn btn-ghost btn-sm" onClick={() => setConfirmDeleteId(false)}>Cancel</button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                    <div style={{ width: 72, height: 72, border: "2px dashed var(--border)", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-muted)", fontSize: 26, flexShrink: 0 }}>
                      🪪
                    </div>
                    <div>
                      <div style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 8 }}>No photo ID on file.</div>
                      <button className="btn btn-primary btn-sm" onClick={() => fileInputRef.current?.click()} disabled={uploadingId}>
                        {uploadingId ? "Uploading…" : "📎 Upload Photo ID"}
                      </button>
                    </div>
                  </div>
                )}
                <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp,application/pdf" style={{ display: "none" }} onChange={handlePhotoIdFile} />
              </div>
            </CollapsibleSection>

            {/* ── Physical Description ─────────────────────────────────── */}
            <CollapsibleSection title="Physical Description" color="#7c3aed">
              <div className="grid-3" style={{ marginBottom: 4 }}>
                <F label="Hair Color">
                  <select className="form-select" value={person.hair_color || ""} onChange={(e) => save({ hair_color: e.target.value || undefined })}>
                    {HAIR_COLORS.map((c) => <option key={c} value={c}>{c || "— Select —"}</option>)}
                  </select>
                </F>
                <F label="Eye Color">
                  <select className="form-select" value={person.eye_color || ""} onChange={(e) => save({ eye_color: e.target.value || undefined })}>
                    {PERSON_EYE_COLORS.map((c) => <option key={c} value={c}>{c || "— Select —"}</option>)}
                  </select>
                </F>
                <F label="Height">
                  <input className="form-input" defaultValue={person.height || ""} onBlur={(e) => save({ height: e.target.value || undefined })} placeholder='e.g. 5&apos;10"' />
                </F>
                <F label="Weight">
                  <input className="form-input" defaultValue={person.weight || ""} onBlur={(e) => save({ weight: e.target.value || undefined })} placeholder="e.g. 165 lbs" />
                </F>
              </div>
              <div style={{ fontSize: 11, color: "var(--text-muted)", fontStyle: "italic" }}>Physical description is used for suspect/violator identification.</div>
            </CollapsibleSection>

            {/* ── Dispatch Calls ───────────────────────────────────────── */}
            <CollapsibleSection title={`Dispatch Calls (${calls.length})`} color="#ea580c" defaultOpen={false}>
              {calls.length === 0 ? (
                <div style={{ color: "var(--text-muted)", textAlign: "center", padding: "12px 0" }}>No dispatch calls linked to this person.</div>
              ) : (
                <table className="data-table">
                  <thead><tr><th>Call #</th><th>Date</th><th>Type</th><th>Address</th><th>Role</th></tr></thead>
                  <tbody>
                    {calls.map((c) => {
                      const party = c.involved_parties?.find((p) => p.id === person.id || p.name?.toLowerCase() === fullName.toLowerCase());
                      return (
                        <tr key={c.id} style={{ cursor: "pointer" }} onClick={() => router.push(`/dispatch/${c.id}`)}>
                          <td style={{ fontFamily: "monospace", fontSize: 12 }}>{c.id}</td>
                          <td style={{ fontSize: 12 }}>{c.date_reported ? formatDate(c.date_reported) : "—"}</td>
                          <td><span className="badge" style={{ background: "#fff7ed", color: "#ea580c" }}>{c.type}</span></td>
                          <td style={{ fontSize: 12 }}>{[c.address, c.city].filter(Boolean).join(", ") || "—"}</td>
                          <td style={{ fontSize: 12 }}>{party?.role || "—"}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </CollapsibleSection>

            {/* ── Citations ────────────────────────────────────────────── */}
            <CollapsibleSection title={`Citations (${citations.length})`} color="#dc2626" defaultOpen={false}>
              {citations.length === 0 ? (
                <div style={{ color: "var(--text-muted)", textAlign: "center", padding: "12px 0" }}>No citations on file for this person.</div>
              ) : (
                <table className="data-table">
                  <thead><tr><th>Citation #</th><th>Date</th><th>Violations</th><th>Status</th></tr></thead>
                  <tbody>
                    {citations.map((c) => {
                      const sc = citStatusColor(c.status);
                      return (
                        <tr key={c.id} style={{ cursor: "pointer" }} onClick={() => router.push(`/citations?id=${c.id}`)}>
                          <td style={{ fontFamily: "monospace", fontSize: 12, fontWeight: 600 }}>{c.citation_number}</td>
                          <td style={{ fontSize: 12 }}>{c.date ? formatDate(c.date) : "—"}</td>
                          <td style={{ fontSize: 12 }}>{c.violations?.length ? `${c.violations.length} violation${c.violations.length !== 1 ? "s" : ""}` : c.violation_desc || "—"}</td>
                          <td><span className="badge" style={{ background: sc.bg, color: sc.text }}>{c.status || "Pending"}</span></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </CollapsibleSection>

            {/* ── Adoptions ────────────────────────────────────────────── */}
            <CollapsibleSection title={`Adoptions (${adoptions.length})`} color="#0d9488" defaultOpen={adoptions.length > 0}>
              {adoptions.length === 0 ? (
                <div style={{ color: "var(--text-muted)", textAlign: "center", padding: "12px 0" }}>No adoption records for this person.</div>
              ) : (
                <table className="data-table">
                  <thead><tr><th>Animal</th><th>Animal ID</th><th>Adoption Date</th><th>Notes</th></tr></thead>
                  <tbody>
                    {adoptions.map((a) => (
                      <tr key={a.id} style={{ cursor: "pointer" }} onClick={() => router.push(`/animals/${a.animal_id}`)}>
                        <td style={{ fontWeight: 600 }}>{a.animal_name}</td>
                        <td style={{ fontFamily: "monospace", fontSize: 12 }}>{a.animal_id}</td>
                        <td style={{ fontSize: 12 }}>{a.adoption_date ? formatDate(a.adoption_date) : "—"}</td>
                        <td style={{ fontSize: 12, color: "var(--text-secondary)" }}>{a.notes || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </CollapsibleSection>

            {/* ── Forms ────────────────────────────────────────────────── */}
            <CollapsibleSection title={`Forms (${personForms.length})`} color="#4f46e5" defaultOpen={false}>
              <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 12 }}>
                <GenerateFormButton
                  size="sm"
                  label="Generate Form"
                  prefill={{
                    person_id: person.id,
                    person_first: person.first_name,
                    person_last: person.last_name,
                    person_address: person.address,
                    person_city: person.city,
                    person_state: person.state,
                    person_zip: person.zip,
                    person_phone: person.phone,
                    person_email: person.email,
                  } as FormPreFill}
                  onSaved={(form) => setPersonForms((prev) => [form, ...prev])}
                />
              </div>
              {personForms.length === 0 ? (
                <div style={{ color: "var(--text-muted)", textAlign: "center", padding: "12px 0" }}>No forms linked to this person yet.</div>
              ) : (
                <table className="data-table">
                  <thead><tr><th>Type</th><th>Summary</th><th>Officer</th><th>Date</th><th></th></tr></thead>
                  <tbody>
                    {personForms.map((f) => (
                      <tr key={f.id} style={{ cursor: "pointer" }} onClick={() => router.push(`/forms?id=${f.id}`)}>
                        <td><span className="badge" style={{ background: "#eff6ff", color: "#4f46e5" }}>{f.form_type.replace(/_/g, " ")}</span></td>
                        <td style={{ fontSize: 12, maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {(f.form_data as Record<string, unknown>).foster_name as string ||
                            (f.form_data as Record<string, unknown>).to as string ||
                            [(f.form_data as Record<string, unknown>).name_first, (f.form_data as Record<string, unknown>).name_last].filter(Boolean).join(" ") ||
                            [(f.form_data as Record<string, unknown>).adopter_first, (f.form_data as Record<string, unknown>).adopter_last].filter(Boolean).join(" ") || "—"}
                        </td>
                        <td style={{ fontSize: 12 }}>{f.officer || f.created_by || "—"}</td>
                        <td style={{ fontSize: 12 }}>{f.created_at ? formatDate(f.created_at) : "—"}</td>
                        <td onClick={(e) => e.stopPropagation()}>
                          <ReprintFormButton form={f} personEmail={person.email} onNavigate={() => router.push(`/forms?id=${f.id}`)} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </CollapsibleSection>

            {/* ── Notes ────────────────────────────────────────────────── */}
            <CollapsibleSection title={`Notes (${notes.length})`} color="#475569">
              <div style={{ marginBottom: 14 }}>
                <textarea
                  className="form-textarea"
                  value={newNote}
                  onChange={(e) => setNewNote(e.target.value)}
                  placeholder="Add a note…"
                  rows={2}
                  style={{ marginBottom: 6 }}
                />
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <select className="form-select" value={noteType} onChange={(e) => setNoteType(e.target.value)} style={{ maxWidth: 160, fontSize: 12 }}>
                    {NOTE_TYPES.map((t) => <option key={t}>{t}</option>)}
                  </select>
                  <button className="btn btn-primary btn-sm" onClick={handleAddNote}>Add Note</button>
                </div>
              </div>
              {notes.length === 0 ? (
                <div style={{ color: "var(--text-muted)", textAlign: "center", padding: "12px 0" }}>No notes yet.</div>
              ) : notes.map((n) => (
                <div key={n.id} style={{ padding: "8px 0", borderBottom: "1px solid var(--border-light)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 2 }}>
                    <span className="badge" style={{ background: "#f1f5f9", color: "#475569" }}>{n.type}</span>
                    <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{n.date} {n.time}</span>
                  </div>
                  <div style={{ fontSize: 13 }}>{n.text}</div>
                </div>
              ))}
            </CollapsibleSection>

            {/* ── Receipts ─────────────────────────────────────────────── */}
            <CollapsibleSection title={`Receipts (${receipts.length})`} color="#059669" defaultOpen={false}>
              {receipts.length === 0 ? (
                <div style={{ color: "var(--text-muted)", textAlign: "center", padding: "12px 0" }}>No receipts linked to this person.</div>
              ) : (
                <table className="data-table">
                  <thead><tr><th>Receipt #</th><th>Date</th><th>Category</th><th>Payment</th><th>Total</th></tr></thead>
                  <tbody>
                    {receipts.map((r) => (
                      <tr key={r.id} style={{ cursor: "pointer" }} onClick={() => router.push(`/receipts?id=${r.id}`)}>

                        <td style={{ fontFamily: "monospace", fontSize: 12 }}>{r.id}</td>
                        <td style={{ fontSize: 12 }}>{r.date ? formatDate(r.date) : "—"}</td>
                        <td><span className="badge" style={{ background: "#d1fae5", color: "#059669" }}>{r.category}</span></td>
                        <td style={{ fontSize: 12 }}>{r.payment_method}</td>
                        <td style={{ fontWeight: 700, color: "#059669" }}>${r.total?.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </CollapsibleSection>

            {/* ── Pet Licenses ─────────────────────────────────────────── */}
            <CollapsibleSection title={`Pet Licenses (${personLicenses.length})`} color="#0f2942" defaultOpen={false}>
              {personLicenses.length === 0 ? (
                <div style={{ color: "var(--text-muted)", fontSize: 13, padding: "8px 0" }}>
                  No pet licenses linked to this person.{" "}
                  <a href="/pet-licenses" style={{ color: "var(--teal)", fontWeight: 700 }}>Go to License Registry →</a>
                </div>
              ) : (
                <table className="data-table">
                  <thead><tr><th>License #</th><th>Pet Name</th><th>Species</th><th>Issue Date</th><th>Expires</th><th>Status</th></tr></thead>
                  <tbody>
                    {personLicenses.map((lic) => {
                      const expired = lic.expiration_date && new Date(`${lic.expiration_date}T00:00:00`) < new Date();
                      return (
                        <tr key={lic.id}>
                          <td style={{ fontFamily: "monospace", fontWeight: 700, fontSize: 12 }}>{lic.license_number}</td>
                          <td style={{ fontSize: 12 }}>{lic.pet_name || "—"}</td>
                          <td style={{ fontSize: 12 }}>{lic.species || "—"}</td>
                          <td style={{ fontSize: 12 }}>{lic.issue_date || "—"}</td>
                          <td style={{ fontSize: 12, color: expired ? "#dc2626" : "inherit", fontWeight: expired ? 700 : 400 }}>{lic.expiration_date || "—"}</td>
                          <td><span style={{ fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 10, background: expired ? "#fee2e2" : "#dcfce7", color: expired ? "#b91c1c" : "#15803d" }}>{expired ? "Expired" : (lic.status ?? "Active")}</span></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </CollapsibleSection>

          </div>
        </div>
      </div>
    </AppShell>
  );
}
