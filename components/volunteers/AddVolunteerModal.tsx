"use client";
import { useState, useEffect } from "react";
import { createPerson, updatePerson, addPersonNote, genNextPid } from "@/lib/data";
import type { Person } from "@/lib/types";
import { today, nowTime } from "@/lib/utils";

interface Props {
  onClose: () => void;
  onSaved: (person: Person) => void;
  editPerson?: Person | null;
}

const STATES = ["AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA","HI","ID","IL","IN","IA","KS","KY","LA","ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ","NM","NY","NC","ND","OH","OK","OR","PA","RI","SC","SD","TN","TX","UT","VT","VA","WA","WV","WI","WY"];

function printBadge(person: Person) {
  const pid = person.pid || "—";
  const name = `${person.first_name} ${person.last_name}`;
  const barcodeUrl = `https://barcodeapi.org/api/128/${encodeURIComponent(pid)}`;
  const qrUrl = `https://quickchart.io/qr?text=${encodeURIComponent("https://sheltertrace.com/volunteer-clock")}&size=90&margin=1`;

  const html = `<!DOCTYPE html><html><head><title>Volunteer Badge — ${name}</title>
<style>
  @page { size: 3.375in 2.125in; margin: 0; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { width: 3.375in; height: 2.125in; font-family: Arial, sans-serif; overflow: hidden; }
  .badge {
    width: 3.375in; height: 2.125in;
    border: 2px solid #0f2942;
    border-radius: 10px;
    display: flex; flex-direction: column;
    align-items: center;
    background: #fff;
    padding: 8px 10px;
  }
  .agency { font-size: 8pt; font-weight: 900; color: #0f2942; text-transform: uppercase; letter-spacing: 0.5px; text-align: center; }
  .role-badge { background: #1a8a8a; color: #fff; font-size: 7pt; font-weight: 900; letter-spacing: 2px; padding: 2px 10px; border-radius: 10px; margin: 3px 0; }
  .name { font-size: 16pt; font-weight: 900; color: #0f2942; text-align: center; line-height: 1.1; margin: 2px 0; }
  .pid { font-size: 9pt; font-family: monospace; color: #1a8a8a; font-weight: 700; margin: 1px 0 3px; }
  .bottom { display: flex; align-items: flex-end; justify-content: space-between; width: 100%; margin-top: auto; gap: 6px; }
  .barcode img { max-height: 36px; max-width: 180px; }
  .qr img { width: 48px; height: 48px; }
  .qr-label { font-size: 5pt; color: #888; text-align: center; margin-top: 1px; }
</style></head>
<body>
<div class="badge">
  <div class="agency">Morgan County Animal Services</div>
  <div class="role-badge">VOLUNTEER</div>
  <div class="name">${name}</div>
  <div class="pid">${pid}</div>
  <div class="bottom">
    <div class="barcode"><img src="${barcodeUrl}" alt="${pid}" /></div>
    <div class="qr"><img src="${qrUrl}" alt="Clock In" /><div class="qr-label">Clock In</div></div>
  </div>
</div>
</body></html>`;

  const w = window.open("", "_blank", "width=400,height=320");
  if (!w) return;
  w.document.write(html);
  w.document.close();
  setTimeout(() => w.print(), 700);
}

export { printBadge };

export default function AddVolunteerModal({ onClose, onSaved, editPerson }: Props) {
  const isEdit = !!editPerson;

  const [pid, setPid] = useState(editPerson?.pid || "");
  const [pidLoading, setPidLoading] = useState(!isEdit);
  const [firstName, setFirstName] = useState(editPerson?.first_name || "");
  const [lastName, setLastName] = useState(editPerson?.last_name || "");
  const [phone, setPhone] = useState(editPerson?.phone || "");
  const [email, setEmail] = useState(editPerson?.email || "");
  const [address, setAddress] = useState(editPerson?.address || "");
  const [city, setCity] = useState(editPerson?.city || "");
  const [state, setState] = useState(editPerson?.state || "GA");
  const [zip, setZip] = useState(editPerson?.zip || "");
  const [ecName, setEcName] = useState(editPerson?.emergency_contact_name || "");
  const [ecPhone, setEcPhone] = useState(editPerson?.emergency_contact_phone || "");
  const [barcodeId, setBarcodeId] = useState(editPerson?.barcode_id || "");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const [created, setCreated] = useState<Person | null>(null);

  useEffect(() => {
    if (!isEdit) {
      genNextPid().then((p) => { setPid(p); setPidLoading(false); });
    }
  }, [isEdit]);

  const handleSave = async () => {
    if (!firstName.trim() || !lastName.trim()) {
      setErr("First name and last name are required.");
      return;
    }
    setSaving(true);
    setErr("");
    try {
      const payload: Partial<Person> = {
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        role: editPerson?.role || "Volunteer",
        phone: phone.trim() || undefined,
        email: email.trim() || undefined,
        address: address.trim() || undefined,
        city: city.trim() || undefined,
        state: state || undefined,
        zip: zip.trim() || undefined,
        emergency_contact_name: ecName.trim() || undefined,
        emergency_contact_phone: ecPhone.trim() || undefined,
        barcode_id: barcodeId.trim() || undefined,
        ...(!isEdit ? { pid } : {}),
      };

      let saved: Person;
      if (isEdit && editPerson) {
        saved = await updatePerson(editPerson.id, payload);
      } else {
        saved = await createPerson(payload);
      }

      if (notes.trim() && !isEdit) {
        await addPersonNote(saved.id, notes.trim(), "General");
      }

      if (isEdit) {
        onSaved(saved);
      } else {
        setCreated(saved);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setErr(`Save failed: ${msg}`);
    } finally {
      setSaving(false);
    }
  };

  // ── Success screen after creation ────────────────────────────────────────
  if (created) {
    return (
      <div className="modal-overlay">
        <div className="modal" style={{ maxWidth: 480 }}>
          <div style={{ padding: "32px 28px", textAlign: "center" }}>
            <div style={{ fontSize: 56, marginBottom: 12 }}>✅</div>
            <div style={{ fontSize: 22, fontWeight: 900, color: "#15803d", marginBottom: 4 }}>Volunteer Created!</div>
            <div style={{ fontSize: 15, color: "var(--text-secondary)", marginBottom: 20 }}>
              {created.first_name} {created.last_name} has been registered.
            </div>

            <div style={{ background: "#f0fdf4", border: "2px solid #86efac", borderRadius: 12, padding: "16px 20px", marginBottom: 20 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#15803d", textTransform: "uppercase", letterSpacing: 1, marginBottom: 6 }}>Assigned Volunteer ID</div>
              <div style={{ fontSize: 34, fontWeight: 900, fontFamily: "monospace", color: "#0f2942", letterSpacing: 3 }}>{created.pid}</div>
              <div style={{ fontSize: 12, color: "#6b7280", marginTop: 4 }}>Write this on their ID card or print a badge below</div>
            </div>

            <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
              <button
                className="btn btn-primary"
                onClick={() => printBadge(created)}
              >
                🖨 Print Volunteer Badge
              </button>
              <button
                className="btn btn-secondary"
                onClick={() => {
                  setCreated(null);
                  setFirstName(""); setLastName(""); setPhone(""); setEmail("");
                  setAddress(""); setCity(""); setState("GA"); setZip("");
                  setEcName(""); setEcPhone(""); setBarcodeId(""); setNotes("");
                  setPidLoading(true);
                  genNextPid().then((p) => { setPid(p); setPidLoading(false); });
                }}
              >
                + Add Another
              </button>
              <button className="btn btn-ghost" onClick={() => { onSaved(created); }}>
                Done
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── Form ─────────────────────────────────────────────────────────────────
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 600 }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <span className="modal-title">{isEdit ? "Edit Volunteer" : "Add New Volunteer"}</span>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>✕</button>
        </div>

        <div className="modal-body" style={{ maxHeight: "70vh", overflowY: "auto" }}>
          {/* PID display (add mode only) */}
          {!isEdit && (
            <div style={{ background: "#f0f9ff", border: "1px solid #bae6fd", borderRadius: 10, padding: "10px 16px", marginBottom: 18, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: "#0369a1", textTransform: "uppercase", letterSpacing: 1 }}>Auto-Assigned Volunteer ID</div>
                <div style={{ fontSize: 22, fontWeight: 900, fontFamily: "monospace", color: "#0f2942", letterSpacing: 2 }}>
                  {pidLoading ? "Generating…" : pid}
                </div>
              </div>
              <div style={{ fontSize: 11, color: "#6b7280", maxWidth: 160, textAlign: "right" }}>
                This ID will be printed on their badge and used to clock in
              </div>
            </div>
          )}

          {/* Name row */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">First Name <span style={{ color: "#ef4444" }}>*</span></label>
              <input className="form-input" value={firstName} onChange={(e) => setFirstName(e.target.value)} autoFocus />
            </div>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Last Name <span style={{ color: "#ef4444" }}>*</span></label>
              <input className="form-input" value={lastName} onChange={(e) => setLastName(e.target.value)} />
            </div>
          </div>

          {/* Contact row */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Phone</label>
              <input className="form-input" value={phone} onChange={(e) => setPhone(e.target.value)} type="tel" />
            </div>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Email</label>
              <input className="form-input" value={email} onChange={(e) => setEmail(e.target.value)} type="email" />
            </div>
          </div>

          {/* Address */}
          <div className="form-group" style={{ marginBottom: 8 }}>
            <label className="form-label">Street Address</label>
            <input className="form-input" value={address} onChange={(e) => setAddress(e.target.value)} />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr", gap: 10, marginBottom: 14 }}>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">City</label>
              <input className="form-input" value={city} onChange={(e) => setCity(e.target.value)} />
            </div>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">State</label>
              <select className="form-select" value={state} onChange={(e) => setState(e.target.value)}>
                {STATES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Zip</label>
              <input className="form-input" value={zip} onChange={(e) => setZip(e.target.value)} />
            </div>
          </div>

          {/* Emergency contact */}
          <div style={{ borderTop: "1px solid var(--border)", paddingTop: 14, marginBottom: 14 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 10 }}>Emergency Contact</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">Contact Name</label>
                <input className="form-input" value={ecName} onChange={(e) => setEcName(e.target.value)} />
              </div>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">Contact Phone</label>
                <input className="form-input" value={ecPhone} onChange={(e) => setEcPhone(e.target.value)} type="tel" />
              </div>
            </div>
          </div>

          {/* Badge / ID fields */}
          <div style={{ borderTop: "1px solid var(--border)", paddingTop: 14, marginBottom: 14 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 10 }}>Badge / ID</div>
            <div style={{ display: "grid", gridTemplateColumns: isEdit ? "1fr 1fr" : "1fr 1fr", gap: 12 }}>
              {isEdit && (
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Volunteer ID (PID)</label>
                  <input className="form-input" value={editPerson?.pid || ""} readOnly style={{ background: "#f1f5f9", fontFamily: "monospace", fontWeight: 700 }} />
                </div>
              )}
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">Barcode ID <span style={{ color: "var(--text-muted)", fontWeight: 400 }}>(optional)</span></label>
                <input className="form-input" value={barcodeId} onChange={(e) => setBarcodeId(e.target.value)} placeholder="For printed badge scanner" style={{ fontFamily: "monospace" }} />
              </div>
            </div>
          </div>

          {/* Notes (add mode only) */}
          {!isEdit && (
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Notes</label>
              <textarea className="form-textarea" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Any notes about this volunteer…" />
            </div>
          )}

          {err && (
            <div style={{ marginTop: 12, background: "#fef2f2", border: "1px solid #fca5a5", borderRadius: 8, padding: "8px 12px", fontSize: 13, color: "#b91c1c" }}>
              {err}
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving || pidLoading}>
            {saving ? "Saving…" : isEdit ? "Save Changes" : "Create Volunteer"}
          </button>
        </div>
      </div>
    </div>
  );
}
