"use client";

import { useState, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import { createAnimal, createMedical } from "@/lib/data";
import type { Person, MedicalRecord } from "@/lib/types";
import {
  CLINIC_SERVICES, ALL_BREEDS_DOG, ALL_BREEDS_CAT, ALL_COLORS,
} from "@/lib/constants";
import MicrochipBadge from "@/components/ui/MicrochipBadge";
import { today, nowTime, genId } from "@/lib/utils";
import DateInput from "@/components/ui/DateInput";

interface Props {
  people: Person[];
  onComplete: () => void;
  onClose: () => void;
}

type Step = 1 | 2 | 3 | 4;

const CATEGORY_ORDER = ["Vaccine", "Microchip", "Parasite Control", "Tests & Checkup"];

// ── Small helpers ─────────────────────────────────────────────────────────────
function SB({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ fontSize: 13, marginBottom: 4 }}>
      <span style={{ color: "var(--text-secondary)", width: 120, display: "inline-block" }}>{label}</span>
      <strong>{value || "—"}</strong>
    </div>
  );
}

function StepDot({ n, current }: { n: number; current: number }) {
  const done   = current > n;
  const active = current === n;
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
      <div style={{
        width: 32, height: 32, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center",
        fontWeight: 700, fontSize: 13,
        background: done ? "#0d9488" : active ? "#0f2942" : "#e2e8f0",
        color: (done || active) ? "#fff" : "#94a3b8",
        border: active ? "3px solid #0d9488" : "none",
        transition: "all 0.2s",
      }}>
        {done ? "✓" : n}
      </div>
      <div style={{ fontSize: 10, color: active ? "#0f2942" : "#94a3b8", fontWeight: active ? 700 : 400 }}>
        {["Owner", "Animal", "Services", "Review"][n - 1]}
      </div>
    </div>
  );
}

export default function ClinicWizard({ people, onComplete, onClose }: Props) {
  const [step, setStep] = useState<Step>(1);
  const [saving, setSaving] = useState(false);

  // Step 1 — Owner
  const [ownerQuery, setOwnerQuery] = useState("");
  const [selectedOwner, setSelectedOwner] = useState<Person | null>(null);
  const [newOwner, setNewOwner] = useState({ firstName: "", lastName: "", phone: "", email: "", address: "", city: "" });
  const [creatingOwner, setCreatingOwner] = useState(false);

  // Step 2 — Animal
  const [species, setSpecies] = useState<"Dog" | "Cat" | "Other">("Dog");
  const [name, setName] = useState("");
  const [breed, setBreed] = useState("");
  const [sex, setSex] = useState("Unknown");
  const [dob, setDob] = useState("");
  const [weight, setWeight] = useState("");
  const [color, setColor] = useState("");
  const [microchip, setMicrochip] = useState("");
  const [chiefComplaint, setChiefComplaint] = useState("");

  // Step 3 — Services
  const [selectedServices, setSelectedServices] = useState<Set<string>>(new Set());

  // ── Owner search ─────────────────────────────────────────────────────────
  const ownerMatches = useMemo(() => {
    const q = ownerQuery.trim().toLowerCase();
    if (q.length < 2) return [];
    return people
      .filter((p) => `${p.first_name} ${p.last_name}`.toLowerCase().includes(q) || (p.phone || "").includes(q))
      .slice(0, 6);
  }, [people, ownerQuery]);

  async function handleCreateOwner() {
    if (!newOwner.firstName.trim() || !newOwner.lastName.trim()) return;
    setCreatingOwner(true);
    const { data } = await supabase.from("people").insert({
      id: genId(),
      first_name: newOwner.firstName.trim(),
      last_name: newOwner.lastName.trim(),
      phone: newOwner.phone.trim() || null,
      email: newOwner.email.trim() || null,
      address: newOwner.address.trim() || null,
      city: newOwner.city.trim() || null,
      role: "Previous Owner",
      date_added: today(),
    }).select().single();
    setCreatingOwner(false);
    if (data) {
      setSelectedOwner(data as Person);
      setNewOwner({ firstName: "", lastName: "", phone: "", email: "", address: "", city: "" });
    }
  }

  // ── Services helpers ──────────────────────────────────────────────────────
  const visibleServices = CLINIC_SERVICES.filter(
    (s) => !s.species || s.species === species || species === "Other"
  );

  const servicesByCategory = CATEGORY_ORDER.map((cat) => ({
    cat,
    services: visibleServices.filter((s) => s.category === cat),
  })).filter((g) => g.services.length > 0);

  function toggleService(id: string) {
    setSelectedServices((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  const selectedServicesList = CLINIC_SERVICES.filter((s) => selectedServices.has(s.id));

  // ── Validation ────────────────────────────────────────────────────────────
  const canNext1 = true; // owner optional
  const canNext2 = name.trim().length > 0;
  const canNext3 = selectedServices.size > 0;

  // ── Submit ────────────────────────────────────────────────────────────────
  async function handleCheckIn() {
    setSaving(true);
    try {
      // Create animal record
      const animal = await createAnimal({
        name: name.trim() || "Unknown",
        species,
        breed: breed || "Unknown",
        sex,
        dob: dob || undefined,
        weight: weight || undefined,
        color: color || "Unknown",
        microchip: microchip || undefined,
        intake_type: "Clinic",
        intake_date: today(),
        status: "Clinic Visit",
        sub_status: "Waiting",
        injuries: chiefComplaint || undefined,
      });

      // Link owner
      if (selectedOwner) {
        await supabase.from("animal_people").insert({
          animal_id: animal.id,
          person_id: selectedOwner.id,
        });
      }

      // Create medical records for each selected service
      const now = today();
      const medPromises = selectedServicesList.map((svc) =>
        createMedical({
          animal_id: animal.id,
          animal_name: animal.name,
          type: svc.medical.type,
          description: svc.medical.description,
          date: now,
          status: "Scheduled",
        } as Partial<MedicalRecord>)
      );
      await Promise.all(medPromises);

      onComplete();
    } catch (err) {
      console.error("[ClinicWizard] check-in failed:", err);
    } finally {
      setSaving(false);
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────
  const breeds = species === "Cat" ? ALL_BREEDS_CAT : ALL_BREEDS_DOG;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: 620, width: "100%", maxHeight: "90dvh", display: "flex", flexDirection: "column" }}
      >
        {/* Header */}
        <div className="modal-header">
          <span className="modal-title">💉 Clinic Check-In</span>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>✕</button>
        </div>

        {/* Step indicator */}
        <div style={{ padding: "12px 24px", borderBottom: "1px solid var(--border-light)", display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          {[1, 2, 3, 4].map((n) => (
            <StepDot key={n} n={n} current={step} />
          ))}
        </div>

        {/* Body */}
        <div className="modal-body" style={{ flex: 1, overflowY: "auto" }}>

          {/* ── Step 1: Owner ── */}
          {step === 1 && (
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: "#0f2942", marginBottom: 14 }}>Owner / Client Information</div>

              {selectedOwner ? (
                <div style={{ background: "#f0fdf4", border: "1px solid #86efac", borderRadius: 8, padding: "10px 14px", display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 14 }}>✓ {selectedOwner.first_name} {selectedOwner.last_name}</div>
                    {selectedOwner.phone && <div style={{ fontSize: 12, color: "#64748b" }}>{selectedOwner.phone}</div>}
                  </div>
                  <button className="btn btn-ghost btn-sm" onClick={() => setSelectedOwner(null)}>Change</button>
                </div>
              ) : (
                <>
                  <div className="form-group">
                    <label className="form-label">Search existing client</label>
                    <input
                      className="form-input"
                      placeholder="Name or phone number…"
                      value={ownerQuery}
                      onChange={(e) => setOwnerQuery(e.target.value)}
                      autoFocus
                    />
                    {ownerMatches.length > 0 && (
                      <div style={{ border: "1px solid var(--border)", borderRadius: 6, marginTop: 4, overflow: "hidden" }}>
                        {ownerMatches.map((p) => (
                          <div
                            key={p.id}
                            onClick={() => { setSelectedOwner(p); setOwnerQuery(""); }}
                            style={{ padding: "8px 12px", cursor: "pointer", fontSize: 13, borderBottom: "1px solid var(--border-light)" }}
                            className="hover-bg"
                          >
                            <strong>{p.first_name} {p.last_name}</strong>
                            {p.phone && <span style={{ color: "#64748b" }}> · {p.phone}</span>}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div style={{ borderTop: "1px solid var(--border-light)", paddingTop: 14, marginTop: 4 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "#374151", marginBottom: 10 }}>Or create new client</div>
                    <div className="grid-2">
                      <div className="form-group">
                        <label className="form-label">First Name <span style={{ color: "#dc2626" }}>*</span></label>
                        <input className="form-input" value={newOwner.firstName} onChange={(e) => setNewOwner((p) => ({ ...p, firstName: e.target.value }))} />
                      </div>
                      <div className="form-group">
                        <label className="form-label">Last Name <span style={{ color: "#dc2626" }}>*</span></label>
                        <input className="form-input" value={newOwner.lastName} onChange={(e) => setNewOwner((p) => ({ ...p, lastName: e.target.value }))} />
                      </div>
                      <div className="form-group">
                        <label className="form-label">Phone</label>
                        <input className="form-input" type="tel" value={newOwner.phone} onChange={(e) => setNewOwner((p) => ({ ...p, phone: e.target.value }))} />
                      </div>
                      <div className="form-group">
                        <label className="form-label">Email</label>
                        <input className="form-input" type="email" value={newOwner.email} onChange={(e) => setNewOwner((p) => ({ ...p, email: e.target.value }))} />
                      </div>
                    </div>
                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={handleCreateOwner}
                      disabled={creatingOwner || !newOwner.firstName.trim() || !newOwner.lastName.trim()}
                    >
                      {creatingOwner ? "Saving…" : "Save & Select"}
                    </button>
                  </div>

                  <div style={{ marginTop: 12, fontSize: 12, color: "#94a3b8" }}>
                    Owner info is optional — you can skip this step for anonymous walk-ins.
                  </div>
                </>
              )}
            </div>
          )}

          {/* ── Step 2: Animal ── */}
          {step === 2 && (
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: "#0f2942", marginBottom: 14 }}>Animal Information</div>

              {/* Species toggle */}
              <div className="form-group">
                <label className="form-label">Species</label>
                <div style={{ display: "flex", gap: 8 }}>
                  {(["Dog", "Cat", "Other"] as const).map((s) => (
                    <button
                      key={s}
                      onClick={() => { setSpecies(s); setBreed(""); }}
                      style={{
                        padding: "8px 18px", borderRadius: 8, border: "2px solid",
                        borderColor: species === s ? "#0f2942" : "var(--border)",
                        background: species === s ? "#0f2942" : "#fff",
                        color: species === s ? "#fff" : "var(--text)",
                        fontWeight: 700, fontSize: 13, cursor: "pointer",
                      }}
                    >
                      {s === "Dog" ? "🐕" : s === "Cat" ? "🐈" : "🐾"} {s}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label">Pet Name <span style={{ color: "#dc2626" }}>*</span></label>
                  <input className="form-input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Animal's name" autoFocus />
                </div>
                <div className="form-group">
                  <label className="form-label">Breed</label>
                  {species === "Other" ? (
                    <input className="form-input" value={breed} onChange={(e) => setBreed(e.target.value)} placeholder="Breed / type" />
                  ) : (
                    <select className="form-select" value={breed} onChange={(e) => setBreed(e.target.value)}>
                      {breeds.map((b) => <option key={b} value={b}>{b || "— Select —"}</option>)}
                    </select>
                  )}
                </div>
                <div className="form-group">
                  <label className="form-label">Sex</label>
                  <select className="form-select" value={sex} onChange={(e) => setSex(e.target.value)}>
                    {["Unknown", "Male", "Female"].map((s) => <option key={s}>{s}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Date of Birth</label>
                  <DateInput className="form-input" value={dob} onChange={(e) => setDob(e.target.value)} />
                </div>
                <div className="form-group">
                  <label className="form-label">Weight (lbs)</label>
                  <input className="form-input" value={weight} onChange={(e) => setWeight(e.target.value)} placeholder="e.g. 45" />
                </div>
                <div className="form-group">
                  <label className="form-label">Primary Color</label>
                  <select className="form-select" value={color} onChange={(e) => setColor(e.target.value)}>
                    {ALL_COLORS.map((c) => <option key={c} value={c}>{c || "— Select —"}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Microchip #</label>
                  <input className="form-input" value={microchip} onChange={(e) => setMicrochip(e.target.value)} placeholder="Scan or enter" />
                  {microchip.length >= 6 && <MicrochipBadge chip={microchip} compact />}
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Reason for Visit / Chief Complaint</label>
                <textarea
                  className="form-input"
                  rows={2}
                  value={chiefComplaint}
                  onChange={(e) => setChiefComplaint(e.target.value)}
                  placeholder="e.g. Annual vaccines, found stray and needs chip scan, etc."
                  style={{ resize: "vertical" }}
                />
              </div>
            </div>
          )}

          {/* ── Step 3: Services ── */}
          {step === 3 && (
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: "#0f2942" }}>Services</div>
                {selectedServices.size > 0 && (
                  <span style={{ fontSize: 12, color: "#0d9488", fontWeight: 700 }}>
                    {selectedServices.size} selected
                  </span>
                )}
              </div>

              {servicesByCategory.map(({ cat, services }) => (
                <div key={cat} style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>{cat}</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {services.map((svc) => {
                      const checked = selectedServices.has(svc.id);
                      return (
                        <label
                          key={svc.id}
                          style={{
                            display: "flex", alignItems: "center", gap: 10, padding: "10px 12px",
                            border: `2px solid ${checked ? "#0d9488" : "var(--border)"}`,
                            borderRadius: 8, cursor: "pointer",
                            background: checked ? "#f0fdfa" : "var(--bg)",
                            transition: "all 0.15s",
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleService(svc.id)}
                            style={{ width: 16, height: 16, accentColor: "#0d9488" }}
                          />
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: 13, fontWeight: checked ? 700 : 400, color: checked ? "#0f2942" : "var(--text)" }}>
                              {svc.label}
                            </div>
                            {svc.species && (
                              <div style={{ fontSize: 11, color: "#94a3b8" }}>{svc.species} only</div>
                            )}
                          </div>
                          {svc.defaultFee != null && svc.defaultFee > 0 && (
                            <div style={{ fontSize: 12, color: "#64748b", fontWeight: 600 }}>
                              ${svc.defaultFee}
                            </div>
                          )}
                        </label>
                      );
                    })}
                  </div>
                </div>
              ))}

              {selectedServices.size === 0 && (
                <div style={{ fontSize: 12, color: "#ef4444", marginTop: 8 }}>Please select at least one service.</div>
              )}
            </div>
          )}

          {/* ── Step 4: Review ── */}
          {step === 4 && (
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: "#0f2942", marginBottom: 14 }}>Review & Confirm</div>

              <div style={{ background: "var(--bg-alt)", borderRadius: 10, padding: 16, marginBottom: 14 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 10 }}>Owner</div>
                {selectedOwner
                  ? <SB label="Name" value={`${selectedOwner.first_name} ${selectedOwner.last_name}`} />
                  : <div style={{ fontSize: 13, color: "#94a3b8" }}>No owner on file</div>
                }
                {selectedOwner?.phone && <SB label="Phone" value={selectedOwner.phone} />}
              </div>

              <div style={{ background: "var(--bg-alt)", borderRadius: 10, padding: 16, marginBottom: 14 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 10 }}>Animal</div>
                <SB label="Name" value={name || "Unknown"} />
                <SB label="Species" value={species} />
                {breed && <SB label="Breed" value={breed} />}
                <SB label="Sex" value={sex} />
                {weight && <SB label="Weight" value={`${weight} lbs`} />}
                {color && <SB label="Color" value={color} />}
                {microchip && <SB label="Microchip" value={microchip} />}
                {chiefComplaint && <SB label="Chief Complaint" value={chiefComplaint} />}
              </div>

              <div style={{ background: "var(--bg-alt)", borderRadius: 10, padding: 16 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 10 }}>
                  Services ({selectedServicesList.length})
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {selectedServicesList.map((s) => (
                    <span key={s.id} style={{ background: "#0d9488", color: "#fff", padding: "3px 10px", borderRadius: 20, fontSize: 12, fontWeight: 600 }}>
                      {s.label}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="modal-footer">
          <button className="btn btn-secondary btn-sm" onClick={step === 1 ? onClose : () => setStep((s) => (s - 1) as Step)}>
            {step === 1 ? "Cancel" : "← Back"}
          </button>
          {step < 4 ? (
            <button
              className="btn btn-primary btn-sm"
              onClick={() => setStep((s) => (s + 1) as Step)}
              disabled={(step === 2 && !canNext2) || (step === 3 && !canNext3)}
              style={{ background: "#0d9488", borderColor: "#0d9488" }}
            >
              Next →
            </button>
          ) : (
            <button
              className="btn btn-primary btn-sm"
              onClick={handleCheckIn}
              disabled={saving}
              style={{ background: "#0d9488", borderColor: "#0d9488", minWidth: 140 }}
            >
              {saving ? "Checking In…" : "✓ Confirm Check-In"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
