"use client";
import { useState, useEffect } from "react";
import { createForm, fetchOfficers, fetchPeople, fetchShelterSettings } from "@/lib/data";
import { today } from "@/lib/utils";
import { useAuth } from "@/app/providers";
import type { ShelterForm, Officer, Person, ShelterSettings, FormPreFill } from "@/lib/types";
import SignaturePad from "@/components/ui/SignaturePad";
import LinkToSection, { type LinkIds } from "@/components/forms/LinkToSection";

export const INSPECTION_ITEMS = [
  { num: 1, label: "Adequate Food", ref: "40-13-13-.01", outdoorNA: false },
  { num: 2, label: "Adequate Water", ref: "40-13-13-.01", outdoorNA: false },
  { num: 3, label: "Adequate Temperature Control", ref: "40-13-13-.01", outdoorNA: true },
  { num: 4, label: "Adequate Ventilation", ref: "40-13-13-.01", outdoorNA: true },
  { num: 5, label: "Proper Animal Health Care", ref: "40-13-13-.01", outdoorNA: false },
  { num: 6, label: "Classification & Separation", ref: "40-13-13-.04", outdoorNA: false },
  { num: 7, label: "Housekeeping", ref: "40-13-13-.04", outdoorNA: false },
  { num: 8, label: "Pest Control", ref: "40-13-13-.04", outdoorNA: false },
  { num: 9, label: "Sanitation", ref: "40-13-13-.04", outdoorNA: false },
  { num: 10, label: "Shelter", ref: "40-13-13-.04", outdoorNA: false },
  { num: 11, label: "Space Requirement", ref: "40-13-13-.04", outdoorNA: false },
  { num: 12, label: "Structural Strength", ref: "40-13-13-.04", outdoorNA: false },
  { num: 13, label: "Waste Disposal", ref: "40-13-13-.04", outdoorNA: false },
];

const HOUSING_CATS = ["Indoor Animal Housing", "Outdoor Animal Housing", "Animal Transport Vehicle"] as const;
const INSPECTION_TYPES = ["Routine", "Re-Inspection", "Pre-Sign Up Inspection"] as const;
type CheckVal = "pass" | "fail" | "n/a" | "";

interface Props {
  onSave: (form: ShelterForm) => void;
  onClose: () => void;
  prefill?: FormPreFill;
}

export function printInspection(d: Record<string, unknown>, items: typeof INSPECTION_ITEMS) {
  const w = window.open("", "_blank", "width=760,height=1060");
  if (!w) return;
  const checklist = (d.checklist || {}) as Record<number, CheckVal>;
  const failNotes = (d.failure_notes || {}) as Record<number, string>;
  const failedItems = items.filter((i) => checklist[i.num] === "fail");
  const allScored = items.filter((i) => checklist[i.num] !== "n/a" && checklist[i.num] !== "");
  const overall = allScored.length > 0 && allScored.every((i) => checklist[i.num] === "pass") ? "PASS" : failedItems.length > 0 ? "FAIL" : "INCOMPLETE";
  const sig = (key: string) => d[key]
    ? `<img src="${d[key]}" style="width:180px;height:44px;object-fit:contain;display:block"/>`
    : `<div style="width:180px;height:44px;border-bottom:1.5px solid #000"></div>`;
  const checkCell = (val: CheckVal) => {
    const style = (active: boolean, color: string) => `style="width:30px;text-align:center;border:1px solid #ccc;background:${active ? color : "#fff"};font-weight:700;font-size:10px;padding:3px"`;
    return `<td ${style(val === "pass", "#dcfce7")}>P</td><td ${style(val === "fail", "#fee2e2")}>F</td><td ${style(val === "n/a", "#f1f5f9")}>N/A</td>`;
  };
  w.document.write(`<html><head><title>GDA Foster Inspection Report</title>
  <style>body{font-family:Arial,sans-serif;font-size:10.5px;padding:22px;margin:0;line-height:1.45}
  h2{font-size:12.5px;text-transform:uppercase;font-weight:900;margin:0 0 2px}
  .sub{font-size:10px;color:#444;margin-bottom:10px}
  table{border-collapse:collapse;width:100%}
  td,th{border:1px solid #ccc;padding:4px 6px;font-size:10px}
  th{background:#f1f5f9;font-weight:700;text-align:left}
  .sect{font-weight:800;font-size:11px;border-bottom:1.5px solid #000;padding-bottom:3px;margin:14px 0 8px}
  .result{font-size:18px;font-weight:900;padding:6px 16px;border-radius:4px;display:inline-block}
  @media print{@page{size:letter} body{padding:14px}}</style></head><body>
  <h2>Foster Home/Animal Shelter Agent – Inspection Report</h2>
  <div class="sub">Georgia Department of Agriculture</div>
  <table style="margin-bottom:10px"><tbody>
    <tr><td><b>GDA Licensed Animal Shelter:</b> ${d.shelter_name}</td><td><b>GDA License #:</b> ${d.license_number}</td></tr>
    <tr><td><b>Foster Home/Agent:</b> ${d.foster_name}</td><td><b>Inspection Date:</b> ${d.inspection_date}</td></tr>
    <tr><td><b>Address:</b> ${d.physical_address}, ${d.city}, ${d.state} ${d.zip}</td><td><b>County:</b> ${d.county}</td></tr>
    <tr><td><b>Inspection Type:</b> ${d.inspection_type}</td><td><b>Housing:</b> ${(d.housing_categories as string[]).join(", ") || "—"}</td></tr>
  </tbody></table>
  <div class="sect">Inspection Checklist</div>
  <div style="font-size:9px;color:#555;margin-bottom:6px">* N/A for outdoor housing &nbsp;|&nbsp; A category marked Fail must be re-inspected</div>
  <table><thead><tr><th>#</th><th>Item</th><th>Rule</th><th style="text-align:center">Pass</th><th style="text-align:center">Fail</th><th style="text-align:center">N/A</th></tr></thead>
  <tbody>${items.map((item) => `<tr><td>${item.num}</td><td>${item.label}${item.outdoorNA ? " *" : ""}</td><td style="font-style:italic;color:#555">${item.ref}</td>${checkCell(checklist[item.num] || "")}</tr>`).join("")}</tbody>
  </table>
  <div style="margin:12px 0;display:flex;align-items:center;gap:12px">
    <span style="font-weight:700">Overall Result:</span>
    <span class="result" style="background:${overall === "PASS" ? "#dcfce7" : overall === "FAIL" ? "#fee2e2" : "#fef9c3"};color:${overall === "PASS" ? "#166534" : overall === "FAIL" ? "#991b1b" : "#92400e"}">${overall}</span>
  </div>
  ${failedItems.length > 0 ? `
  <div style="page-break-before:always;padding-top:14px">
  <h2>Inspection Report — Page 2: Failed Items</h2>
  <div class="sub">Foster: ${d.foster_name} &nbsp;|&nbsp; Inspection Date: ${d.inspection_date}</div>
  ${failedItems.map((item) => `
    <div class="sect">${item.num}. ${item.label} — FAIL</div>
    <div style="border:1px solid #fca5a5;background:#fff1f2;padding:8px;border-radius:4px;min-height:40px;font-size:10.5px">${failNotes[item.num] || "(No explanation provided)"}</div>
  `).join("")}
  </div>` : ""}
  <div class="sect">Signatures</div>
  <div style="display:flex;gap:40px;flex-wrap:wrap">
    <div>
      <div style="font-size:9px;font-weight:700;margin-bottom:4px">INSPECTED BY SIGNATURE</div>
      ${sig("inspector_sig")}
      <div style="border-bottom:1px solid #000;min-width:180px;margin-top:4px;padding-bottom:2px;font-size:10px">${d.inspector_print}</div>
      <div style="font-size:9px;color:#666">Inspected By (Print)</div>
    </div>
    <div>
      <div style="font-size:9px;font-weight:700;margin-bottom:4px">FOSTER HOME/AGENT SIGNATURE</div>
      ${sig("foster_sig")}
      <div style="border-bottom:1px solid #000;min-width:180px;margin-top:4px;padding-bottom:2px;font-size:10px">${d.foster_print}</div>
      <div style="font-size:9px;color:#666">Foster Home/Agent (Print)</div>
    </div>
  </div>
  </body></html>`);
  w.document.close(); w.print();
}

export default function GdaFosterInspectionForm({ onSave, onClose, prefill }: Props) {
  const { user } = useAuth();
  const [settings, setSettings] = useState<ShelterSettings>({ shelter_name: "Morgan County Animal Services", shelter_address: "", shelter_phone: "", gda_license_number: "" });
  const [inspectionDate, setInspectionDate] = useState(today());
  const [inspectionType, setInspectionType] = useState<typeof INSPECTION_TYPES[number]>("Routine");
  const [housing, setHousing] = useState<string[]>([]);
  const [fosterName, setFosterName] = useState("");
  const [physicalAddress, setPhysicalAddress] = useState("");
  const [zip, setZip] = useState("");
  const [city, setCity] = useState("");
  const [county, setCounty] = useState("Morgan");
  const [state, setState] = useState("GA");
  const [checklist, setChecklist] = useState<Record<number, CheckVal>>({});
  const [failureNotes, setFailureNotes] = useState<Record<number, string>>({});
  const [inspectorSig, setInspectorSig] = useState<string | null>(null);
  const [inspectorSigTs, setInspectorSigTs] = useState<string | null>(null);
  const [inspectorPrint, setInspectorPrint] = useState(user ? `${user.firstName} ${user.lastName}`.trim() : "");
  const [fosterSig, setFosterSig] = useState<string | null>(null);
  const [fosterSigTs, setFosterSigTs] = useState<string | null>(null);
  const [fosterPrint, setFosterPrint] = useState("");
  const [officers, setOfficers] = useState<Officer[]>([]);
  const [people, setPeople] = useState<Person[]>([]);
  const [personSearch, setPersonSearch] = useState("");
  const [selectedPerson, setSelectedPerson] = useState<Person | null>(null);
  const [saving, setSaving] = useState(false);
  const [linkIds, setLinkIds] = useState<LinkIds>({
    call_id: prefill?.call_id,
    animal_id: prefill?.animal_id,
  });

  const isOutdoor = housing.includes("Outdoor Animal Housing");

  useEffect(() => {
    fetchShelterSettings().then(setSettings);
    fetchOfficers().then(setOfficers);
    fetchPeople().then((ps) => {
      setPeople(ps);
      if (prefill?.person_id) {
        const p = ps.find((x) => x.id === prefill.person_id);
        if (p) {
          setSelectedPerson(p);
          setFosterName(`${p.first_name} ${p.last_name}`.trim());
          setPhysicalAddress(p.address || "");
          setCity(p.city || "");
          setZip(p.zip || "");
          setFosterPrint(`${p.first_name} ${p.last_name}`.trim());
        }
      } else if (prefill?.person_first) {
        setFosterName([prefill.person_first, prefill.person_last].filter(Boolean).join(" "));
        setPhysicalAddress(prefill.person_address || "");
        setCity(prefill.person_city || "");
        setZip(prefill.person_zip || "");
      }
    });
  }, [prefill?.person_id, prefill?.person_first]);

  // Auto-set N/A for items 3 and 4 when outdoor-only
  useEffect(() => {
    if (isOutdoor && !housing.includes("Indoor Animal Housing")) {
      setChecklist((prev) => ({ ...prev, 3: "n/a", 4: "n/a" }));
    }
  }, [isOutdoor, housing]);

  const filteredPeople = personSearch
    ? people.filter((p) => `${p.first_name} ${p.last_name}`.toLowerCase().includes(personSearch.toLowerCase()))
    : [];

  const handlePersonSelect = (p: Person) => {
    setSelectedPerson(p);
    setFosterName(`${p.first_name || ""} ${p.last_name || ""}`.trim());
    setPhysicalAddress(p.address || "");
    setCity(p.city || "");
    setZip(p.zip || "");
    setFosterPrint(`${p.first_name || ""} ${p.last_name || ""}`.trim());
    setPersonSearch("");
  };

  const toggleHousing = (cat: string) => setHousing((prev) => prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat]);
  const setCheck = (num: number, val: CheckVal) => setChecklist((prev) => ({ ...prev, [num]: val }));

  const failedItems = INSPECTION_ITEMS.filter((i) => checklist[i.num] === "fail");
  const scoredItems = INSPECTION_ITEMS.filter((i) => checklist[i.num] !== "n/a" && checklist[i.num] !== "");
  const overall = scoredItems.length > 0 && scoredItems.every((i) => checklist[i.num] === "pass") ? "PASS"
    : failedItems.length > 0 ? "FAIL" : null;

  const formData = () => ({
    shelter_name: settings.shelter_name,
    license_number: settings.gda_license_number,
    inspection_date: inspectionDate,
    inspection_type: inspectionType,
    housing_categories: housing,
    foster_name: fosterName,
    physical_address: physicalAddress,
    zip, city, county, state,
    checklist, failure_notes: failureNotes,
    inspector_sig: inspectorSig || undefined, inspector_sig_ts: inspectorSigTs, inspector_print: inspectorPrint,
    foster_sig: fosterSig || undefined, foster_sig_ts: fosterSigTs, foster_print: fosterPrint,
    overall_result: overall,
  });

  const handleSave = async () => {
    setSaving(true);
    try {
      const saved = await createForm({
        form_type: "gda_foster_inspection",
        form_data: formData() as unknown as Record<string, unknown>,
        linked_call_id: linkIds.call_id,
        linked_animal_id: linkIds.animal_id,
        linked_person_id: selectedPerson?.id || prefill?.person_id,
        officer: inspectorPrint,
        created_by: user ? `${user.firstName} ${user.lastName}`.trim() : undefined,
      });
      onSave(saved);
    } catch (e: unknown) {
      alert(`Failed to save: ${(e as { message?: string }).message || "Unknown error"}`);
    } finally { setSaving(false); }
  };

  void officers;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal-xl" onClick={(e) => e.stopPropagation()} style={{ maxHeight: "92vh" }}>
        <div className="modal-header">
          <div>
            <div className="modal-title">GDA Foster Home Inspection Report</div>
            <div style={{ fontSize: 11, color: "var(--text-secondary)", marginTop: 2 }}>Georgia Department of Agriculture</div>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          {/* Header info */}
          <div className="grid-2" style={{ gap: 10, marginBottom: 14 }}>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">GDA Licensed Animal Shelter</label>
              <input className="form-input" value={settings.shelter_name} onChange={(e) => setSettings((s) => ({ ...s, shelter_name: e.target.value }))} />
            </div>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">GDA License #</label>
              <input className="form-input" value={settings.gda_license_number} onChange={(e) => setSettings((s) => ({ ...s, gda_license_number: e.target.value }))} placeholder="Auto-filled from Admin" />
            </div>
          </div>

          <div className="form-group" style={{ marginBottom: 14 }}>
            <label className="form-label">Foster Home/Agent (search contacts)</label>
            {selectedPerson ? (
              <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 10px", background: "#f0fdf4", border: "1px solid #86efac", borderRadius: 6 }}>
                <span style={{ fontWeight: 700 }}>{selectedPerson.first_name} {selectedPerson.last_name}</span>
                <span style={{ fontSize: 11, color: "var(--text-secondary)" }}>{selectedPerson.pid}</span>
                <button className="btn btn-ghost btn-sm" style={{ marginLeft: "auto" }} onClick={() => setSelectedPerson(null)}>✕</button>
              </div>
            ) : (
              <div style={{ position: "relative" }}>
                <input className="form-input" placeholder="Search by name…" value={personSearch} onChange={(e) => setPersonSearch(e.target.value)} />
                {filteredPeople.length > 0 && (
                  <div style={{ position: "absolute", zIndex: 50, left: 0, right: 0, top: "100%", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 6, boxShadow: "0 4px 12px rgba(0,0,0,.12)", maxHeight: 160, overflowY: "auto" }}>
                    {filteredPeople.slice(0, 8).map((p) => (
                      <div key={p.id} onClick={() => handlePersonSelect(p)} style={{ padding: "7px 12px", cursor: "pointer", borderBottom: "1px solid var(--border-light)", fontSize: 13 }}>
                        <span style={{ fontWeight: 600 }}>{p.first_name} {p.last_name}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 10 }}>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Foster Name</label>
              <input className="form-input" value={fosterName} onChange={(e) => setFosterName(e.target.value)} />
            </div>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Inspection Date</label>
              <input className="form-input" type="date" value={inspectionDate} onChange={(e) => setInspectionDate(e.target.value)} />
            </div>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Inspection Type</label>
              <select className="form-select" value={inspectionType} onChange={(e) => setInspectionType(e.target.value as typeof INSPECTION_TYPES[number])}>
                {INSPECTION_TYPES.map((t) => <option key={t}>{t}</option>)}
              </select>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 80px 100px", gap: 10, marginBottom: 14 }}>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Physical Address</label>
              <input className="form-input" value={physicalAddress} onChange={(e) => setPhysicalAddress(e.target.value)} />
            </div>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">City</label>
              <input className="form-input" value={city} onChange={(e) => setCity(e.target.value)} />
            </div>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">State</label>
              <input className="form-input" value={state} onChange={(e) => setState(e.target.value)} />
            </div>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Zip</label>
              <input className="form-input" value={zip} onChange={(e) => setZip(e.target.value)} />
            </div>
          </div>

          {/* Housing categories */}
          <div style={{ fontWeight: 700, fontSize: 12, textTransform: "uppercase", color: "var(--text-secondary)", marginBottom: 8 }}>Housing Categories</div>
          <div style={{ display: "flex", gap: 16, marginBottom: 16, flexWrap: "wrap" }}>
            {HOUSING_CATS.map((cat) => (
              <label key={cat} style={{ display: "flex", gap: 8, alignItems: "center", cursor: "pointer", fontSize: 13 }}>
                <input type="checkbox" checked={housing.includes(cat)} onChange={() => toggleHousing(cat)} style={{ width: 15, height: 15 }} />
                {cat}
              </label>
            ))}
          </div>

          {/* Inspection checklist */}
          <div style={{ fontWeight: 700, fontSize: 12, textTransform: "uppercase", color: "var(--text-secondary)", marginBottom: 8 }}>
            13-Point Inspection Checklist
            {overall && (
              <span style={{ marginLeft: 16, padding: "2px 12px", borderRadius: 20, fontSize: 12, fontWeight: 800, background: overall === "PASS" ? "#dcfce7" : "#fee2e2", color: overall === "PASS" ? "#166534" : "#991b1b" }}>
                Overall: {overall}
              </span>
            )}
          </div>
          <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 10 }}>* Items 3 & 4 are N/A for outdoor-only housing. A category marked Fail must be re-inspected.</div>

          <div style={{ border: "1px solid var(--border)", borderRadius: 8, overflow: "hidden", marginBottom: 16 }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "var(--th-bg)" }}>
                  <th style={{ padding: "8px 10px", textAlign: "left", fontSize: 12, width: 30 }}>#</th>
                  <th style={{ padding: "8px 10px", textAlign: "left", fontSize: 12 }}>Item</th>
                  <th style={{ padding: "8px 10px", textAlign: "left", fontSize: 11, color: "var(--text-muted)", width: 120 }}>Rule</th>
                  <th style={{ padding: "8px 10px", textAlign: "center", fontSize: 12, width: 200 }}>Result</th>
                </tr>
              </thead>
              <tbody>
                {INSPECTION_ITEMS.map((item) => {
                  const val = checklist[item.num] || "";
                  const forceNA = item.outdoorNA && isOutdoor && !housing.includes("Indoor Animal Housing");
                  return (
                    <tr key={item.num} style={{ borderTop: "1px solid var(--border-light)", background: val === "fail" ? "#fff5f5" : "transparent" }}>
                      <td style={{ padding: "7px 10px", fontSize: 12, fontWeight: 700 }}>{item.num}</td>
                      <td style={{ padding: "7px 10px", fontSize: 13 }}>{item.label}{item.outdoorNA && " *"}</td>
                      <td style={{ padding: "7px 10px", fontSize: 11, color: "var(--text-muted)", fontStyle: "italic" }}>{item.ref}</td>
                      <td style={{ padding: "6px 10px", textAlign: "center" }}>
                        <div style={{ display: "flex", gap: 6, justifyContent: "center" }}>
                          {(["pass", "fail", "n/a"] as CheckVal[]).map((opt) => (
                            <button
                              key={opt}
                              disabled={forceNA && opt !== "n/a"}
                              onClick={() => setCheck(item.num, val === opt ? "" : opt)}
                              style={{
                                padding: "3px 12px", borderRadius: 4, fontSize: 11, fontWeight: 700, cursor: "pointer",
                                border: `1.5px solid ${opt === "pass" ? "#86efac" : opt === "fail" ? "#fca5a5" : "#cbd5e1"}`,
                                background: val === opt ? (opt === "pass" ? "#dcfce7" : opt === "fail" ? "#fee2e2" : "#f1f5f9") : "transparent",
                                color: val === opt ? (opt === "pass" ? "#166534" : opt === "fail" ? "#991b1b" : "#475569") : "var(--text-secondary)",
                                opacity: forceNA && opt !== "n/a" ? 0.3 : 1,
                              }}
                            >
                              {opt === "n/a" ? "N/A" : opt.toUpperCase()}
                            </button>
                          ))}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Failure explanations */}
          {failedItems.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontWeight: 700, fontSize: 13, color: "#dc2626", marginBottom: 10 }}>Page 2 — Explanation of Failed Items</div>
              {failedItems.map((item) => (
                <div key={item.num} className="form-group" style={{ marginBottom: 10 }}>
                  <label className="form-label" style={{ color: "#dc2626" }}>{item.num}. {item.label} — FAIL</label>
                  <textarea className="form-textarea" rows={2} value={failureNotes[item.num] || ""} onChange={(e) => setFailureNotes((prev) => ({ ...prev, [item.num]: e.target.value }))} placeholder="Explain reason for failure…" />
                </div>
              ))}
            </div>
          )}

          {/* Signatures */}
          <div className="grid-2" style={{ gap: 16 }}>
            <div>
              <SignaturePad label="Inspected By Signature" value={inspectorSig} timestamp={inspectorSigTs}
                onAccept={(d, t) => { setInspectorSig(d); setInspectorSigTs(t); }} onClear={() => { setInspectorSig(null); setInspectorSigTs(null); }} />
              <div className="form-group" style={{ margin: "8px 0 0" }}>
                <label className="form-label">Inspected By (Print)</label>
                <select className="form-select" value={inspectorPrint} onChange={(e) => setInspectorPrint(e.target.value)}>
                  <option value="">— Select officer —</option>
                  {officers.map((o) => <option key={o.id} value={o.name}>{o.name}</option>)}
                </select>
              </div>
            </div>
            <div>
              <SignaturePad label="Foster Home/Agent Signature" value={fosterSig} timestamp={fosterSigTs}
                onAccept={(d, t) => { setFosterSig(d); setFosterSigTs(t); }} onClear={() => { setFosterSig(null); setFosterSigTs(null); }} />
              <div className="form-group" style={{ margin: "8px 0 0" }}>
                <label className="form-label">Foster Home/Agent (Print)</label>
                <input className="form-input" value={fosterPrint} onChange={(e) => setFosterPrint(e.target.value)} />
              </div>
            </div>
          </div>
          <LinkToSection value={linkIds} onChange={setLinkIds} exclude={["person"]} />
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-secondary" onClick={() => printInspection(formData() as unknown as Record<string, unknown>, INSPECTION_ITEMS)}>🖨 Print Preview</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving}>{saving ? "Saving…" : "Save & Print"}</button>
        </div>
      </div>
    </div>
  );
}
