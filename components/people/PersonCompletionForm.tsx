"use client";
import { useState } from "react";
import type { Person } from "@/lib/types";
import { createPerson, updatePerson, uploadPersonPhotoId, findDuplicatePerson } from "@/lib/data";
import { ID_TYPES, STATES } from "@/lib/constants";
import DateInput from "@/components/ui/DateInput";
import { validateDeparturePerson } from "@/lib/personValidation";
import ScanLicenseButton from "@/components/ui/ScanLicenseButton";

interface Props {
  person: Person | null; // null = creating a brand new record
  roleForNew: string; // e.g. "Adopter" or "Previous Owner"
  onSaved: (p: Person) => void;
  onCancel: () => void;
}

// Shared inline "complete this person's record" form — used both when
// creating a brand-new adopter/owner and when an existing matched person is
// missing required fields. A new person is created on first Save (even if
// still incomplete) so the photo-ID upload control has a record to attach
// to; the same form then keeps editing that record until validation passes.
export default function PersonCompletionForm({ person, roleForNew, onSaved, onCancel }: Props) {
  const [savedPerson, setSavedPerson] = useState<Person | null>(person);
  const [firstName, setFirstName] = useState(person?.first_name || "");
  const [middleName, setMiddleName] = useState(person?.middle_name || "");
  const [lastName, setLastName] = useState(person?.last_name || "");
  const [phone, setPhone] = useState(person?.phone || "");
  const [email, setEmail] = useState(person?.email || "");
  const [address, setAddress] = useState(person?.address || "");
  const [city, setCity] = useState(person?.city || "");
  const [state, setState] = useState(person?.state || "GA");
  const [zip, setZip] = useState(person?.zip || "");
  const [dob, setDob] = useState(person?.dob || "");
  const [idType, setIdType] = useState(person?.id_type || "Driver's License");
  const [idNumber, setIdNumber] = useState(person?.id_number || "");
  const [idState, setIdState] = useState(person?.id_state || "GA");
  const [emergencyName, setEmergencyName] = useState(person?.emergency_contact_name || "");
  const [emergencyPhone, setEmergencyPhone] = useState(person?.emergency_contact_phone || "");
  const [saving, setSaving] = useState(false);
  const [uploadingId, setUploadingId] = useState(false);
  const [error, setError] = useState("");
  const [duplicate, setDuplicate] = useState<Person | null>(null);
  const [bypassDuplicateCheck, setBypassDuplicateCheck] = useState(false);

  const draft: Person = {
    ...(savedPerson || ({} as Person)),
    first_name: firstName, middle_name: middleName || undefined, last_name: lastName,
    phone, email, address, city, state, zip, dob,
    id_type: idType, id_number: idNumber, id_state: idState,
    emergency_contact_name: emergencyName, emergency_contact_phone: emergencyPhone,
  };
  const remaining = validateDeparturePerson(draft);

  const handleSave = async () => {
    setError("");
    if (!savedPerson?.id && !bypassDuplicateCheck) {
      const dup = await findDuplicatePerson(phone, email, idNumber);
      if (dup) { setDuplicate(dup); return; }
    }
    setSaving(true);
    try {
      const fields: Partial<Person> = {
        first_name: firstName.trim(), middle_name: middleName.trim() || undefined, last_name: lastName.trim(),
        phone: phone.trim() || undefined, email: email.trim() || undefined,
        address: address.trim() || undefined, city: city.trim() || undefined, state: state || undefined, zip: zip.trim() || undefined,
        dob: dob || undefined, id_type: idType || undefined, id_number: idNumber.trim() || undefined, id_state: idState || undefined,
        emergency_contact_name: emergencyName.trim() || undefined, emergency_contact_phone: emergencyPhone.trim() || undefined,
      };
      const result = savedPerson?.id ? await updatePerson(savedPerson.id, fields) : await createPerson({ ...fields, role: roleForNew });
      setSavedPerson(result);
      onSaved(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save person");
    } finally {
      setSaving(false);
    }
  };

  const handleUploadId = async (file: File) => {
    if (!savedPerson?.id) return;
    setUploadingId(true);
    setError("");
    try {
      const url = await uploadPersonPhotoId(savedPerson.id, file);
      const updated = { ...savedPerson, photo_id_url: url };
      setSavedPerson(updated);
      onSaved(updated);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to upload photo ID");
    } finally {
      setUploadingId(false);
    }
  };

  const req = (ok: boolean) => <span style={{ color: ok ? "#16a34a" : "#dc2626", marginLeft: 2 }}>{ok ? "✓" : "*"}</span>;

  return (
    <div style={{ background: "#f8fafc", border: "1px solid var(--border)", borderRadius: 8, padding: "14px 16px" }}>
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 10 }}>
        <ScanLicenseButton
          label="📷 Scan License"
          onScan={(d) => {
            if (d.firstName) setFirstName(d.firstName);
            if (d.middleName) setMiddleName(d.middleName);
            if (d.lastName) setLastName(d.lastName);
            if (d.address) setAddress(d.address);
            if (d.city) setCity(d.city);
            if (d.state) setState(d.state);
            if (d.zip) setZip(d.zip);
            if (d.dob) setDob(d.dob);
            if (d.licenseNumber) setIdNumber(d.licenseNumber);
            if (d.idState) setIdState(d.idState);
            setIdType("Driver's License");
          }}
        />
      </div>
      {error && (
        <div style={{ background: "#fee2e2", border: "1px solid #fca5a5", borderRadius: 7, padding: "8px 12px", fontSize: 12, color: "#dc2626", marginBottom: 12 }}>
          ⚠️ {error}
        </div>
      )}
      {duplicate && (
        <div style={{ background: "#fef3c7", border: "1px solid #fbbf24", borderRadius: 7, padding: "9px 13px", fontSize: 12, color: "#92400e", marginBottom: 12 }}>
          A person matching this phone, email, or ID# already exists: <strong>{duplicate.first_name} {duplicate.last_name}</strong> ({duplicate.pid}). Use this record instead of creating a duplicate?
          <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
            <button className="btn btn-primary btn-sm" onClick={() => onSaved(duplicate)}>Use Existing Record</button>
            <button className="btn btn-secondary btn-sm" onClick={() => { setBypassDuplicateCheck(true); setDuplicate(null); }}>Create New Anyway</button>
          </div>
        </div>
      )}
      {savedPerson?.id && remaining.length > 0 && (
        <div style={{ background: "#fef3c7", border: "1px solid #fbbf24", borderRadius: 7, padding: "8px 12px", fontSize: 12, color: "#92400e", marginBottom: 12 }}>
          Still needed: {remaining.join(" ")}
        </div>
      )}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <div className="form-group"><label className="form-label">First Name{req(!!firstName.trim())}</label><input className="form-input" value={firstName} onChange={(e) => setFirstName(e.target.value)} /></div>
        <div className="form-group"><label className="form-label">Middle Name</label><input className="form-input" value={middleName} onChange={(e) => setMiddleName(e.target.value)} /></div>
        <div className="form-group"><label className="form-label">Last Name{req(!!lastName.trim())}</label><input className="form-input" value={lastName} onChange={(e) => setLastName(e.target.value)} /></div>
        <div className="form-group"><label className="form-label">Phone{req(!!phone.trim())}</label><input className="form-input" value={phone} onChange={(e) => setPhone(e.target.value)} /></div>
        <div className="form-group"><label className="form-label">Email</label><input className="form-input" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
        <div className="form-group"><label className="form-label">Date of Birth</label><DateInput className="form-input" value={dob} onChange={(e) => setDob(e.target.value)} /></div>
        <div className="form-group" style={{ gridColumn: "1 / -1" }}><label className="form-label">Address{req(!!address.trim())}</label><input className="form-input" value={address} onChange={(e) => setAddress(e.target.value)} /></div>
        <div className="form-group"><label className="form-label">City{req(!!city.trim())}</label><input className="form-input" value={city} onChange={(e) => setCity(e.target.value)} /></div>
        <div className="form-group"><label className="form-label">State{req(!!state.trim())}</label>
          <select className="form-select" value={state} onChange={(e) => setState(e.target.value)}>
            {STATES.map((s) => <option key={s}>{s}</option>)}
          </select>
        </div>
        <div className="form-group"><label className="form-label">Zip{req(!!zip.trim())}</label><input className="form-input" value={zip} onChange={(e) => setZip(e.target.value)} /></div>
        <div className="form-group"><label className="form-label">ID Type</label>
          <select className="form-select" value={idType} onChange={(e) => setIdType(e.target.value)}>
            {ID_TYPES.map((t) => <option key={t}>{t}</option>)}
          </select>
        </div>
        <div className="form-group"><label className="form-label">ID / Driver&apos;s License #{req(!!idNumber.trim() || !!savedPerson?.photo_id_url)}</label><input className="form-input" value={idNumber} onChange={(e) => setIdNumber(e.target.value)} /></div>
        <div className="form-group"><label className="form-label">ID State</label>
          <select className="form-select" value={idState} onChange={(e) => setIdState(e.target.value)}>
            {STATES.map((s) => <option key={s}>{s}</option>)}
          </select>
        </div>
        <div className="form-group"><label className="form-label">Emergency Contact Name</label><input className="form-input" value={emergencyName} onChange={(e) => setEmergencyName(e.target.value)} /></div>
        <div className="form-group"><label className="form-label">Emergency Contact Phone</label><input className="form-input" value={emergencyPhone} onChange={(e) => setEmergencyPhone(e.target.value)} /></div>
      </div>

      {savedPerson?.id && (
        <div className="form-group">
          <label className="form-label">Photo ID{req(!!idNumber.trim() || !!savedPerson.photo_id_url)}</label>
          {savedPerson.photo_id_url ? (
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <img src={savedPerson.photo_id_url} alt="Photo ID" style={{ width: 60, height: 40, objectFit: "cover", borderRadius: 4, border: "1px solid var(--border)" }} />
              <span style={{ fontSize: 12, color: "#16a34a", fontWeight: 700 }}>✓ Uploaded</span>
              <label className="btn btn-ghost btn-sm" style={{ cursor: "pointer" }}>
                Replace
                <input type="file" accept="image/*" style={{ display: "none" }} onChange={(e) => e.target.files?.[0] && handleUploadId(e.target.files[0])} />
              </label>
            </div>
          ) : (
            <label className="btn btn-secondary btn-sm" style={{ cursor: "pointer", display: "inline-block" }}>
              {uploadingId ? "Uploading…" : "📷 Upload Photo ID"}
              <input type="file" accept="image/*" style={{ display: "none" }} disabled={uploadingId} onChange={(e) => e.target.files?.[0] && handleUploadId(e.target.files[0])} />
            </label>
          )}
        </div>
      )}

      <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
        <button className="btn btn-secondary" onClick={onCancel} disabled={saving}>Cancel</button>
        <button className="btn btn-primary" onClick={handleSave} disabled={saving || !firstName.trim() || !lastName.trim()}>
          {saving ? "Saving…" : savedPerson?.id ? "✓ Save Changes" : "✓ Create & Continue"}
        </button>
      </div>
    </div>
  );
}
