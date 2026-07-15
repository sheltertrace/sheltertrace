"use client";
import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { createClinicAnimal } from "@/lib/clinicData";
import { fetchShelterAnimals } from "@/lib/clinicShelterLink";
import type { ClinicAnimal, ClinicClient } from "@/lib/clinicTypes";
import type { ClinicShelterLink } from "@/lib/clinicShelterLink";
import type { Animal } from "@/lib/types";
import DateInput from "@/components/ui/DateInput";
import DragDropUpload from "@/components/ui/DragDropUpload";
import { today } from "@/lib/utils";

function F({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="form-group"><label className="form-label">{label}</label>{children}</div>;
}

const blank = (): Partial<ClinicAnimal> => ({
  status: "Active", species: "Dog", sex: "Unknown", intake_date: today(),
});

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSaved: (animal: ClinicAnimal) => void;
  prefillClientId?: string;
  clinicAccountId: string;
  clients: ClinicClient[];
  shelterLinks: ClinicShelterLink[];
}

export default function AddAnimalModal({
  isOpen, onClose, onSaved, prefillClientId, clinicAccountId, clients, shelterLinks,
}: Props) {
  const router = useRouter();
  const [mode, setMode] = useState<"new" | "search">("new");
  const [form, setForm] = useState<Partial<ClinicAnimal>>(blank());
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState("");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [mcasQuery, setMcasQuery] = useState("");
  const [mcasResults, setMcasResults] = useState<Animal[]>([]);
  const [mcasSearching, setMcasSearching] = useState(false);
  const [mcasSearched, setMcasSearched] = useState(false);

  const hasShelterLink = shelterLinks.length > 0;

  const handlePhoto = useCallback((files: File[]) => {
    const f = files[0];
    if (!f) return;
    setPhotoFile(f);
    const reader = new FileReader();
    reader.onload = (e) => setPhotoPreview(e.target?.result as string);
    reader.readAsDataURL(f);
  }, []);

  const handleMcasSearch = async () => {
    if (!mcasQuery.trim()) return;
    setMcasSearching(true);
    setMcasSearched(false);
    try {
      const results = await fetchShelterAnimals(mcasQuery);
      setMcasResults(results);
    } finally {
      setMcasSearching(false);
      setMcasSearched(true);
    }
  };

  const handleClose = () => {
    setForm(blank());
    setPhotoFile(null);
    setPhotoPreview("");
    setFormError("");
    setMode("new");
    setMcasQuery("");
    setMcasResults([]);
    setMcasSearched(false);
    onClose();
  };

  const handleSave = async () => {
    const clientId = prefillClientId || form.client_id;
    if (!form.name?.trim()) { setFormError("Animal name is required."); return; }
    if (!clientId) { setFormError("Please select a county client."); return; }
    setSaving(true);
    setFormError("");
    try {
      let photoUrl: string | undefined;
      if (photoFile) {
        const ext = photoFile.name.split(".").pop() || "jpg";
        const path = `clinic/${crypto.randomUUID()}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from("animal-photos")
          .upload(path, photoFile, { upsert: true });
        if (!upErr) {
          const { data: urlData } = supabase.storage.from("animal-photos").getPublicUrl(path);
          photoUrl = urlData.publicUrl;
        }
      }
      const animal = await createClinicAnimal({
        ...form,
        clinic_account_id: clinicAccountId,
        client_id: clientId,
        status: form.status || "Active",
        ...(photoUrl ? { photo_url: photoUrl } : {}),
      } as Omit<ClinicAnimal, "id" | "created_at" | "updated_at">);
      onSaved(animal);
      handleClose();
      router.push(`/clinic-portal/animals/${animal.id}`);
    } catch (e: unknown) {
      setFormError((e as { message?: string }).message || "Save failed. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={handleClose}>
      <div
        className="modal modal-lg"
        style={{ maxWidth: 660, maxHeight: "90vh", overflow: "auto" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <span className="modal-title">Add Animal</span>
          <button className="btn btn-ghost btn-sm" onClick={handleClose}>✕</button>
        </div>
        <div className="modal-body">
          {hasShelterLink && (
            <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
              <button
                className={`btn btn-sm ${mode === "new" ? "btn-primary" : "btn-secondary"}`}
                onClick={() => setMode("new")}
              >+ New Clinic Animal</button>
              <button
                className={`btn btn-sm ${mode === "search" ? "btn-primary" : "btn-secondary"}`}
                onClick={() => setMode("search")}
              >🔍 Search MCAS Animals</button>
            </div>
          )}

          {mode === "search" ? (
            <div>
              <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 10, padding: "8px 10px", background: "var(--bg-subtle)", borderRadius: 6 }}>
                Search the shelter system for an existing animal. Selecting one opens their full shelter record — no duplicate is created in the clinic system.
              </div>
              <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
                <input
                  className="form-input"
                  placeholder="Search by name, breed, ID, microchip…"
                  value={mcasQuery}
                  onChange={(e) => setMcasQuery(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleMcasSearch()}
                  style={{ flex: 1 }}
                />
                <button
                  className="btn btn-primary btn-sm"
                  onClick={handleMcasSearch}
                  disabled={mcasSearching || !mcasQuery.trim()}
                >
                  {mcasSearching ? "Searching…" : "Search"}
                </button>
              </div>
              {mcasResults.length > 0 && (
                <div className="card" style={{ padding: 0, overflow: "auto" }}>
                  <table className="data-table">
                    <thead>
                      <tr><th>Name</th><th>Species</th><th>Breed</th><th>ID</th><th>Status</th><th></th></tr>
                    </thead>
                    <tbody>
                      {mcasResults.map((a) => (
                        <tr key={a.id}>
                          <td style={{ fontWeight: 600 }}>{a.name || "—"}</td>
                          <td style={{ fontSize: 12 }}>{a.species || "—"}</td>
                          <td style={{ fontSize: 12 }}>{a.breed || "—"}</td>
                          <td style={{ fontFamily: "monospace", fontSize: 11 }}>{a.id}</td>
                          <td><span className="badge">{a.status || "—"}</span></td>
                          <td>
                            <button
                              className="btn btn-primary btn-sm"
                              onClick={() => { handleClose(); router.push(`/clinic-portal/animals/shelter_${a.id}`); }}
                            >
                              View →
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {mcasSearched && mcasResults.length === 0 && (
                <div style={{ color: "var(--text-muted)", fontSize: 13, padding: "16px 0", textAlign: "center" }}>
                  No animals found. Try a different name, ID, or microchip number.
                </div>
              )}
            </div>
          ) : (
            <div>
              {!prefillClientId && (
                <F label="County Client *">
                  <select
                    className="form-select"
                    value={form.client_id || ""}
                    onChange={(e) => setForm((f) => ({ ...f, client_id: e.target.value }))}
                  >
                    <option value="">— Select client —</option>
                    {clients.filter((c) => c.active).map((c) => (
                      <option key={c.id} value={c.id}>{c.county_name}</option>
                    ))}
                  </select>
                </F>
              )}
              <div className="grid-2">
                <F label="Animal Name *">
                  <input
                    className="form-input"
                    value={form.name || ""}
                    onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                    placeholder="e.g. Buddy"
                  />
                </F>
                <F label="Species">
                  <select className="form-select" value={form.species || "Dog"} onChange={(e) => setForm((f) => ({ ...f, species: e.target.value }))}>
                    <option>Dog</option>
                    <option>Cat</option>
                    <option>Other</option>
                  </select>
                </F>
                <F label="Breed">
                  <input className="form-input" value={form.breed || ""} onChange={(e) => setForm((f) => ({ ...f, breed: e.target.value }))} />
                </F>
                <F label="Color">
                  <input className="form-input" value={form.color || ""} onChange={(e) => setForm((f) => ({ ...f, color: e.target.value }))} />
                </F>
                <F label="Sex">
                  <select className="form-select" value={form.sex || "Unknown"} onChange={(e) => setForm((f) => ({ ...f, sex: e.target.value }))}>
                    <option value="M">Male</option>
                    <option value="F">Female</option>
                    <option value="Unknown">Unknown</option>
                  </select>
                </F>
                <F label="Age">
                  <input className="form-input" value={form.age || ""} onChange={(e) => setForm((f) => ({ ...f, age: e.target.value }))} placeholder="e.g. 2 years" />
                </F>
                <F label="Date of Birth">
                  <DateInput className="form-input" value={form.dob || ""} onChange={(e) => setForm((f) => ({ ...f, dob: e.target.value }))} />
                </F>
                <F label="Weight">
                  <input className="form-input" value={form.weight || ""} onChange={(e) => setForm((f) => ({ ...f, weight: e.target.value }))} placeholder="e.g. 28.5 lbs" />
                </F>
                <F label="Microchip #">
                  <input className="form-input" value={form.microchip || ""} onChange={(e) => setForm((f) => ({ ...f, microchip: e.target.value }))} />
                </F>
                <F label="Shelter ID">
                  <input
                    className="form-input"
                    value={form.shelter_id || ""}
                    onChange={(e) => setForm((f) => ({ ...f, shelter_id: e.target.value }))}
                    placeholder="Links to county shelter record"
                  />
                </F>
                <F label="Intake Date">
                  <DateInput className="form-input" value={form.intake_date || today()} onChange={(e) => setForm((f) => ({ ...f, intake_date: e.target.value }))} />
                </F>
                <F label="Status">
                  <select className="form-select" value={form.status || "Active"} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}>
                    <option>Active</option>
                    <option>Inactive</option>
                  </select>
                </F>
              </div>
              <F label="Photo">
                {photoPreview ? (
                  <div style={{ position: "relative", display: "inline-block" }}>
                    <img
                      src={photoPreview}
                      alt="Preview"
                      style={{ width: 120, height: 120, objectFit: "cover", borderRadius: 8, border: "2px solid var(--border)", display: "block" }}
                    />
                    <button
                      onClick={() => { setPhotoFile(null); setPhotoPreview(""); }}
                      style={{
                        position: "absolute", top: 3, right: 3,
                        background: "#dc2626", color: "#fff", border: "none",
                        borderRadius: "50%", width: 20, height: 20,
                        cursor: "pointer", fontSize: 11, lineHeight: "20px", textAlign: "center", padding: 0,
                      }}
                    >✕</button>
                  </div>
                ) : (
                  <DragDropUpload
                    onFiles={handlePhoto}
                    accept="image/jpeg,image/png,image/heic,image/heif,image/webp"
                    multiple={false}
                    compact
                    label="Drop photo or tap to select"
                  />
                )}
              </F>
              <F label="Notes">
                <textarea
                  className="form-textarea"
                  rows={2}
                  value={form.notes || ""}
                  onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                />
              </F>
              {formError && (
                <div style={{ color: "#dc2626", fontSize: 12, marginTop: 8, padding: "6px 10px", background: "#fee2e2", borderRadius: 5 }}>
                  {formError}
                </div>
              )}
            </div>
          )}
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={handleClose}>Cancel</button>
          {mode === "new" && (
            <button
              className="btn btn-primary"
              onClick={handleSave}
              disabled={saving || !form.name?.trim()}
            >
              {saving ? "Saving…" : "Add Animal"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
