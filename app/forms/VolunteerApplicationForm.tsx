"use client";
import { useState, useEffect, useMemo } from "react";
import { createForm, fetchPeople } from "@/lib/data";
import { today } from "@/lib/utils";
import { useAuth } from "@/app/providers";
import type { ShelterForm, Person, FormPreFill } from "@/lib/types";
import DateInput from "@/components/ui/DateInput";
import { AGENCY_NAME, AGENCY_SHORT, AGENCY_ADDRESS, AGENCY_PHONE, AGENCY_PHONE_DOTS, COUNTY_NAME, COUNTY_STATE } from "@/lib/shelterInfo";

const MCAS_BLUE = "#0f2942";

interface Props {
  onSave: (form: ShelterForm) => void;
  onClose: () => void;
  prefill?: FormPreFill;
}

function calcAge(dob: string): string {
  if (!dob) return "";
  const birth = new Date(dob + "T12:00");
  const now = new Date();
  const y = now.getFullYear() - birth.getFullYear();
  const m = now.getMonth() - birth.getMonth();
  return String(m < 0 || (m === 0 && now.getDate() < birth.getDate()) ? y - 1 : y);
}

export function printVolunteerApplication(d: Record<string, unknown>) {
  const w = window.open("", "_blank", "width=760,height=1060");
  if (!w) return;
  const blue = MCAS_BLUE;
  const fl = (label: string, val: unknown, minW = 160) =>
    `<div style="display:inline-flex;flex-direction:column;gap:1px;margin-right:14px;margin-bottom:8px">
      <div style="border-bottom:1px solid #000;min-width:${minW}px;padding-bottom:2px;font-size:10px">${val || "&nbsp;"}</div>
      <div style="font-size:8.5px;color:#555">${label}</div>
    </div>`;
  const sh = (title: string) =>
    `<div style="background:${blue};color:#fff;padding:4px 10px;font-size:10px;font-weight:700;text-transform:uppercase;margin:12px 0 7px;letter-spacing:.5px">${title}</div>`;
  const radio = (label: string, val: unknown) =>
    `<span style="margin-right:14px;font-size:10px"><span style="display:inline-block;width:11px;height:11px;border:1px solid #000;border-radius:50%;margin-right:3px;vertical-align:middle;background:${val === label ? "#000" : "#fff"}"></span>${label}</span>`;
  const cb = (label: string, checked: boolean) =>
    `<span style="margin-right:14px;font-size:10px"><span style="display:inline-block;width:11px;height:11px;border:1px solid #000;margin-right:3px;vertical-align:middle;background:${checked ? "#000" : "#fff"}"></span>${label}</span>`;
  const ta = (label: string, val: unknown) =>
    `<div style="margin-bottom:10px">
      <div style="font-size:8.5px;color:#555;margin-bottom:2px">${label}</div>
      <div style="border:1px solid #ccc;min-height:38px;padding:4px 6px;font-size:10px;background:#fafafa">${val || "&nbsp;"}</div>
    </div>`;
  const prefs = (d.animal_preference as string[] | undefined) || [];
  w.document.write(`<html><head><title>Volunteer Application</title>
  <style>*{-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important;color-adjust:exact!important;}body{font-family:Arial,sans-serif;font-size:10px;padding:22px;margin:0;line-height:1.5}
  h1{font-size:15px;font-weight:900;color:${blue};margin:0 0 2px;text-transform:uppercase}
  .sub{font-size:9px;color:#444;margin-bottom:12px}
  @media print{body{padding:14px}}</style></head><body>
  <h1>Volunteer Application</h1>
  <div class="sub">${AGENCY_NAME} · ${AGENCY_ADDRESS} · ${AGENCY_PHONE} · Date: ${d.application_date as string || ""}</div>
  ${sh("Personal Information")}
  <div>${fl("First Name", d.first_name)}${fl("Last Name", d.last_name)}${fl("Date of Birth", d.dob)}${fl("Age", d.age, 60)}</div>
  <div>${fl("Street Address", d.address, 240)}${fl("City", d.city, 120)}${fl("State", d.state, 40)}${fl("Zip", d.zip, 70)}</div>
  <div>${fl("Best Contact Number", d.phone, 160)}${fl("Email", d.email, 200)}</div>
  ${sh("Emergency Contact")}
  <div>${fl("Emergency Contact Name", d.emergency_name, 200)}${fl("Relationship", d.emergency_relationship, 140)}</div>
  <div>${fl("Emergency Phone", d.emergency_phone)}${fl("Emergency Cell", d.emergency_cell)}</div>
  ${sh("Background")}
  <div style="margin-bottom:6px"><strong style="font-size:10px">Valid Unrestricted Driver's License?</strong> &nbsp; ${radio("Yes", d.drivers_license)}${radio("No", d.drivers_license)}</div>
  <div style="margin-bottom:6px"><strong style="font-size:10px">Have you been convicted of a felony?</strong> &nbsp; ${radio("Yes", d.felony_conviction)}${radio("No", d.felony_conviction)}</div>
  ${d.felony_conviction === "Yes" ? `<div style="margin-bottom:8px">${fl("Felony Details", d.felony_details, 400)}</div>` : ""}
  ${sh("Volunteer Information")}
  ${ta("Why are you interested in volunteering at ${AGENCY_SHORT}?", d.why_volunteer)}
  ${ta("Previous animal experience (pets, work, etc.)", d.animal_experience)}
  ${ta("Certifications, licenses, or relevant degrees", d.certifications)}
  ${ta("Allergies or physical/mental limitations", d.limitations)}
  <div style="margin-bottom:8px"><strong style="font-size:10px">Animal Preference:</strong> &nbsp;
    ${cb("Dogs", prefs.includes("Dogs"))}${cb("Cats", prefs.includes("Cats"))}${cb("Both", prefs.includes("Both"))}
  </div>
  ${ta("What would you like to do as a volunteer?", d.volunteer_tasks)}
  ${ta("Any fears, allergies, or medical limitations preventing participation?", d.participation_limits)}
  <div style="margin-bottom:6px">${fl("Last Tetanus Vaccination Date", d.tetanus_date, 200)}</div>
  ${sh("Office Use Only")}
  <div>${fl("Processed By", d.processed_by)}${fl("Date", d.application_date)}</div>
  </body></html>`);
  w.document.close();
  setTimeout(() => w.print(), 400);
}

export default function VolunteerApplicationForm({ onSave, onClose, prefill }: Props) {
  const { user } = useAuth();
  const [saving, setSaving] = useState(false);

  // Person search
  const [people, setPeople] = useState<Person[]>([]);
  const [personQuery, setPersonQuery] = useState("");
  const [selectedPerson, setSelectedPerson] = useState<Person | null>(null);

  // Personal info
  const [firstName, setFirstName] = useState(prefill?.person_first || "");
  const [lastName, setLastName] = useState(prefill?.person_last || "");
  const [dob, setDob] = useState("");
  const [address, setAddress] = useState(prefill?.person_address || "");
  const [city, setCity] = useState(prefill?.person_city || "");
  const [state, setState] = useState(prefill?.person_state || "GA");
  const [zip, setZip] = useState(prefill?.person_zip || "");
  const [phone, setPhone] = useState(prefill?.person_phone || "");
  const [email, setEmail] = useState(prefill?.person_email || "");

  // Emergency contact
  const [emergencyName, setEmergencyName] = useState("");
  const [emergencyRel, setEmergencyRel] = useState("");
  const [emergencyPhone, setEmergencyPhone] = useState("");
  const [emergencyCell, setEmergencyCell] = useState("");

  // Background
  const [driversLicense, setDriversLicense] = useState("");
  const [felonyConviction, setFelonyConviction] = useState("");
  const [felonyDetails, setFelonyDetails] = useState("");

  // Volunteer info
  const [whyVolunteer, setWhyVolunteer] = useState("");
  const [animalExperience, setAnimalExperience] = useState("");
  const [certifications, setCertifications] = useState("");
  const [limitations, setLimitations] = useState("");
  const [animalPreference, setAnimalPreference] = useState<string[]>([]);
  const [volunteerTasks, setVolunteerTasks] = useState("");
  const [participationLimits, setParticipationLimits] = useState("");
  const [tetanusDate, setTetanusDate] = useState("");

  const [applicationDate, setApplicationDate] = useState(today());
  const [processedBy, setProcessedBy] = useState(user ? `${user.firstName} ${user.lastName}`.trim() : "");

  const age = useMemo(() => calcAge(dob), [dob]);

  useEffect(() => {
    fetchPeople().then((ps) => {
      setPeople(ps);
      if (prefill?.person_id) {
        const p = ps.find((x) => x.id === prefill.person_id);
        if (p) selectPerson(p);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const personResults = useMemo(() => {
    if (personQuery.trim().length < 2) return [];
    const q = personQuery.toLowerCase();
    return people.filter((p) =>
      `${p.first_name} ${p.last_name}`.toLowerCase().includes(q) ||
      (p.pid || "").toLowerCase().includes(q) ||
      (p.phone || "").includes(q)
    ).slice(0, 8);
  }, [personQuery, people]);

  function selectPerson(p: Person) {
    setSelectedPerson(p);
    setPersonQuery(`${p.first_name} ${p.last_name}`);
    setFirstName(p.first_name);
    setLastName(p.last_name);
    setAddress(p.address || "");
    setCity(p.city || "");
    setState(p.state || "GA");
    setZip(p.zip || "");
    setPhone(p.phone || "");
    setEmail(p.email || "");
    if (p.dob) setDob(p.dob);
  }

  function togglePref(pref: string) {
    setAnimalPreference((prev) =>
      prev.includes(pref) ? prev.filter((x) => x !== pref) : [...prev, pref]
    );
  }

  const buildFormData = (): Record<string, unknown> => ({
    application_date: applicationDate,
    first_name: firstName, last_name: lastName, dob, age,
    address, city, state, zip, phone, email,
    emergency_name: emergencyName, emergency_relationship: emergencyRel,
    emergency_phone: emergencyPhone, emergency_cell: emergencyCell,
    drivers_license: driversLicense, felony_conviction: felonyConviction, felony_details: felonyDetails,
    why_volunteer: whyVolunteer, animal_experience: animalExperience,
    certifications, limitations, animal_preference: animalPreference,
    volunteer_tasks: volunteerTasks, participation_limits: participationLimits,
    tetanus_date: tetanusDate, processed_by: processedBy,
  });

  const handleSave = async () => {
    setSaving(true);
    try {
      const saved = await createForm({
        form_type: "volunteer_application",
        form_data: buildFormData(),
        linked_person_id: selectedPerson?.id || prefill?.person_id,
        status: "completed",
        officer: processedBy,
        created_by: user?.username || processedBy,
      });
      onSave(saved);
    } catch (e: unknown) {
      alert(`Failed to save: ${(e as Error).message}`);
    } finally { setSaving(false); }
  };

  const labelStyle: React.CSSProperties = { fontSize: 11, fontWeight: 700, color: "var(--text-secondary)", marginBottom: 3, display: "block" };
  const fieldStyle: React.CSSProperties = { width: "100%", padding: "6px 9px", border: "1px solid var(--border)", borderRadius: 5, fontSize: 13, background: "var(--surface)" };
  const sectionHead: React.CSSProperties = { background: MCAS_BLUE, color: "#fff", padding: "5px 12px", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, borderRadius: 4, margin: "18px 0 10px" };
  const taStyle: React.CSSProperties = { ...fieldStyle, minHeight: 72, resize: "vertical" };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal-xl" onClick={(e) => e.stopPropagation()} style={{ maxHeight: "95vh" }}>
        <div className="modal-header">
          <div>
            <div className="modal-title">🐾 Volunteer Application</div>
            <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 2 }}>${AGENCY_NAME}</div>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>✕</button>
        </div>

        <div className="modal-body" style={{ overflowY: "auto" }}>

          {/* Person search */}
          <div style={{ marginBottom: 16, padding: "12px 14px", background: "#f0f9ff", border: "1px solid #bae6fd", borderRadius: 7 }}>
            <label style={{ ...labelStyle, color: "#0369a1" }}>Link to Person Record</label>
            {selectedPerson ? (
              <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13 }}>
                <span style={{ flex: 1 }}>✓ <strong>{selectedPerson.first_name} {selectedPerson.last_name}</strong> · {selectedPerson.pid} · {selectedPerson.phone || "no phone"}</span>
                <button className="btn btn-ghost btn-sm" style={{ fontSize: 11 }} onClick={() => { setSelectedPerson(null); setPersonQuery(""); }}>Change</button>
              </div>
            ) : (
              <div style={{ position: "relative" }}>
                <input
                  className="form-input"
                  placeholder="Search by name, PID, or phone…"
                  value={personQuery}
                  onChange={(e) => setPersonQuery(e.target.value)}
                />
                {personResults.length > 0 && (
                  <div style={{ position: "absolute", top: "100%", left: 0, right: 0, background: "#fff", border: "1px solid var(--border)", borderRadius: "0 0 6px 6px", zIndex: 200, boxShadow: "0 4px 12px rgba(0,0,0,.1)", maxHeight: 200, overflowY: "auto" }}>
                    {personResults.map((p) => (
                      <div key={p.id} onClick={() => selectPerson(p)}
                        style={{ padding: "8px 12px", cursor: "pointer", fontSize: 13, borderBottom: "1px solid var(--border-light)" }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = "#f8fafc")}
                        onMouseLeave={(e) => (e.currentTarget.style.background = "#fff")}>
                        <strong>{p.first_name} {p.last_name}</strong>
                        <span style={{ color: "var(--text-secondary)", marginLeft: 8 }}>{p.phone}</span>
                        <span style={{ color: "var(--text-muted)", marginLeft: 8, fontSize: 11 }}>{p.pid} · {p.role}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Personal info */}
          <div style={sectionHead}>Personal Information</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 140px 80px", gap: 10, marginBottom: 12 }}>
            <div><label style={labelStyle}>First Name *</label><input style={fieldStyle} value={firstName} onChange={(e) => setFirstName(e.target.value)} /></div>
            <div><label style={labelStyle}>Last Name *</label><input style={fieldStyle} value={lastName} onChange={(e) => setLastName(e.target.value)} /></div>
            <div><label style={labelStyle}>Date of Birth</label><DateInput style={fieldStyle} value={dob} onChange={(e) => setDob(e.target.value)} /></div>
            <div><label style={labelStyle}>Age</label><input style={{ ...fieldStyle, background: "var(--surface-alt)" }} value={age} readOnly /></div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 60px 80px", gap: 10, marginBottom: 12 }}>
            <div><label style={labelStyle}>Street Address</label><input style={fieldStyle} value={address} onChange={(e) => setAddress(e.target.value)} /></div>
            <div><label style={labelStyle}>City</label><input style={fieldStyle} value={city} onChange={(e) => setCity(e.target.value)} /></div>
            <div><label style={labelStyle}>State</label><input style={fieldStyle} value={state} onChange={(e) => setState(e.target.value)} /></div>
            <div><label style={labelStyle}>Zip</label><input style={fieldStyle} value={zip} onChange={(e) => setZip(e.target.value)} /></div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 12 }}>
            <div><label style={labelStyle}>Best Contact Number</label><input style={fieldStyle} value={phone} onChange={(e) => setPhone(e.target.value)} /></div>
            <div><label style={labelStyle}>Email</label><input style={fieldStyle} type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
          </div>

          {/* Emergency contact */}
          <div style={sectionHead}>Emergency Contact</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 12 }}>
            <div><label style={labelStyle}>Emergency Contact Name</label><input style={fieldStyle} value={emergencyName} onChange={(e) => setEmergencyName(e.target.value)} /></div>
            <div><label style={labelStyle}>Relationship</label><input style={fieldStyle} value={emergencyRel} onChange={(e) => setEmergencyRel(e.target.value)} /></div>
            <div><label style={labelStyle}>Emergency Phone</label><input style={fieldStyle} value={emergencyPhone} onChange={(e) => setEmergencyPhone(e.target.value)} /></div>
            <div><label style={labelStyle}>Cell</label><input style={fieldStyle} value={emergencyCell} onChange={(e) => setEmergencyCell(e.target.value)} /></div>
          </div>

          {/* Background */}
          <div style={sectionHead}>Background Information</div>
          <div style={{ marginBottom: 12 }}>
            <label style={labelStyle}>Valid Unrestricted Driver&apos;s License?</label>
            <div style={{ display: "flex", gap: 20 }}>
              {["Yes", "No"].map((v) => (
                <label key={v} style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", fontSize: 14 }}>
                  <input type="radio" name="driversLicense" value={v} checked={driversLicense === v} onChange={() => setDriversLicense(v)} />
                  {v}
                </label>
              ))}
            </div>
          </div>
          <div style={{ marginBottom: 12 }}>
            <label style={labelStyle}>Have you been convicted of a felony?</label>
            <div style={{ display: "flex", gap: 20 }}>
              {["Yes", "No"].map((v) => (
                <label key={v} style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", fontSize: 14 }}>
                  <input type="radio" name="felony" value={v} checked={felonyConviction === v} onChange={() => setFelonyConviction(v)} />
                  {v}
                </label>
              ))}
            </div>
          </div>
          {felonyConviction === "Yes" && (
            <div style={{ marginBottom: 12 }}>
              <label style={labelStyle}>If yes, please provide details:</label>
              <textarea style={taStyle} value={felonyDetails} onChange={(e) => setFelonyDetails(e.target.value)} />
            </div>
          )}

          {/* Volunteer info */}
          <div style={sectionHead}>Volunteer Information</div>
          <div style={{ marginBottom: 12 }}>
            <label style={labelStyle}>Why are you interested in volunteering at ${AGENCY_SHORT}?</label>
            <textarea style={taStyle} value={whyVolunteer} onChange={(e) => setWhyVolunteer(e.target.value)} />
          </div>
          <div style={{ marginBottom: 12 }}>
            <label style={labelStyle}>Previous animal experience (pets, volunteer work, professional, etc.)</label>
            <textarea style={taStyle} value={animalExperience} onChange={(e) => setAnimalExperience(e.target.value)} />
          </div>
          <div style={{ marginBottom: 12 }}>
            <label style={labelStyle}>Certifications, licenses, or relevant degrees</label>
            <textarea style={{ ...taStyle, minHeight: 52 }} value={certifications} onChange={(e) => setCertifications(e.target.value)} />
          </div>
          <div style={{ marginBottom: 12 }}>
            <label style={labelStyle}>Allergies or physical/mental limitations we should be aware of</label>
            <textarea style={{ ...taStyle, minHeight: 52 }} value={limitations} onChange={(e) => setLimitations(e.target.value)} />
          </div>
          <div style={{ marginBottom: 12 }}>
            <label style={labelStyle}>Animal Preference</label>
            <div style={{ display: "flex", gap: 20 }}>
              {["Dogs", "Cats", "Both"].map((pref) => (
                <label key={pref} style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", fontSize: 14 }}>
                  <input type="checkbox" checked={animalPreference.includes(pref)} onChange={() => togglePref(pref)} />
                  {pref}
                </label>
              ))}
            </div>
          </div>
          <div style={{ marginBottom: 12 }}>
            <label style={labelStyle}>What would you like to do as a volunteer?</label>
            <textarea style={taStyle} value={volunteerTasks} onChange={(e) => setVolunteerTasks(e.target.value)} />
          </div>
          <div style={{ marginBottom: 12 }}>
            <label style={labelStyle}>Do you have any fears, allergies, or medical limitations that would prevent you from participating in any activities?</label>
            <textarea style={{ ...taStyle, minHeight: 52 }} value={participationLimits} onChange={(e) => setParticipationLimits(e.target.value)} />
          </div>
          <div style={{ marginBottom: 12 }}>
            <label style={labelStyle}>Last Tetanus Vaccination Date</label>
            <DateInput style={{ ...fieldStyle, maxWidth: 200 }} value={tetanusDate} onChange={(e) => setTetanusDate(e.target.value)} />
          </div>

          {/* Office use */}
          <div style={sectionHead}>Office Use Only</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 12 }}>
            <div><label style={labelStyle}>Processed By</label><input style={fieldStyle} value={processedBy} onChange={(e) => setProcessedBy(e.target.value)} /></div>
            <div><label style={labelStyle}>Application Date</label><DateInput style={fieldStyle} value={applicationDate} onChange={(e) => setApplicationDate(e.target.value)} /></div>
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={() => printVolunteerApplication(buildFormData())}>🖨 Print</button>
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving || !firstName || !lastName}>
            {saving ? "Saving…" : "Save Application"}
          </button>
        </div>
      </div>
    </div>
  );
}
