"use client";
import { useState, useEffect } from "react";
import { createForm, fetchPeople, fetchAnimals } from "@/lib/data";
import { today } from "@/lib/utils";
import { useAuth } from "@/app/providers";
import type { ShelterForm, Person, Animal, FormPreFill } from "@/lib/types";
import SignaturePad from "@/components/ui/SignaturePad";
import LinkToSection, { type LinkIds } from "@/components/forms/LinkToSection";
import DateInput from "@/components/ui/DateInput";

const MCAS_BLUE = "#1a3a6b";

const AGREEMENT_ITEMS = [
  "I am at least 18 years of age.",
  "I will provide this animal with adequate food, water, shelter, and veterinary care at all times.",
  "I will keep this animal confined or on a leash as required by local ordinance.",
  "I understand that this animal must be licensed and vaccinated for rabies as required by law.",
  "I will not transfer ownership of this animal without prior written notification to MCAS.",
  "I agree to allow MCAS personnel to conduct a follow-up home visit within 30 days of adoption.",
  "If I am unable to keep this animal for any reason, I agree to return the animal to MCAS.",
  "I understand that providing false information on this application is grounds for immediate revocation of the adoption.",
  "I release MCAS and Morgan County from any liability arising from the behavior of this animal after adoption.",
  "I have read and agree to all terms and conditions of this adoption agreement.",
];

interface Props {
  onSave: (form: ShelterForm) => void;
  onClose: () => void;
  prefill?: FormPreFill;
}

export function printApplication(d: Record<string, unknown>) {
  const w = window.open("", "_blank", "width=760,height=1060");
  if (!w) return;
  const blue = "#1a3a6b";
  const sig = (key: string) => d[key]
    ? `<img src="${d[key]}" style="width:200px;height:48px;object-fit:contain;display:block"/>`
    : `<div style="width:200px;height:48px;border-bottom:1.5px solid #000"></div>`;
  const fl = (label: string, val: string, minW = 160) =>
    `<div style="display:inline-flex;flex-direction:column;gap:1px;margin-right:16px;margin-bottom:8px">
      <div style="border-bottom:1px solid #000;min-width:${minW}px;padding-bottom:2px;font-size:10px">${val || "&nbsp;"}</div>
      <div style="font-size:8.5px;color:#555">${label}</div>
    </div>`;
  const sectionHead = (title: string) =>
    `<div style="background:${blue};color:#fff;padding:5px 10px;font-size:10px;font-weight:700;text-transform:uppercase;margin:14px 0 8px;letter-spacing:.5px">${title}</div>`;
  w.document.write(`<html><head><title>Pet Adoption Application</title>
  <style>body{font-family:Arial,sans-serif;font-size:10px;padding:22px;margin:0;line-height:1.5}
  h1{font-size:15px;font-weight:900;color:${blue};margin:0 0 2px;text-transform:uppercase}
  .sub{font-size:9px;color:#444;margin-bottom:14px}
  .page2{page-break-before:always;padding-top:18px}
  ol li{margin-bottom:5px;font-size:10px}
  .fee-row{display:flex;justify-content:space-between;border-bottom:1px solid #eee;padding:3px 0;font-size:10px}
  @media print{body{padding:14px}}</style></head><body>

  <!-- PAGE 1 -->
  <h1>Pet Adoption Application</h1>
  <div class="sub">Morgan County Animal Services &nbsp;|&nbsp; ${(d.application_date as string) || ""}</div>

  ${sectionHead("Animal Information")}
  <div>
    ${fl("Animal Name", d.animal_name as string, 130)}
    ${fl("Animal ID", d.animal_id as string, 100)}
    ${fl("Species", d.species as string, 70)}
    ${fl("Breed", d.breed as string, 120)}
    ${fl("Color", d.color as string, 80)}
    ${fl("Sex", d.sex as string, 50)}
    ${fl("Age", d.animal_age as string, 70)}
    ${fl("Fixed", d.fixed as string, 50)}
  </div>

  ${sectionHead("Adopter Information")}
  <div>
    ${fl("First Name", d.adopter_first as string)}
    ${fl("Last Name", d.adopter_last as string)}
    ${fl("Date of Birth", d.adopter_dob as string, 100)}
  </div>
  <div>
    ${fl("Address", d.adopter_address as string, 220)}
    ${fl("City", d.adopter_city as string, 100)}
    ${fl("State", d.adopter_state as string, 40)}
    ${fl("Zip", d.adopter_zip as string, 60)}
  </div>
  <div>
    ${fl("Phone", d.adopter_phone as string, 120)}
    ${fl("Email", d.adopter_email as string, 180)}
    ${fl("Driver's License #", d.adopter_dl as string, 120)}
    ${fl("ID State", d.adopter_dl_state as string, 50)}
  </div>

  ${sectionHead("Household Information")}
  <div>
    ${fl("Type of Residence", d.residence_type as string, 140)}
    ${fl("Own or Rent?", d.own_rent as string, 80)}
    ${fl("Landlord Permission for Pets?", d.landlord_ok as string, 50)}
  </div>
  <div>
    ${fl("# Adults in Home", d.adults_count as string, 80)}
    ${fl("# Children in Home", d.children_count as string, 80)}
    ${fl("Ages of Children", d.children_ages as string, 120)}
  </div>
  <div>
    ${fl("Other Pets Currently Owned", (d.other_pets as string) || "None", 320)}
  </div>

  ${sectionHead("Pet Care Plan")}
  <div>
    ${fl("Where will the animal be kept?", d.animal_location as string, 240)}
    ${fl("Primary caretaker if you travel", d.caretaker as string, 200)}
  </div>
  <div>
    ${fl("Preferred Veterinarian / Clinic", d.preferred_vet as string, 240)}
    ${fl("Vet Phone", d.vet_phone as string, 120)}
  </div>
  <div style="margin-top:6px;font-size:9px;font-weight:700">Reason for adopting:</div>
  <div style="border:1px solid #ccc;padding:6px;min-height:36px;font-size:10px;margin-top:4px">${d.adoption_reason as string || ""}</div>

  <!-- PAGE 2 -->
  <div class="page2">
  <h1>Adoption Agreement</h1>
  <div class="sub">Morgan County Animal Services</div>

  ${sectionHead("Terms and Conditions")}
  <ol style="margin:0;padding-left:16px">
    ${AGREEMENT_ITEMS.map((item) => `<li>${item}</li>`).join("")}
  </ol>

  ${sectionHead("Fees")}
  <div style="max-width:320px">
    <div class="fee-row"><span>Adoption Fee</span><span>${d.adoption_fee ? "$" + d.adoption_fee : "—"}</span></div>
    <div class="fee-row"><span>License Fee</span><span>${d.license_fee ? "$" + d.license_fee : "—"}</span></div>
    <div class="fee-row"><span>Microchip Fee</span><span>${d.microchip_fee ? "$" + d.microchip_fee : "—"}</span></div>
    <div class="fee-row" style="font-weight:700"><span>Total</span><span>${d.total_fees ? "$" + d.total_fees : "—"}</span></div>
    <div class="fee-row"><span>Payment Method</span><span>${d.payment_method as string || "—"}</span></div>
    <div class="fee-row"><span>Receipt #</span><span>${d.receipt_number as string || "—"}</span></div>
  </div>

  ${sectionHead("Office Use Only")}
  <div>
    ${fl("Processed By", d.processed_by as string, 160)}
    ${fl("Date", d.application_date as string, 100)}
    ${fl("Approved / Denied", d.approved as string, 80)}
  </div>
  <div>
    ${fl("Denial Reason (if applicable)", (d.denial_reason as string) || "", 300)}
  </div>

  ${sectionHead("Signatures")}
  <div style="display:flex;gap:50px;flex-wrap:wrap;margin-top:8px">
    <div>
      <div style="font-size:9px;font-weight:700;margin-bottom:4px">ADOPTER SIGNATURE</div>
      ${sig("adopter_sig")}
      <div style="font-size:8.5px;margin-top:3px">${fl("Printed Name", d.adopter_print as string, 180)}</div>
      <div style="font-size:8.5px">${fl("Date", d.sig_date as string, 100)}</div>
    </div>
    <div>
      <div style="font-size:9px;font-weight:700;margin-bottom:4px">MCAS STAFF SIGNATURE</div>
      ${sig("staff_sig")}
      <div style="font-size:8.5px;margin-top:3px">${fl("Printed Name", d.staff_print as string, 180)}</div>
      <div style="font-size:8.5px">${fl("Date", d.sig_date as string, 100)}</div>
    </div>
  </div>
  </div>

  </body></html>`);
  w.document.close();
  w.focus();
  setTimeout(() => w.print(), 400);
}

export default function AdoptionApplicationForm({ onSave, onClose, prefill }: Props) {
  const { user } = useAuth();
  const [saving, setSaving] = useState(false);
  const [people, setPeople] = useState<Person[]>([]);
  const [allAnimals, setAllAnimals] = useState<Animal[]>([]);

  // Animal search
  const [animalQuery, setAnimalQuery] = useState("");
  const [animalResults, setAnimalResults] = useState<Animal[]>([]);
  const [selectedAnimal, setSelectedAnimal] = useState<Animal | null>(null);

  // Adopter search
  const [adopterQuery, setAdopterQuery] = useState("");
  const [adopterResults, setAdopterResults] = useState<Person[]>([]);
  const [selectedAdopter, setSelectedAdopter] = useState<Person | null>(null);

  const [linkIds, setLinkIds] = useState<LinkIds>({ call_id: prefill?.call_id });

  // Page 1 fields — Animal
  const [animalName, setAnimalName] = useState(prefill?.animal_name || "");
  const [animalId, setAnimalId] = useState(prefill?.animal_id || "");
  const [species, setSpecies] = useState(prefill?.animal_species || "");
  const [breed, setBreed] = useState(prefill?.animal_breed || "");
  const [color, setColor] = useState(prefill?.animal_color || "");
  const [sex, setSex] = useState(prefill?.animal_sex || "");
  const [animalAge, setAnimalAge] = useState(prefill?.animal_age || "");
  const [fixed, setFixed] = useState(prefill?.animal_fixed !== undefined ? (prefill.animal_fixed ? "Yes" : "No") : "");

  // Page 1 fields — Adopter
  const [adopterFirst, setAdopterFirst] = useState(prefill?.person_first || "");
  const [adopterLast, setAdopterLast] = useState(prefill?.person_last || "");
  const [adopterDob, setAdopterDob] = useState("");
  const [adopterAddress, setAdopterAddress] = useState(prefill?.person_address || "");
  const [adopterCity, setAdopterCity] = useState(prefill?.person_city || "");
  const [adopterState, setAdopterState] = useState(prefill?.person_state || "GA");
  const [adopterZip, setAdopterZip] = useState(prefill?.person_zip || "");
  const [adopterPhone, setAdopterPhone] = useState(prefill?.person_phone || "");
  const [adopterEmail, setAdopterEmail] = useState(prefill?.person_email || "");
  const [adopterDl, setAdopterDl] = useState("");
  const [adopterDlState, setAdopterDlState] = useState("GA");

  // Household
  const [residenceType, setResidenceType] = useState("");
  const [ownRent, setOwnRent] = useState("");
  const [landlordOk, setLandlordOk] = useState("");
  const [adultsCount, setAdultsCount] = useState("");
  const [childrenCount, setChildrenCount] = useState("");
  const [childrenAges, setChildrenAges] = useState("");
  const [otherPets, setOtherPets] = useState("");

  // Pet care plan
  const [animalLocation, setAnimalLocation] = useState("");
  const [caretaker, setCaretaker] = useState("");
  const [preferredVet, setPreferredVet] = useState("");
  const [vetPhone, setVetPhone] = useState("");
  const [adoptionReason, setAdoptionReason] = useState("");

  // Fees
  const [adoptionFee, setAdoptionFee] = useState("");
  const [licenseFee, setLicenseFee] = useState("");
  const [microchipFee, setMicrochipFee] = useState("");
  const [totalFees, setTotalFees] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("");
  const [receiptNumber, setReceiptNumber] = useState("");

  // Office use
  const [processedBy, setProcessedBy] = useState(user?.username || "");
  const [approved, setApproved] = useState("");
  const [denialReason, setDenialReason] = useState("");
  const [applicationDate, setApplicationDate] = useState(today());

  // Signatures
  const [adopterSig, setAdopterSig] = useState<{ value: string; timestamp: string } | null>(null);
  const [staffSig, setStaffSig] = useState<{ value: string; timestamp: string } | null>(null);
  const [adopterPrint, setAdopterPrint] = useState("");
  const [staffPrint, setStaffPrint] = useState(user?.username || "");

  useEffect(() => {
    fetchPeople().then((ps) => {
      setPeople(ps);
      if (prefill?.person_id) {
        const p = ps.find((x) => x.id === prefill.person_id);
        if (p) {
          setSelectedAdopter(p);
          setAdopterQuery(`${p.first_name} ${p.last_name}`);
          setAdopterFirst(p.first_name); setAdopterLast(p.last_name);
          setAdopterAddress(p.address || ""); setAdopterCity(p.city || "");
          setAdopterState(p.state || "GA"); setAdopterZip(p.zip || "");
          setAdopterPhone(p.phone || ""); setAdopterEmail(p.email || "");
          setAdopterPrint(`${p.first_name} ${p.last_name}`);
        }
      }
    });
    fetchAnimals().then((as) => {
      setAllAnimals(as);
      if (prefill?.animal_id) {
        const a = as.find((x) => x.id === prefill.animal_id);
        if (a) {
          setSelectedAnimal(a);
          setAnimalQuery(a.name);
          setAnimalName(a.name); setAnimalId(a.id);
          setSpecies(a.species || ""); setBreed(a.breed || "");
          setColor(a.color || ""); setSex(a.sex || "");
          setAnimalAge(a.age || ""); setFixed(a.fixed ? "Yes" : "No");
        }
      }
    });
  }, [prefill?.person_id, prefill?.animal_id]);

  // Animal search
  useEffect(() => {
    if (!animalQuery.trim()) { setAnimalResults([]); return; }
    const q = animalQuery.toLowerCase();
    setAnimalResults(allAnimals.filter((a) =>
      a.name.toLowerCase().includes(q) || a.id.toLowerCase().includes(q) || (a.microchip || "").includes(q)
    ).slice(0, 8));
  }, [animalQuery, allAnimals]);

  const selectAnimal = (a: Animal) => {
    setSelectedAnimal(a);
    setAnimalQuery(a.name);
    setAnimalResults([]);
    setAnimalName(a.name);
    setAnimalId(a.id);
    setSpecies(a.species || "");
    setBreed(a.breed || "");
    setColor(a.color || "");
    setSex(a.sex || "");
    setAnimalAge(a.age || "");
    setFixed(a.fixed ? "Yes" : "No");
  };

  // Adopter search
  useEffect(() => {
    if (!adopterQuery.trim()) { setAdopterResults([]); return; }
    const q = adopterQuery.toLowerCase();
    setAdopterResults(people.filter((p) =>
      `${p.first_name} ${p.last_name}`.toLowerCase().includes(q) || (p.phone || "").includes(q)
    ).slice(0, 8));
  }, [adopterQuery, people]);

  const selectAdopter = (p: Person) => {
    setSelectedAdopter(p);
    setAdopterQuery(`${p.first_name} ${p.last_name}`);
    setAdopterResults([]);
    setAdopterFirst(p.first_name);
    setAdopterLast(p.last_name);
    setAdopterAddress(p.address || "");
    setAdopterCity(p.city || "");
    setAdopterState(p.state || "GA");
    setAdopterZip(p.zip || "");
    setAdopterPhone(p.phone || "");
    setAdopterEmail(p.email || "");
    setAdopterPrint(`${p.first_name} ${p.last_name}`);
  };

  // Auto-compute total fees
  useEffect(() => {
    const sum = [adoptionFee, licenseFee, microchipFee]
      .map((v) => parseFloat(v) || 0)
      .reduce((a, b) => a + b, 0);
    setTotalFees(sum > 0 ? sum.toFixed(2) : "");
  }, [adoptionFee, licenseFee, microchipFee]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const formData: Record<string, unknown> = {
        application_date: applicationDate,
        animal_id: animalId, animal_name: animalName, species, breed, color, sex, animal_age: animalAge, fixed,
        adopter_first: adopterFirst, adopter_last: adopterLast, adopter_dob: adopterDob,
        adopter_address: adopterAddress, adopter_city: adopterCity, adopter_state: adopterState,
        adopter_zip: adopterZip, adopter_phone: adopterPhone, adopter_email: adopterEmail,
        adopter_dl: adopterDl, adopter_dl_state: adopterDlState,
        residence_type: residenceType, own_rent: ownRent, landlord_ok: landlordOk,
        adults_count: adultsCount, children_count: childrenCount, children_ages: childrenAges,
        other_pets: otherPets, animal_location: animalLocation, caretaker, preferred_vet: preferredVet,
        vet_phone: vetPhone, adoption_reason: adoptionReason,
        adoption_fee: adoptionFee, license_fee: licenseFee, microchip_fee: microchipFee,
        total_fees: totalFees, payment_method: paymentMethod, receipt_number: receiptNumber,
        processed_by: processedBy, approved, denial_reason: denialReason,
        adopter_sig: adopterSig?.value || null, adopter_print: adopterPrint,
        staff_sig: staffSig?.value || null, staff_print: staffPrint,
        sig_date: applicationDate,
      };
      const saved = await createForm({
        form_type: "adoption_application",
        form_data: formData,
        linked_call_id: linkIds.call_id,
        linked_animal_id: selectedAnimal?.id || prefill?.animal_id,
        linked_person_id: selectedAdopter?.id || prefill?.person_id,
        created_by: user?.username || "",
      });
      onSave(saved);
    } catch (e) {
      console.error("AdoptionApplicationForm save error:", e);
    } finally {
      setSaving(false);
    }
  };

  const fieldStyle: React.CSSProperties = { padding: "5px 8px", border: "1px solid var(--border)", borderRadius: 4, fontSize: 13, background: "var(--surface)", color: "var(--text-primary)", width: "100%" };
  const labelStyle: React.CSSProperties = { fontSize: 11, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 3, display: "block" };
  const sectionHead: React.CSSProperties = { background: MCAS_BLUE, color: "#fff", padding: "6px 12px", fontSize: 12, fontWeight: 700, textTransform: "uppercase", borderRadius: 4, marginBottom: 12, letterSpacing: 0.5 };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 1000, display: "flex", alignItems: "flex-start", justifyContent: "center", overflowY: "auto", padding: "24px 16px" }}>
      <div style={{ background: "var(--surface)", borderRadius: 10, width: "100%", maxWidth: 780, padding: 28, position: "relative" }}>

        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
          <div>
            <div style={{ fontWeight: 900, fontSize: 17, color: MCAS_BLUE }}>Pet Adoption Application</div>
            <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 2 }}>Morgan County Animal Services</div>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 22, cursor: "pointer", color: "var(--text-secondary)" }}>✕</button>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 20 }}>
          <div>
            <label style={labelStyle}>Application Date</label>
            <DateInput style={fieldStyle} value={applicationDate} onChange={(e) => setApplicationDate(e.target.value)} />
          </div>
        </div>

        {/* === PAGE 1 === */}
        <div style={sectionHead}>Animal Information</div>
        <div style={{ position: "relative", marginBottom: 12 }}>
          <label style={labelStyle}>Search Animal Record</label>
          <input style={fieldStyle} placeholder="Name, Animal ID, or microchip…" value={animalQuery}
            onChange={(e) => { setAnimalQuery(e.target.value); setSelectedAnimal(null); }} />
          {animalResults.length > 0 && (
            <div style={{ position: "absolute", top: "100%", left: 0, right: 0, background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 6, zIndex: 50, boxShadow: "0 4px 12px rgba(0,0,0,0.15)", maxHeight: 220, overflowY: "auto" }}>
              {animalResults.map((a) => (
                <div key={a.id} onClick={() => selectAnimal(a)}
                  style={{ padding: "8px 12px", cursor: "pointer", fontSize: 13, borderBottom: "1px solid var(--border)" }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "var(--surface-alt)")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "var(--surface)")}>
                  <strong>{a.name}</strong> <span style={{ color: "var(--text-secondary)", fontSize: 11 }}>{a.species} · {a.breed} · {a.color}</span>
                </div>
              ))}
            </div>
          )}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, marginBottom: 16 }}>
          <div><label style={labelStyle}>Name</label><input style={fieldStyle} value={animalName} onChange={(e) => setAnimalName(e.target.value)} /></div>
          <div><label style={labelStyle}>Animal ID</label><input style={fieldStyle} value={animalId} onChange={(e) => setAnimalId(e.target.value)} /></div>
          <div><label style={labelStyle}>Species</label><input style={fieldStyle} value={species} onChange={(e) => setSpecies(e.target.value)} /></div>
          <div><label style={labelStyle}>Breed</label><input style={fieldStyle} value={breed} onChange={(e) => setBreed(e.target.value)} /></div>
          <div><label style={labelStyle}>Color</label><input style={fieldStyle} value={color} onChange={(e) => setColor(e.target.value)} /></div>
          <div>
            <label style={labelStyle}>Sex</label>
            <select style={fieldStyle} value={sex} onChange={(e) => setSex(e.target.value)}>
              <option value="">—</option>
              <option>Male</option><option>Female</option>
            </select>
          </div>
          <div><label style={labelStyle}>Age</label><input style={fieldStyle} value={animalAge} onChange={(e) => setAnimalAge(e.target.value)} /></div>
          <div>
            <label style={labelStyle}>Fixed</label>
            <select style={fieldStyle} value={fixed} onChange={(e) => setFixed(e.target.value)}>
              <option value="">—</option><option>Yes</option><option>No</option>
            </select>
          </div>
        </div>

        <div style={sectionHead}>Adopter Information</div>
        <div style={{ position: "relative", marginBottom: 12 }}>
          <label style={labelStyle}>Search Existing Contact</label>
          <input style={fieldStyle} placeholder="Name or phone…" value={adopterQuery}
            onChange={(e) => { setAdopterQuery(e.target.value); setSelectedAdopter(null); }} />
          {adopterResults.length > 0 && (
            <div style={{ position: "absolute", top: "100%", left: 0, right: 0, background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 6, zIndex: 50, boxShadow: "0 4px 12px rgba(0,0,0,0.15)", maxHeight: 220, overflowY: "auto" }}>
              {adopterResults.map((p) => (
                <div key={p.id} onClick={() => selectAdopter(p)}
                  style={{ padding: "8px 12px", cursor: "pointer", fontSize: 13, borderBottom: "1px solid var(--border)" }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "var(--surface-alt)")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "var(--surface)")}>
                  <strong>{p.first_name} {p.last_name}</strong> <span style={{ color: "var(--text-secondary)", fontSize: 11 }}>{p.phone} · {p.address}</span>
                </div>
              ))}
            </div>
          )}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 10 }}>
          <div><label style={labelStyle}>First Name</label><input style={fieldStyle} value={adopterFirst} onChange={(e) => setAdopterFirst(e.target.value)} /></div>
          <div><label style={labelStyle}>Last Name</label><input style={fieldStyle} value={adopterLast} onChange={(e) => setAdopterLast(e.target.value)} /></div>
          <div><label style={labelStyle}>Date of Birth</label><DateInput style={fieldStyle} value={adopterDob} onChange={(e) => setAdopterDob(e.target.value)} /></div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr", gap: 10, marginBottom: 10 }}>
          <div><label style={labelStyle}>Address</label><input style={fieldStyle} value={adopterAddress} onChange={(e) => setAdopterAddress(e.target.value)} /></div>
          <div><label style={labelStyle}>City</label><input style={fieldStyle} value={adopterCity} onChange={(e) => setAdopterCity(e.target.value)} /></div>
          <div><label style={labelStyle}>State</label><input style={fieldStyle} value={adopterState} onChange={(e) => setAdopterState(e.target.value)} /></div>
          <div><label style={labelStyle}>Zip</label><input style={fieldStyle} value={adopterZip} onChange={(e) => setAdopterZip(e.target.value)} /></div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 10, marginBottom: 16 }}>
          <div><label style={labelStyle}>Phone</label><input style={fieldStyle} value={adopterPhone} onChange={(e) => setAdopterPhone(e.target.value)} /></div>
          <div><label style={labelStyle}>Email</label><input style={fieldStyle} value={adopterEmail} onChange={(e) => setAdopterEmail(e.target.value)} /></div>
          <div><label style={labelStyle}>Driver's License #</label><input style={fieldStyle} value={adopterDl} onChange={(e) => setAdopterDl(e.target.value)} /></div>
          <div><label style={labelStyle}>DL State</label><input style={fieldStyle} value={adopterDlState} onChange={(e) => setAdopterDlState(e.target.value)} /></div>
        </div>

        <div style={sectionHead}>Household Information</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 10 }}>
          <div>
            <label style={labelStyle}>Type of Residence</label>
            <select style={fieldStyle} value={residenceType} onChange={(e) => setResidenceType(e.target.value)}>
              <option value="">— Select —</option>
              <option>House</option><option>Apartment</option><option>Condo/Townhouse</option>
              <option>Mobile Home</option><option>Farm/Rural Property</option><option>Other</option>
            </select>
          </div>
          <div>
            <label style={labelStyle}>Own or Rent?</label>
            <select style={fieldStyle} value={ownRent} onChange={(e) => setOwnRent(e.target.value)}>
              <option value="">—</option><option>Own</option><option>Rent</option>
            </select>
          </div>
          <div>
            <label style={labelStyle}>Landlord Permits Pets?</label>
            <select style={fieldStyle} value={landlordOk} onChange={(e) => setLandlordOk(e.target.value)}>
              <option value="">—</option><option>Yes</option><option>No</option><option>N/A (Own)</option>
            </select>
          </div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 10 }}>
          <div><label style={labelStyle}># Adults in Home</label><input style={fieldStyle} value={adultsCount} onChange={(e) => setAdultsCount(e.target.value)} /></div>
          <div><label style={labelStyle}># Children in Home</label><input style={fieldStyle} value={childrenCount} onChange={(e) => setChildrenCount(e.target.value)} /></div>
          <div><label style={labelStyle}>Ages of Children</label><input style={fieldStyle} value={childrenAges} onChange={(e) => setChildrenAges(e.target.value)} placeholder="e.g. 4, 8, 12" /></div>
        </div>
        <div style={{ marginBottom: 16 }}>
          <label style={labelStyle}>Other Pets Currently Owned (name, species, age)</label>
          <input style={fieldStyle} value={otherPets} onChange={(e) => setOtherPets(e.target.value)} placeholder="e.g. Buddy – Dog – 3 yrs; Luna – Cat – 5 yrs" />
        </div>

        <div style={sectionHead}>Pet Care Plan</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
          <div>
            <label style={labelStyle}>Where will the animal be kept?</label>
            <select style={fieldStyle} value={animalLocation} onChange={(e) => setAnimalLocation(e.target.value)}>
              <option value="">— Select —</option>
              <option>Indoors only</option><option>Outdoors only</option><option>Indoors and Outdoors</option>
              <option>Kennel / Run</option><option>Barn / Farm</option>
            </select>
          </div>
          <div>
            <label style={labelStyle}>Primary caretaker if you travel</label>
            <input style={fieldStyle} value={caretaker} onChange={(e) => setCaretaker(e.target.value)} />
          </div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
          <div><label style={labelStyle}>Preferred Veterinarian / Clinic</label><input style={fieldStyle} value={preferredVet} onChange={(e) => setPreferredVet(e.target.value)} /></div>
          <div><label style={labelStyle}>Vet Phone</label><input style={fieldStyle} value={vetPhone} onChange={(e) => setVetPhone(e.target.value)} /></div>
        </div>
        <div style={{ marginBottom: 20 }}>
          <label style={labelStyle}>Reason for adopting</label>
          <textarea style={{ ...fieldStyle, minHeight: 60, resize: "vertical" }} value={adoptionReason} onChange={(e) => setAdoptionReason(e.target.value)} />
        </div>

        {/* === PAGE 2 === */}
        <div style={sectionHead}>Adoption Agreement</div>
        <ol style={{ margin: "0 0 20px", paddingLeft: 20, fontSize: 13, lineHeight: 1.9 }}>
          {AGREEMENT_ITEMS.map((item, i) => (
            <li key={i}>{item}</li>
          ))}
        </ol>

        <div style={sectionHead}>Fees</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr) 1fr 1fr 1fr", gap: 10, marginBottom: 16 }}>
          <div><label style={labelStyle}>Adoption Fee ($)</label><input style={fieldStyle} type="number" min="0" step="0.01" value={adoptionFee} onChange={(e) => setAdoptionFee(e.target.value)} /></div>
          <div><label style={labelStyle}>License Fee ($)</label><input style={fieldStyle} type="number" min="0" step="0.01" value={licenseFee} onChange={(e) => setLicenseFee(e.target.value)} /></div>
          <div><label style={labelStyle}>Microchip Fee ($)</label><input style={fieldStyle} type="number" min="0" step="0.01" value={microchipFee} onChange={(e) => setMicrochipFee(e.target.value)} /></div>
          <div>
            <label style={labelStyle}>Total ($)</label>
            <input style={{ ...fieldStyle, background: "var(--surface-alt)", fontWeight: 700 }} value={totalFees} readOnly />
          </div>
          <div>
            <label style={labelStyle}>Payment Method</label>
            <select style={fieldStyle} value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}>
              <option value="">—</option>
              <option>Cash</option><option>Check</option><option>Credit Card</option>
              <option>Debit Card</option><option>Money Order</option><option>Online</option>
            </select>
          </div>
          <div><label style={labelStyle}>Receipt #</label><input style={fieldStyle} value={receiptNumber} onChange={(e) => setReceiptNumber(e.target.value)} /></div>
        </div>

        <div style={sectionHead}>Office Use Only</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 16 }}>
          <div><label style={labelStyle}>Processed By</label><input style={fieldStyle} value={processedBy} onChange={(e) => setProcessedBy(e.target.value)} /></div>
          <div>
            <label style={labelStyle}>Approved / Denied</label>
            <select style={fieldStyle} value={approved} onChange={(e) => setApproved(e.target.value)}>
              <option value="">— Pending —</option>
              <option value="Approved">Approved</option>
              <option value="Denied">Denied</option>
            </select>
          </div>
          {approved === "Denied" && (
            <div><label style={labelStyle}>Denial Reason</label><input style={fieldStyle} value={denialReason} onChange={(e) => setDenialReason(e.target.value)} /></div>
          )}
        </div>

        <div style={sectionHead}>Signatures</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 20 }}>
          <div>
            <SignaturePad
              label="Adopter Signature"
              value={adopterSig?.value || null}
              timestamp={adopterSig?.timestamp || null}
              onAccept={(val, ts) => setAdopterSig({ value: val, timestamp: ts })}
              onClear={() => setAdopterSig(null)}
            />
            <div style={{ marginTop: 8 }}>
              <label style={labelStyle}>Adopter Printed Name</label>
              <input style={fieldStyle} value={adopterPrint} onChange={(e) => setAdopterPrint(e.target.value)} />
            </div>
          </div>
          <div>
            <SignaturePad
              label="MCAS Staff Signature"
              value={staffSig?.value || null}
              timestamp={staffSig?.timestamp || null}
              onAccept={(val, ts) => setStaffSig({ value: val, timestamp: ts })}
              onClear={() => setStaffSig(null)}
            />
            <div style={{ marginTop: 8 }}>
              <label style={labelStyle}>Staff Printed Name</label>
              <input style={fieldStyle} value={staffPrint} onChange={(e) => setStaffPrint(e.target.value)} />
            </div>
          </div>
        </div>

        <div style={{ padding: "0 0 16px" }}>
          <LinkToSection value={linkIds} onChange={setLinkIds} exclude={["animal", "person"]} />
        </div>

        {/* Actions */}
        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", borderTop: "1px solid var(--border)", paddingTop: 16 }}>
          <button className="btn btn-secondary" onClick={() => {
            const d: Record<string, unknown> = {
              application_date: applicationDate,
              animal_id: animalId, animal_name: animalName, species, breed, color, sex, animal_age: animalAge, fixed,
              adopter_first: adopterFirst, adopter_last: adopterLast, adopter_dob: adopterDob,
              adopter_address: adopterAddress, adopter_city: adopterCity, adopter_state: adopterState,
              adopter_zip: adopterZip, adopter_phone: adopterPhone, adopter_email: adopterEmail,
              adopter_dl: adopterDl, adopter_dl_state: adopterDlState,
              residence_type: residenceType, own_rent: ownRent, landlord_ok: landlordOk,
              adults_count: adultsCount, children_count: childrenCount, children_ages: childrenAges,
              other_pets: otherPets, animal_location: animalLocation, caretaker,
              preferred_vet: preferredVet, vet_phone: vetPhone, adoption_reason: adoptionReason,
              adoption_fee: adoptionFee, license_fee: licenseFee, microchip_fee: microchipFee,
              total_fees: totalFees, payment_method: paymentMethod, receipt_number: receiptNumber,
              processed_by: processedBy, approved, denial_reason: denialReason,
              adopter_sig: adopterSig?.value || null, adopter_print: adopterPrint,
              staff_sig: staffSig?.value || null, staff_print: staffPrint,
              sig_date: applicationDate,
            };
            printApplication(d);
          }}>🖨 Print</button>
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? "Saving…" : "Save Form"}
          </button>
        </div>
      </div>
    </div>
  );
}
