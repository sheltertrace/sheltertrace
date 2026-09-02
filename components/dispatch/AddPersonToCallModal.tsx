"use client";
import { useState } from "react";
import type { Person, DispatchCallPerson } from "@/lib/types";
import { linkPersonToCall, updateCallPersonLink, createPerson, addPersonNote, findDuplicateCallPerson } from "@/lib/data";
import { CALL_PERSON_ROLES } from "@/lib/constants";
import { getCurrentUserName } from "@/lib/auth";
import DateInput from "@/components/ui/DateInput";
import PersonSearchRow from "./PersonSearchRow";

interface Props {
  callId: string;
  people: Person[];
  existingLinks: DispatchCallPerson[];
  initialRole?: string;
  lockRole?: boolean;
  editingLink?: DispatchCallPerson | null;
  onSaved: () => void;
  onClose: () => void;
}

export default function AddPersonToCallModal({ callId, people, existingLinks, initialRole, lockRole, editingLink, onSaved, onClose }: Props) {
  const editing = editingLink || null;
  const [personId, setPersonId] = useState(editing?.person_id || "");
  const [role, setRole] = useState(editing?.role || initialRole || CALL_PERSON_ROLES[0]);
  const [firstName, setFirstName] = useState(editing?.first_name || "");
  const [lastName, setLastName] = useState(editing?.last_name || "");
  const [phone, setPhone] = useState(editing?.phone || "");
  const [email, setEmail] = useState(editing?.email || "");
  const [address, setAddress] = useState(editing?.address || "");
  const [city, setCity] = useState(editing?.city || "");
  const [state, setState] = useState(editing?.state || "");
  const [zip, setZip] = useState(editing?.zip || "");
  const [dob, setDob] = useState(editing?.dob || "");
  const [dl, setDl] = useState(editing?.drivers_license || "");
  const [physicalDesc, setPhysicalDesc] = useState(editing?.physical_description || "");
  const [notes, setNotes] = useState(editing?.notes || "");
  const [saveToContacts, setSaveToContacts] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [duplicate, setDuplicate] = useState<DispatchCallPerson | null>(null);

  const handleSelectPerson = (p: Person) => {
    setPersonId(p.id);
    setFirstName(p.first_name);
    setLastName(p.last_name);
    setPhone(p.phone || "");
    setEmail(p.email || "");
    setAddress(p.address || "");
    setCity(p.city || "");
    setState(p.state || "");
    setZip(p.zip || "");
    setDob(p.dob || "");
    setDuplicate(null);
  };

  const handleClearPerson = () => {
    setPersonId("");
    setFirstName(""); setLastName(""); setPhone(""); setEmail(""); setAddress(""); setCity(""); setState(""); setZip(""); setDob("");
  };

  const handleSave = async () => {
    setError("");
    const candidateDup = findDuplicateCallPerson(
      existingLinks.filter((l) => l.id !== editing?.id),
      { first_name: firstName, last_name: lastName, phone, address }
    );
    if (candidateDup && !duplicate) {
      setDuplicate(candidateDup);
      return;
    }
    setSaving(true);
    try {
      let finalPersonId: string | null = personId || null;
      if (!finalPersonId && saveToContacts && (firstName || lastName)) {
        const created = await createPerson({ first_name: firstName, last_name: lastName, role, phone, email, address, city, state, zip, dob: dob || undefined });
        await addPersonNote(created.id, `Auto-added from dispatch call ${callId} as ${role}.`, "Dispatch");
        finalPersonId = created.id;
      }
      const payload = {
        dispatch_call_id: callId,
        person_id: finalPersonId,
        role,
        first_name: firstName || undefined,
        last_name: lastName || undefined,
        phone: phone || undefined,
        email: email || undefined,
        address: address || undefined,
        city: city || undefined,
        state: state || undefined,
        zip: zip || undefined,
        dob: dob || undefined,
        drivers_license: dl || undefined,
        physical_description: physicalDesc || undefined,
        notes: notes.trim() || undefined,
        skipped: false,
        added_by: getCurrentUserName(),
      };
      if (editing) {
        await updateCallPersonLink(editing.id, payload, getCurrentUserName());
      } else {
        await linkPersonToCall(payload);
      }
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save person");
    } finally {
      setSaving(false);
    }
  };

  const hasName = !!(firstName || lastName);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 560, width: "95vw", maxHeight: "85vh", overflow: "hidden", display: "flex", flexDirection: "column" }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <span className="modal-title">👤 {editing ? "Edit" : "Add"} {lockRole ? role : "Person"} on Call</span>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>✕</button>
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: "18px 20px" }}>
          {error && (
            <div style={{ background: "#fee2e2", border: "1px solid #fca5a5", borderRadius: 7, padding: "9px 13px", fontSize: 12, color: "#dc2626", marginBottom: 14 }}>
              ⚠️ {error}
            </div>
          )}
          {duplicate && (
            <div style={{ background: "#fef3c7", border: "1px solid #fbbf24", borderRadius: 7, padding: "9px 13px", fontSize: 12, color: "#92400e", marginBottom: 14 }}>
              ⚠️ {[duplicate.first_name, duplicate.last_name].filter(Boolean).join(" ") || "This person"} is already on this call as <strong>{duplicate.role}</strong> (matched by {duplicate.phone && duplicate.phone.replace(/\D/g, "") === phone.replace(/\D/g, "") && phone ? "phone" : "name + address"}). Click Save again to add anyway.
            </div>
          )}

          {!lockRole && (
            <div className="form-group">
              <label className="form-label">Role on This Call</label>
              <select className="form-select" value={role} onChange={(e) => setRole(e.target.value)}>
                {CALL_PERSON_ROLES.map((r) => <option key={r}>{r}</option>)}
              </select>
            </div>
          )}

          {!editing && (
            <PersonSearchRow people={people} selectedId={personId} onSelect={handleSelectPerson} onClear={handleClearPerson} />
          )}

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div className="form-group"><label className="form-label">First Name</label><input className="form-input" value={firstName} onChange={(e) => setFirstName(e.target.value)} /></div>
            <div className="form-group"><label className="form-label">Last Name</label><input className="form-input" value={lastName} onChange={(e) => setLastName(e.target.value)} /></div>
            <div className="form-group"><label className="form-label">Phone</label><input className="form-input" value={phone} onChange={(e) => setPhone(e.target.value)} /></div>
            <div className="form-group"><label className="form-label">Email</label><input className="form-input" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
            <div className="form-group" style={{ gridColumn: "1 / -1" }}><label className="form-label">Address</label><input className="form-input" value={address} onChange={(e) => setAddress(e.target.value)} /></div>
            <div className="form-group"><label className="form-label">City</label><input className="form-input" value={city} onChange={(e) => setCity(e.target.value)} /></div>
            <div className="form-group"><label className="form-label">State</label><input className="form-input" value={state} onChange={(e) => setState(e.target.value)} /></div>
            <div className="form-group"><label className="form-label">Zip</label><input className="form-input" value={zip} onChange={(e) => setZip(e.target.value)} /></div>
            <div className="form-group"><label className="form-label">Date of Birth</label><DateInput className="form-input" value={dob} onChange={(e) => setDob(e.target.value)} /></div>
            <div className="form-group"><label className="form-label">Driver&apos;s License #</label><input className="form-input" value={dl} onChange={(e) => setDl(e.target.value)} /></div>
            <div className="form-group" style={{ gridColumn: "1 / -1" }}><label className="form-label">Physical Description</label><input className="form-input" value={physicalDesc} onChange={(e) => setPhysicalDesc(e.target.value)} placeholder="Hair, eyes, height, weight…" /></div>
            <div className="form-group" style={{ gridColumn: "1 / -1" }}><label className="form-label">Notes</label><textarea className="form-textarea" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} /></div>
          </div>

          {!personId && hasName && (
            <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, cursor: "pointer", padding: "6px 0" }}>
              <input type="checkbox" checked={saveToContacts} onChange={(e) => setSaveToContacts(e.target.checked)} />
              Save to Contacts database (role: {role})
            </label>
          )}
        </div>

        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose} disabled={saving}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving || !hasName}>
            {saving ? "Saving…" : duplicate ? "⚠️ Add Anyway" : editing ? "✓ Save Changes" : "✓ Add to Call"}
          </button>
        </div>
      </div>
    </div>
  );
}
