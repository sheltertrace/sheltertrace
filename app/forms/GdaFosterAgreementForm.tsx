"use client";
import { useState, useEffect } from "react";
import { createForm, fetchOfficers, fetchPeople, fetchShelterSettings } from "@/lib/data";
import { today } from "@/lib/utils";
import { useAuth } from "@/app/providers";
import type { ShelterForm, Officer, Person, ShelterSettings, FormPreFill } from "@/lib/types";
import SignaturePad from "@/components/ui/SignaturePad";
import LinkToSection, { type LinkIds } from "@/components/forms/LinkToSection";
import DateInput from "@/components/ui/DateInput";
import { AGENCY_NAME } from "@/lib/shelterInfo";

const AGREEMENT_POINTS = [
  "This form must be maintained at the animal shelter's licensed address.",
  "All animals will remain the property of the above licensed animal shelter until an outgoing animal transaction is completed.",
  "If the licensed animal shelter or the Foster Home/Animal Shelter Agent terminates this agreement the licensed animal shelter must remove the animal(s) from the Foster Home/Animal Shelter Agent's possession as soon as possible.",
  "Upon request from the licensed animal shelter the Foster Home/Animal Shelter Agent must release possession of the animal(s) to the licensed animal shelter that is the owner of the animal(s).",
  "The Foster Home/Animal Shelter Agent must have license holder approval prior to rescuing any animal.",
  "The Foster Home/Animal Shelter Agent agrees to authorized animal shelter personnel performing the recommended pre-approval inspection done prior to becoming a foster home and the required periodic inspections twice yearly (one during the summer and one during the winter is recommended). The Foster Home/Animal Shelter Agent agrees to inspections by GDA personnel when necessary.",
  "The Foster Home/Animal Shelter Agent agrees to comply with all applicable laws and rules, including the Bird Dealers Licensing Act, O.C.G.A. § 4-10-1, et seq., the Georgia Animal Protection Act, O.C.G.A. § 4-11-1, et seq., the Bird Dealers Licensing Rules, 40-13-12, et seq., and the Animal Protection Rules, 40-13-13, et seq.",
];

interface Props {
  onSave: (form: ShelterForm) => void;
  onClose: () => void;
  prefill?: FormPreFill;
}

type SigKey = "lhSig" | "fosterSig" | "termLhSig" | "termFosterSig";

export function printAgreement(d: Record<string, unknown>) {
  const w = window.open("", "_blank", "width=760,height=1050");
  if (!w) return;
  const sig = (key: SigKey) => d[key]
    ? `<img src="${d[key]}" style="width:180px;height:44px;object-fit:contain;display:block"/>`
    : `<div style="width:180px;height:44px;border-bottom:1.5px solid #000"></div>`;
  const printLine = (label: string, val: string, w = 200) =>
    `<div style="display:inline-flex;flex-direction:column;gap:2px;margin-right:20px;margin-bottom:10px">
      <div style="border-bottom:1px solid #000;min-width:${w}px;padding-bottom:2px;font-size:10.5px">${val}</div>
      <div style="font-size:9px;color:#666">${label}</div>
    </div>`;
  w.document.write(`<html><head><title>GDA Foster Home Agreement</title>
  <style>*{-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important;color-adjust:exact!important;}body{font-family:Arial,sans-serif;font-size:10.5px;padding:22px;margin:0;line-height:1.5}
  h2{font-size:13px;text-transform:uppercase;font-weight:900;margin:0 0 2px}
  .sub{font-size:10px;color:#444;margin-bottom:10px}
  ol li{margin-bottom:6px}
  .sect{font-weight:800;font-size:11px;text-transform:uppercase;border-bottom:1.5px solid #000;padding-bottom:3px;margin:14px 0 8px}
  @media print{body{padding:14px}}</style></head><body>
  <h2>Foster Home/Animal Shelter Agent Agreement</h2>
  <div class="sub">Georgia Department of Agriculture (Hereinafter 'GDA')</div>
  <div style="margin-bottom:10px">
    ${printLine("GDA Licensed Animal Shelter", d.shelter_name as string, 220)}
    ${printLine("GDA Animal Shelter License #", d.license_number as string, 140)}
    ${printLine("Agreement Effective Date", d.effective_date as string, 120)}
  </div>
  <div style="margin-bottom:10px">
    ${printLine("Foster Home/Agent Name", d.foster_name as string, 220)}
  </div>
  <div style="font-size:10px;font-weight:700;margin-bottom:6px">Foster Home/Agent Address:</div>
  <div style="margin-bottom:10px">
    ${printLine("Physical Address", d.foster_address as string, 220)}
    ${printLine("County", d.foster_county as string, 100)}
  </div>
  <div style="margin-bottom:10px">
    ${printLine("City", d.foster_city as string, 120)}
    ${printLine("State", d.foster_state as string, 40)}
    ${printLine("Zip", d.foster_zip as string, 70)}
  </div>
  <ol style="margin:0;padding-left:16px">
    ${AGREEMENT_POINTS.map((p) => `<li>${p}</li>`).join("")}
  </ol>
  <div class="sect">The License Holder and Foster Home/Animal Shelter Agent Consent to Comply With This Agreement</div>
  <div style="display:flex;gap:40px;flex-wrap:wrap;margin-bottom:6px">
    <div>
      <div style="font-size:9px;font-weight:700;margin-bottom:4px">LICENSE HOLDER SIGNATURE</div>
      ${sig("lhSig")}
      ${printLine("License Holder Print", d.lhPrint as string, 180)}
    </div>
    <div>
      <div style="font-size:9px;font-weight:700;margin-bottom:4px">FOSTER HOME/AGENT SIGNATURE</div>
      ${sig("fosterSig")}
      ${printLine("Foster Home/Agent Print", d.fosterPrint as string, 180)}
    </div>
  </div>
  <div class="sect">To Terminate This Agreement</div>
  <div style="display:flex;gap:40px;flex-wrap:wrap;margin-bottom:6px">
    <div>
      <div style="font-size:9px;font-weight:700;margin-bottom:4px">LICENSE HOLDER SIGNATURE</div>
      ${sig("termLhSig")}
      ${printLine("License Holder Print", d.termLhPrint as string, 180)}
    </div>
    <div>
      <div style="font-size:9px;font-weight:700;margin-bottom:4px">FOSTER HOME/AGENT SIGNATURE</div>
      ${sig("termFosterSig")}
      ${printLine("Foster Home/Agent Print", d.termFosterPrint as string, 180)}
    </div>
  </div>
  ${printLine("Termination Date", d.termination_date as string, 120)}
  </body></html>`);
  w.document.close(); w.print();
}

export default function GdaFosterAgreementForm({ onSave, onClose, prefill }: Props) {
  const { user } = useAuth();
  const defaultLhPrint = user ? `${user.firstName} ${user.lastName}`.trim() : "";

  const [settings, setSettings] = useState<ShelterSettings>({ shelter_name: AGENCY_NAME, shelter_address: "", shelter_phone: "", gda_license_number: "" });
  const [effectiveDate, setEffectiveDate] = useState(today());
  const [fosterName, setFosterName] = useState("");
  const [fosterAddress, setFosterAddress] = useState("");
  const [fosterCounty, setFosterCounty] = useState("Morgan");
  const [fosterCity, setFosterCity] = useState("");
  const [fosterState, setFosterState] = useState("GA");
  const [fosterZip, setFosterZip] = useState("");

  // Agreement signatures
  const [lhSig, setLhSig] = useState<string | null>(null);
  const [lhSigTs, setLhSigTs] = useState<string | null>(null);
  const [lhPrint, setLhPrint] = useState(defaultLhPrint);
  const [fosterSig, setFosterSig] = useState<string | null>(null);
  const [fosterSigTs, setFosterSigTs] = useState<string | null>(null);
  const [fosterPrint, setFosterPrint] = useState("");

  // Termination signatures (optional)
  const [showTermination, setShowTermination] = useState(false);
  const [termLhSig, setTermLhSig] = useState<string | null>(null);
  const [termLhSigTs, setTermLhSigTs] = useState<string | null>(null);
  const [termLhPrint, setTermLhPrint] = useState(defaultLhPrint);
  const [termFosterSig, setTermFosterSig] = useState<string | null>(null);
  const [termFosterSigTs, setTermFosterSigTs] = useState<string | null>(null);
  const [termFosterPrint, setTermFosterPrint] = useState("");
  const [terminationDate, setTerminationDate] = useState("");

  const [officers, setOfficers] = useState<Officer[]>([]);
  const [people, setPeople] = useState<Person[]>([]);
  const [personSearch, setPersonSearch] = useState("");
  const [selectedPerson, setSelectedPerson] = useState<Person | null>(null);
  const [saving, setSaving] = useState(false);
  const [linkIds, setLinkIds] = useState<LinkIds>({
    call_id: prefill?.call_id,
    animal_id: prefill?.animal_id,
  });

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
          setFosterAddress(p.address || "");
          setFosterCity(p.city || "");
          setFosterZip(p.zip || "");
          setFosterPrint(`${p.first_name} ${p.last_name}`.trim());
          setTermFosterPrint(`${p.first_name} ${p.last_name}`.trim());
        }
      } else if (prefill?.person_first) {
        setFosterName([prefill.person_first, prefill.person_last].filter(Boolean).join(" "));
        setFosterAddress(prefill.person_address || "");
        setFosterCity(prefill.person_city || "");
        setFosterZip(prefill.person_zip || "");
      }
    });
  }, [prefill?.person_id, prefill?.person_first]);

  const filteredPeople = personSearch
    ? people.filter((p) => `${p.first_name} ${p.last_name}`.toLowerCase().includes(personSearch.toLowerCase()) || (p.pid || "").toLowerCase().includes(personSearch.toLowerCase()))
    : [];

  const handlePersonSelect = (p: Person) => {
    setSelectedPerson(p);
    setFosterName(`${p.first_name || ""} ${p.last_name || ""}`.trim());
    setFosterAddress(p.address || "");
    setFosterCity(p.city || "");
    setFosterZip(p.zip || "");
    setFosterPrint(`${p.first_name || ""} ${p.last_name || ""}`.trim());
    setTermFosterPrint(`${p.first_name || ""} ${p.last_name || ""}`.trim());
    setPersonSearch("");
  };

  const formData = () => ({
    shelter_name: settings.shelter_name,
    license_number: settings.gda_license_number,
    effective_date: effectiveDate,
    foster_name: fosterName,
    foster_address: fosterAddress,
    foster_county: fosterCounty,
    foster_city: fosterCity,
    foster_state: fosterState,
    foster_zip: fosterZip,
    lhSig: lhSig || undefined, lhSigTs, lhPrint,
    fosterSig: fosterSig || undefined, fosterSigTs, fosterPrint,
    termLhSig: termLhSig || undefined, termLhSigTs, termLhPrint,
    termFosterSig: termFosterSig || undefined, termFosterSigTs, termFosterPrint,
    termination_date: terminationDate,
  });

  const handleSave = async () => {
    setSaving(true);
    try {
      const saved = await createForm({
        form_type: "gda_foster_agreement",
        form_data: formData() as unknown as Record<string, unknown>,
        linked_call_id: linkIds.call_id,
        linked_animal_id: linkIds.animal_id,
        linked_person_id: selectedPerson?.id || prefill?.person_id,
        officer: lhPrint,
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
            <div className="modal-title">GDA Foster Home/Animal Shelter Agent Agreement</div>
            <div style={{ fontSize: 11, color: "var(--text-secondary)", marginTop: 2 }}>Georgia Department of Agriculture</div>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          {/* Header fields */}
          <div className="grid-3" style={{ gap: 10, marginBottom: 14 }}>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">GDA Licensed Animal Shelter</label>
              <input className="form-input" value={settings.shelter_name} onChange={(e) => setSettings((s) => ({ ...s, shelter_name: e.target.value }))} />
            </div>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">GDA Shelter License #</label>
              <input className="form-input" value={settings.gda_license_number} onChange={(e) => setSettings((s) => ({ ...s, gda_license_number: e.target.value }))} placeholder="Auto-filled from Admin settings" />
            </div>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Agreement Effective Date</label>
              <DateInput className="form-input" value={effectiveDate} onChange={(e) => setEffectiveDate(e.target.value)} />
            </div>
          </div>

          {/* Foster person search */}
          <div className="form-group" style={{ marginBottom: 14 }}>
            <label className="form-label">Foster Home/Agent (search existing contacts)</label>
            {selectedPerson ? (
              <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 10px", background: "#f0fdf4", border: "1px solid #86efac", borderRadius: 6 }}>
                <span style={{ fontWeight: 700 }}>{selectedPerson.first_name} {selectedPerson.last_name}</span>
                <span style={{ fontSize: 11, color: "var(--text-secondary)" }}>{selectedPerson.pid}</span>
                <button className="btn btn-ghost btn-sm" style={{ marginLeft: "auto" }} onClick={() => setSelectedPerson(null)}>✕</button>
              </div>
            ) : (
              <div style={{ position: "relative" }}>
                <input className="form-input" placeholder="Search by name or PID…" value={personSearch} onChange={(e) => setPersonSearch(e.target.value)} />
                {filteredPeople.length > 0 && (
                  <div style={{ position: "absolute", zIndex: 50, left: 0, right: 0, top: "100%", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 6, boxShadow: "0 4px 12px rgba(0,0,0,.12)", maxHeight: 160, overflowY: "auto" }}>
                    {filteredPeople.slice(0, 8).map((p) => (
                      <div key={p.id} onClick={() => handlePersonSelect(p)} style={{ padding: "7px 12px", cursor: "pointer", borderBottom: "1px solid var(--border-light)", fontSize: 13 }}>
                        <span style={{ fontWeight: 600 }}>{p.first_name} {p.last_name}</span> <span style={{ fontSize: 11, color: "var(--text-secondary)" }}>{p.pid}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Foster home info */}
          <div className="form-group" style={{ marginBottom: 10 }}>
            <label className="form-label">Foster Home/Agent Name</label>
            <input className="form-input" value={fosterName} onChange={(e) => setFosterName(e.target.value)} />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 10, marginBottom: 10 }}>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Physical Address</label>
              <input className="form-input" value={fosterAddress} onChange={(e) => setFosterAddress(e.target.value)} />
            </div>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">County</label>
              <input className="form-input" value={fosterCounty} onChange={(e) => setFosterCounty(e.target.value)} />
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "2fr 80px 100px", gap: 10, marginBottom: 16 }}>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">City</label>
              <input className="form-input" value={fosterCity} onChange={(e) => setFosterCity(e.target.value)} />
            </div>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">State</label>
              <input className="form-input" value={fosterState} onChange={(e) => setFosterState(e.target.value)} />
            </div>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Zip</label>
              <input className="form-input" value={fosterZip} onChange={(e) => setFosterZip(e.target.value)} />
            </div>
          </div>

          {/* Agreement points (read-only) */}
          <div style={{ background: "var(--surface-alt)", border: "1px solid var(--border-light)", borderRadius: 8, padding: "12px 14px", marginBottom: 16 }}>
            <div style={{ fontWeight: 700, fontSize: 12, marginBottom: 8 }}>Agreement Terms (pre-printed)</div>
            <ol style={{ margin: 0, paddingLeft: 18, fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.6 }}>
              {AGREEMENT_POINTS.map((p, i) => <li key={i} style={{ marginBottom: 5 }}>{p}</li>)}
            </ol>
          </div>

          {/* Agreement signatures */}
          <div style={{ fontWeight: 700, fontSize: 13, color: "var(--teal)", marginBottom: 10, borderBottom: "1px solid var(--border)", paddingBottom: 6 }}>
            Agreement Signatures
          </div>
          <div className="grid-2" style={{ gap: 16, marginBottom: 16 }}>
            <div>
              <SignaturePad label="License Holder Signature" value={lhSig} timestamp={lhSigTs}
                onAccept={(d, t) => { setLhSig(d); setLhSigTs(t); }} onClear={() => { setLhSig(null); setLhSigTs(null); }} />
              <div className="form-group" style={{ marginTop: 8, margin: "8px 0 0" }}>
                <label className="form-label">License Holder Printed Name</label>
                <input className="form-input" value={lhPrint} onChange={(e) => setLhPrint(e.target.value)} />
              </div>
            </div>
            <div>
              <SignaturePad label="Foster Home/Agent Signature" value={fosterSig} timestamp={fosterSigTs}
                onAccept={(d, t) => { setFosterSig(d); setFosterSigTs(t); }} onClear={() => { setFosterSig(null); setFosterSigTs(null); }} />
              <div className="form-group" style={{ marginTop: 8, margin: "8px 0 0" }}>
                <label className="form-label">Foster Home/Agent Printed Name</label>
                <input className="form-input" value={fosterPrint} onChange={(e) => setFosterPrint(e.target.value)} />
              </div>
            </div>
          </div>

          {/* Termination section (collapsible) */}
          <button className="btn btn-secondary btn-sm" style={{ marginBottom: 12 }} onClick={() => setShowTermination((v) => !v)}>
            {showTermination ? "▲ Hide" : "▼ Show"} Termination Section (optional)
          </button>
          {showTermination && (
            <div style={{ border: "1px solid #fcd34d", borderRadius: 8, padding: 14, background: "#fffbeb", marginBottom: 8 }}>
              <div style={{ fontWeight: 700, fontSize: 13, color: "#92400e", marginBottom: 12 }}>To Terminate This Agreement</div>
              <div className="grid-2" style={{ gap: 16, marginBottom: 12 }}>
                <div>
                  <SignaturePad label="License Holder Signature" value={termLhSig} timestamp={termLhSigTs}
                    onAccept={(d, t) => { setTermLhSig(d); setTermLhSigTs(t); }} onClear={() => { setTermLhSig(null); setTermLhSigTs(null); }} />
                  <div className="form-group" style={{ margin: "8px 0 0" }}>
                    <label className="form-label">License Holder Print</label>
                    <input className="form-input" value={termLhPrint} onChange={(e) => setTermLhPrint(e.target.value)} />
                  </div>
                </div>
                <div>
                  <SignaturePad label="Foster Home/Agent Signature" value={termFosterSig} timestamp={termFosterSigTs}
                    onAccept={(d, t) => { setTermFosterSig(d); setTermFosterSigTs(t); }} onClear={() => { setTermFosterSig(null); setTermFosterSigTs(null); }} />
                  <div className="form-group" style={{ margin: "8px 0 0" }}>
                    <label className="form-label">Foster Home/Agent Print</label>
                    <input className="form-input" value={termFosterPrint} onChange={(e) => setTermFosterPrint(e.target.value)} />
                  </div>
                </div>
              </div>
              <div className="form-group" style={{ margin: 0, maxWidth: 200 }}>
                <label className="form-label">Termination Date</label>
                <DateInput className="form-input" value={terminationDate} onChange={(e) => setTerminationDate(e.target.value)} />
              </div>
            </div>
          )}
          <LinkToSection value={linkIds} onChange={setLinkIds} exclude={["person"]} />
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-secondary" onClick={() => printAgreement(formData() as unknown as Record<string, unknown>)}>🖨 Print Preview</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving}>{saving ? "Saving…" : "Save & Print"}</button>
        </div>
      </div>
    </div>
  );
}
