"use client";
import { useState, useEffect, useRef } from "react";
import { createForm, fetchPeople, fetchAnimals, fetchShelterSettings } from "@/lib/data";
import { today } from "@/lib/utils";
import { useAuth } from "@/app/providers";
import type { ShelterForm, Person, Animal, ShelterSettings, FormPreFill } from "@/lib/types";
import LinkToSection, { type LinkIds } from "@/components/forms/LinkToSection";
import DateInput from "@/components/ui/DateInput";

export interface InventoryRow {
  rowId: string;
  animal_id: string;
  animal_name: string;
  species: string;
  breed: string;
  color: string;
  sex: string;
  date_in: string;
  date_out: string;
  notes: string;
}

function blankRow(): InventoryRow {
  return {
    rowId: Math.random().toString(36).slice(2),
    animal_id: "",
    animal_name: "",
    species: "",
    breed: "",
    color: "",
    sex: "",
    date_in: today(),
    date_out: "",
    notes: "",
  };
}

interface Props {
  onSave: (form: ShelterForm) => void;
  onClose: () => void;
  prefill?: FormPreFill;
}

export function printInventory(d: Record<string, unknown>, rows: InventoryRow[]) {
  const w = window.open("", "_blank", "width=860,height=1060");
  if (!w) return;
  const printLine = (label: string, val: string, minW = 180) =>
    `<div style="display:inline-flex;flex-direction:column;gap:2px;margin-right:20px;margin-bottom:10px">
      <div style="border-bottom:1px solid #000;min-width:${minW}px;padding-bottom:2px;font-size:10.5px">${val || "&nbsp;"}</div>
      <div style="font-size:9px;color:#666">${label}</div>
    </div>`;
  const filled = rows.filter((r) => r.animal_name || r.animal_id);
  w.document.write(`<html><head><title>GDA Foster Home Animal Inventory</title>
  <style>body{font-family:Arial,sans-serif;font-size:10px;padding:22px;margin:0;line-height:1.45}
  h2{font-size:13px;text-transform:uppercase;font-weight:900;margin:0 0 2px}
  .sub{font-size:10px;color:#444;margin-bottom:10px}
  table{width:100%;border-collapse:collapse;margin-top:8px}
  th{background:#f0f0f0;font-size:9.5px;font-weight:700;text-align:left;padding:4px 6px;border:1px solid #ccc}
  td{font-size:9.5px;padding:4px 6px;border:1px solid #ccc;vertical-align:top}
  tr:nth-child(even) td{background:#fafafa}
  @media print{body{padding:14px}}</style></head><body>
  <h2>Foster Home Animal Inventory</h2>
  <div class="sub">Georgia Department of Agriculture — Licensed Animal Shelter Animal Inventory Record</div>
  <div style="margin-bottom:10px">
    ${printLine("GDA Licensed Animal Shelter", d.shelter_name as string, 220)}
    ${printLine("GDA License #", d.license_number as string, 120)}
    ${printLine("Report Date", d.report_date as string, 110)}
  </div>
  <div style="margin-bottom:12px">
    ${printLine("Foster Home / Agent Name", d.foster_name as string, 220)}
    ${printLine("Foster Address", d.foster_address as string, 220)}
  </div>
  <table>
    <thead>
      <tr>
        <th>#</th>
        <th>Animal ID</th>
        <th>Name</th>
        <th>Species</th>
        <th>Breed</th>
        <th>Color</th>
        <th>Sex</th>
        <th>Date In</th>
        <th>Date Out</th>
        <th>Notes</th>
      </tr>
    </thead>
    <tbody>
      ${filled.length === 0
        ? `<tr><td colspan="10" style="text-align:center;color:#999;font-style:italic">No animals recorded</td></tr>`
        : filled.map((r, i) => `<tr>
          <td>${i + 1}</td>
          <td>${r.animal_id || ""}</td>
          <td>${r.animal_name || ""}</td>
          <td>${r.species || ""}</td>
          <td>${r.breed || ""}</td>
          <td>${r.color || ""}</td>
          <td>${r.sex || ""}</td>
          <td>${r.date_in || ""}</td>
          <td>${r.date_out || ""}</td>
          <td>${r.notes || ""}</td>
        </tr>`).join("")}
    </tbody>
  </table>
  <div style="margin-top:24px;font-size:9px;color:#555">
    Total animals: ${filled.length} &nbsp;&nbsp; Printed: ${new Date().toLocaleDateString()}
  </div>
  </body></html>`);
  w.document.close();
  w.focus();
  setTimeout(() => w.print(), 400);
}

export default function GdaAnimalInventoryForm({ onSave, onClose, prefill }: Props) {
  const { user } = useAuth();
  const [shelterSettings, setShelterSettings] = useState<ShelterSettings | null>(null);
  const [people, setPeople] = useState<Person[]>([]);
  const [allAnimals, setAllAnimals] = useState<Animal[]>([]);
  const [saving, setSaving] = useState(false);

  // Foster parent search
  const [fosterQuery, setFosterQuery] = useState("");
  const [fosterResults, setFosterResults] = useState<Person[]>([]);
  const [fosterPerson, setFosterPerson] = useState<Person | null>(null);

  // Form fields
  const [shelterName, setShelterName] = useState("");
  const [licenseNumber, setLicenseNumber] = useState("");
  const [reportDate, setReportDate] = useState(today());
  const [fosterAddress, setFosterAddress] = useState("");

  // Animal rows
  const [rows, setRows] = useState<InventoryRow[]>([blankRow()]);
  const [linkIds, setLinkIds] = useState<LinkIds>({ call_id: prefill?.call_id });

  // Per-row animal search state
  const [rowSearchQuery, setRowSearchQuery] = useState<Record<string, string>>({});
  const [rowSearchResults, setRowSearchResults] = useState<Record<string, Animal[]>>({});
  const [rowSearchOpen, setRowSearchOpen] = useState<Record<string, boolean>>({});

  useEffect(() => {
    fetchShelterSettings().then((s) => {
      setShelterSettings(s);
      setShelterName(s.shelter_name || "");
      setLicenseNumber(s.gda_license_number || "");
    });
    fetchAnimals().then(setAllAnimals);
    fetchPeople().then((ps) => {
      setPeople(ps);
      if (prefill?.person_id) {
        const p = ps.find((x) => x.id === prefill.person_id);
        if (p) {
          setFosterPerson(p);
          setFosterQuery(`${p.first_name} ${p.last_name}`);
          setFosterAddress([p.address, p.city, p.state, p.zip].filter(Boolean).join(", "));
        }
      } else if (prefill?.person_first) {
        setFosterQuery([prefill.person_first, prefill.person_last].filter(Boolean).join(" "));
        setFosterAddress([prefill.person_address, prefill.person_city].filter(Boolean).join(", "));
      }
    });
  }, [prefill?.person_id, prefill?.person_first]);

  // Foster search
  useEffect(() => {
    if (!fosterQuery.trim()) { setFosterResults([]); return; }
    const q = fosterQuery.toLowerCase();
    setFosterResults(
      people.filter((p) =>
        `${p.first_name} ${p.last_name}`.toLowerCase().includes(q) ||
        (p.phone || "").includes(q)
      ).slice(0, 8)
    );
  }, [fosterQuery, people]);

  const selectFoster = (p: Person) => {
    setFosterPerson(p);
    setFosterQuery(`${p.first_name} ${p.last_name}`);
    setFosterResults([]);
    setFosterAddress([p.address, p.city, p.state, p.zip].filter(Boolean).join(", "));
  };

  // Animal search per row
  const handleRowAnimalQuery = (rowId: string, q: string) => {
    setRowSearchQuery((prev) => ({ ...prev, [rowId]: q }));
    if (!q.trim()) {
      setRowSearchResults((prev) => ({ ...prev, [rowId]: [] }));
      return;
    }
    const lower = q.toLowerCase();
    const results = allAnimals.filter((a) =>
      a.name.toLowerCase().includes(lower) ||
      a.id.toLowerCase().includes(lower) ||
      (a.microchip || "").toLowerCase().includes(lower)
    ).slice(0, 8);
    setRowSearchResults((prev) => ({ ...prev, [rowId]: results }));
    setRowSearchOpen((prev) => ({ ...prev, [rowId]: true }));
  };

  const selectRowAnimal = (rowId: string, animal: Animal) => {
    setRows((prev) => prev.map((r) =>
      r.rowId === rowId
        ? { ...r, animal_id: animal.id, animal_name: animal.name, species: animal.species, breed: animal.breed, color: animal.color, sex: animal.sex }
        : r
    ));
    setRowSearchQuery((prev) => ({ ...prev, [rowId]: animal.name }));
    setRowSearchResults((prev) => ({ ...prev, [rowId]: [] }));
    setRowSearchOpen((prev) => ({ ...prev, [rowId]: false }));
  };

  const updateRow = (rowId: string, field: keyof InventoryRow, value: string) => {
    setRows((prev) => prev.map((r) => r.rowId === rowId ? { ...r, [field]: value } : r));
  };

  const addRow = () => setRows((prev) => [...prev, blankRow()]);
  const removeRow = (rowId: string) => {
    if (rows.length === 1) return;
    setRows((prev) => prev.filter((r) => r.rowId !== rowId));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const formData = {
        shelter_name: shelterName,
        license_number: licenseNumber,
        report_date: reportDate,
        foster_name: fosterPerson ? `${fosterPerson.first_name} ${fosterPerson.last_name}` : fosterQuery,
        foster_address: fosterAddress,
        rows: rows.filter((r) => r.animal_name || r.animal_id),
      };
      const saved = await createForm({
        form_type: "gda_animal_inventory",
        form_data: formData,
        linked_call_id: linkIds.call_id,
        linked_person_id: fosterPerson?.id || prefill?.person_id,
        created_by: user?.username || "",
      });
      onSave(saved);
    } catch (e) {
      console.error("GdaAnimalInventoryForm save error:", e);
    } finally {
      setSaving(false);
    }
  };

  const fieldStyle: React.CSSProperties = { padding: "5px 8px", border: "1px solid var(--border)", borderRadius: 4, fontSize: 13, background: "var(--surface)", color: "var(--text-primary)", width: "100%" };
  const labelStyle: React.CSSProperties = { fontSize: 11, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 3, display: "block" };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 1000, display: "flex", alignItems: "flex-start", justifyContent: "center", overflowY: "auto", padding: "24px 16px" }}>
      <div style={{ background: "var(--surface)", borderRadius: 10, width: "100%", maxWidth: 860, padding: 28, position: "relative" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
          <div>
            <div style={{ fontWeight: 900, fontSize: 17 }}>GDA Foster Home Animal Inventory</div>
            <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 2 }}>Georgia Department of Agriculture — Animal Inventory Record</div>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 22, cursor: "pointer", color: "var(--text-secondary)" }}>✕</button>
        </div>

        {/* Shelter info */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 16 }}>
          <div>
            <label style={labelStyle}>GDA Licensed Animal Shelter</label>
            <input style={fieldStyle} value={shelterName} onChange={(e) => setShelterName(e.target.value)} />
          </div>
          <div>
            <label style={labelStyle}>GDA License #</label>
            <input style={fieldStyle} value={licenseNumber} onChange={(e) => setLicenseNumber(e.target.value)} />
          </div>
          <div>
            <label style={labelStyle}>Report Date</label>
            <DateInput style={fieldStyle} value={reportDate} onChange={(e) => setReportDate(e.target.value)} />
          </div>
        </div>

        {/* Foster parent */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 20 }}>
          <div style={{ position: "relative" }}>
            <label style={labelStyle}>Foster Home / Agent Name</label>
            <input
              style={fieldStyle}
              placeholder="Search by name or phone…"
              value={fosterQuery}
              onChange={(e) => { setFosterQuery(e.target.value); setFosterPerson(null); }}
            />
            {fosterResults.length > 0 && (
              <div style={{ position: "absolute", top: "100%", left: 0, right: 0, background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 6, zIndex: 50, boxShadow: "0 4px 12px rgba(0,0,0,0.15)", maxHeight: 220, overflowY: "auto" }}>
                {fosterResults.map((p) => (
                  <div key={p.id} onClick={() => selectFoster(p)} style={{ padding: "8px 12px", cursor: "pointer", fontSize: 13, borderBottom: "1px solid var(--border)" }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = "var(--surface-alt)")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "var(--surface)")}>
                    <strong>{p.first_name} {p.last_name}</strong> <span style={{ color: "var(--text-secondary)", fontSize: 11 }}>{p.phone}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div>
            <label style={labelStyle}>Foster Home Address</label>
            <input style={fieldStyle} value={fosterAddress} onChange={(e) => setFosterAddress(e.target.value)} placeholder="Auto-fills from contact record" />
          </div>
        </div>

        {/* Animal rows */}
        <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 8 }}>Animal Inventory</div>
        <div style={{ overflowX: "auto", marginBottom: 12 }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
            <thead>
              <tr style={{ background: "var(--surface-alt)" }}>
                <th style={{ padding: "6px 8px", textAlign: "left", border: "1px solid var(--border)", fontSize: 11, fontWeight: 700, width: 28 }}>#</th>
                <th style={{ padding: "6px 8px", textAlign: "left", border: "1px solid var(--border)", fontSize: 11, fontWeight: 700, minWidth: 160 }}>Animal (search or type)</th>
                <th style={{ padding: "6px 8px", textAlign: "left", border: "1px solid var(--border)", fontSize: 11, fontWeight: 700 }}>Species</th>
                <th style={{ padding: "6px 8px", textAlign: "left", border: "1px solid var(--border)", fontSize: 11, fontWeight: 700 }}>Breed</th>
                <th style={{ padding: "6px 8px", textAlign: "left", border: "1px solid var(--border)", fontSize: 11, fontWeight: 700 }}>Color</th>
                <th style={{ padding: "6px 8px", textAlign: "left", border: "1px solid var(--border)", fontSize: 11, fontWeight: 700, width: 50 }}>Sex</th>
                <th style={{ padding: "6px 8px", textAlign: "left", border: "1px solid var(--border)", fontSize: 11, fontWeight: 700, width: 110 }}>Date In</th>
                <th style={{ padding: "6px 8px", textAlign: "left", border: "1px solid var(--border)", fontSize: 11, fontWeight: 700, width: 110 }}>Date Out</th>
                <th style={{ padding: "6px 8px", textAlign: "left", border: "1px solid var(--border)", fontSize: 11, fontWeight: 700 }}>Notes</th>
                <th style={{ width: 28, border: "1px solid var(--border)" }}></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, idx) => (
                <tr key={row.rowId}>
                  <td style={{ border: "1px solid var(--border)", padding: "4px 8px", textAlign: "center", color: "var(--text-secondary)", fontSize: 11 }}>{idx + 1}</td>
                  {/* Animal search cell */}
                  <td style={{ border: "1px solid var(--border)", padding: 4, position: "relative" }}>
                    <input
                      style={{ ...fieldStyle, fontSize: 12 }}
                      placeholder="Name or ID…"
                      value={rowSearchQuery[row.rowId] ?? row.animal_name}
                      onChange={(e) => handleRowAnimalQuery(row.rowId, e.target.value)}
                      onFocus={() => setRowSearchOpen((prev) => ({ ...prev, [row.rowId]: true }))}
                      onBlur={() => setTimeout(() => setRowSearchOpen((prev) => ({ ...prev, [row.rowId]: false })), 200)}
                    />
                    {rowSearchOpen[row.rowId] && (rowSearchResults[row.rowId] || []).length > 0 && (
                      <div style={{ position: "absolute", top: "100%", left: 0, right: 0, background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 4, zIndex: 60, boxShadow: "0 4px 12px rgba(0,0,0,0.15)", maxHeight: 180, overflowY: "auto" }}>
                        {(rowSearchResults[row.rowId] || []).map((a) => (
                          <div key={a.id} onMouseDown={() => selectRowAnimal(row.rowId, a)}
                            style={{ padding: "6px 10px", cursor: "pointer", fontSize: 12, borderBottom: "1px solid var(--border)" }}
                            onMouseEnter={(e) => (e.currentTarget.style.background = "var(--surface-alt)")}
                            onMouseLeave={(e) => (e.currentTarget.style.background = "var(--surface)")}>
                            <strong>{a.name}</strong> <span style={{ color: "var(--text-secondary)", fontSize: 11 }}>{a.species} · {a.id.slice(0, 8)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </td>
                  <td style={{ border: "1px solid var(--border)", padding: 4 }}>
                    <input style={{ ...fieldStyle, fontSize: 12 }} value={row.species} onChange={(e) => updateRow(row.rowId, "species", e.target.value)} />
                  </td>
                  <td style={{ border: "1px solid var(--border)", padding: 4 }}>
                    <input style={{ ...fieldStyle, fontSize: 12 }} value={row.breed} onChange={(e) => updateRow(row.rowId, "breed", e.target.value)} />
                  </td>
                  <td style={{ border: "1px solid var(--border)", padding: 4 }}>
                    <input style={{ ...fieldStyle, fontSize: 12 }} value={row.color} onChange={(e) => updateRow(row.rowId, "color", e.target.value)} />
                  </td>
                  <td style={{ border: "1px solid var(--border)", padding: 4 }}>
                    <select style={{ ...fieldStyle, fontSize: 12, padding: "5px 4px" }} value={row.sex} onChange={(e) => updateRow(row.rowId, "sex", e.target.value)}>
                      <option value=""></option>
                      <option value="Male">M</option>
                      <option value="Female">F</option>
                    </select>
                  </td>
                  <td style={{ border: "1px solid var(--border)", padding: 4 }}>
                    <DateInput style={{ ...fieldStyle, fontSize: 12 }} value={row.date_in} onChange={(e) => updateRow(row.rowId, "date_in", e.target.value)} />
                  </td>
                  <td style={{ border: "1px solid var(--border)", padding: 4 }}>
                    <DateInput style={{ ...fieldStyle, fontSize: 12 }} value={row.date_out} onChange={(e) => updateRow(row.rowId, "date_out", e.target.value)} />
                  </td>
                  <td style={{ border: "1px solid var(--border)", padding: 4 }}>
                    <input style={{ ...fieldStyle, fontSize: 12 }} value={row.notes} onChange={(e) => updateRow(row.rowId, "notes", e.target.value)} />
                  </td>
                  <td style={{ border: "1px solid var(--border)", padding: 4, textAlign: "center" }}>
                    <button onClick={() => removeRow(row.rowId)} style={{ background: "none", border: "none", cursor: "pointer", color: "#dc2626", fontSize: 16, padding: 0 }} title="Remove row">×</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <button className="btn btn-secondary btn-sm" onClick={addRow} style={{ marginBottom: 24 }}>+ Add Row</button>

        <LinkToSection value={linkIds} onChange={setLinkIds} exclude={["animal", "person"]} />

        {/* Actions */}
        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", borderTop: "1px solid var(--border)", paddingTop: 16 }}>
          <button className="btn btn-secondary" onClick={() => {
            const formData = {
              shelter_name: shelterName, license_number: licenseNumber, report_date: reportDate,
              foster_name: fosterPerson ? `${fosterPerson.first_name} ${fosterPerson.last_name}` : fosterQuery,
              foster_address: fosterAddress,
            };
            printInventory(formData, rows);
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
