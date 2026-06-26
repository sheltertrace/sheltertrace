"use client";
import { useState, useEffect, useMemo, useCallback } from "react";
import AppShell from "@/components/layout/AppShell";
import { supabase } from "@/lib/supabase";
import { fetchAnimals, createMedical } from "@/lib/data";
import type { Animal, MedicalRecord } from "@/lib/types";
import { getCurrentUserName, getCurrentUserId } from "@/lib/auth";
import DragDropUpload from "@/components/ui/DragDropUpload";

// ── IDEXX test name mapping ──────────────────────────────────────────────────

const TEST_MAP: Record<string, string> = {
  "hw antigen":    "Heartworm Test", "heartworm ag":    "Heartworm Test", "heartworm antigen": "Heartworm Test",
  "4dx":           "Heartworm Test", "snap 4dx":        "Heartworm Test", "snap 4dx plus":     "Heartworm Test",
  "fiv ab":        "FIV Test",       "fiv antibody":    "FIV Test",
  "felv ag":       "FeLV Test",      "felv antigen":    "FeLV Test",
  "fiv ab/felv ag":"FIV/FeLV Combo Test", "fiv/felv": "FIV/FeLV Combo Test", "snap fiv/felv": "FIV/FeLV Combo Test",
  "cpv ag":        "Parvo Test",     "parvo ag":        "Parvo Test",     "parvovirus":        "Parvo Test",
};

function mapTestName(raw: string): string {
  const key = raw.trim().toLowerCase();
  return TEST_MAP[key] || raw.trim();
}

function mapResult(raw: string): "Positive" | "Negative" | "Inconclusive" | "Pending" {
  const v = raw.trim().toLowerCase();
  if (v === "positive" || v === "pos" || v === "+") return "Positive";
  if (v === "negative" || v === "neg" || v === "-") return "Negative";
  if (v === "inconclusive" || v === "inc") return "Inconclusive";
  return "Pending";
}

// ── CSV parsing ──────────────────────────────────────────────────────────────

interface CsvRow {
  patientName: string;
  patientId: string;
  testName: string;
  result: string;
  resultDate: string;
  accessionNumber: string;
  analyzerId: string;
  operator: string;
  raw: Record<string, string>;
}

function parseCsv(text: string): CsvRow[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return [];
  const headerLine = lines[0];
  const headers = headerLine.split(",").map((h) => h.trim().replace(/^"|"$/g, "").toLowerCase());

  const col = (name: string): number => {
    const variants: Record<string, string[]> = {
      patientName: ["patient name", "animal name", "name", "patient"],
      patientId:   ["patient id", "animal id", "id"],
      testName:    ["test name", "test type", "test", "analyte"],
      result:      ["result", "result value", "interpretation"],
      resultDate:  ["result date", "date", "run date", "collection date"],
      accession:   ["accession number", "accession", "order id", "req id"],
      analyzer:    ["analyzer id", "analyzer", "instrument"],
      operator:    ["operator", "technician", "run by", "performed by"],
    };
    for (const v of variants[name] || [name]) {
      const i = headers.indexOf(v);
      if (i >= 0) return i;
    }
    return -1;
  };

  const iName = col("patientName"), iId = col("patientId"), iTest = col("testName");
  const iResult = col("result"), iDate = col("resultDate"), iAcc = col("accession");
  const iAna = col("analyzer"), iOp = col("operator");

  return lines.slice(1).map((line) => {
    const vals = line.split(",").map((v) => v.trim().replace(/^"|"$/g, ""));
    const rawObj: Record<string, string> = {};
    headers.forEach((h, i) => { rawObj[h] = vals[i] || ""; });
    return {
      patientName:     iName >= 0 ? vals[iName] || "" : "",
      patientId:       iId >= 0 ? vals[iId] || "" : "",
      testName:        iTest >= 0 ? vals[iTest] || "" : "",
      result:          iResult >= 0 ? vals[iResult] || "" : "",
      resultDate:      iDate >= 0 ? vals[iDate] || "" : "",
      accessionNumber: iAcc >= 0 ? vals[iAcc] || "" : "",
      analyzerId:      iAna >= 0 ? vals[iAna] || "" : "",
      operator:        iOp >= 0 ? vals[iOp] || "" : "",
      raw: rawObj,
    };
  }).filter((r) => r.testName || r.result);
}

// ── Import row state ─────────────────────────────────────────────────────────

interface ImportRow extends CsvRow {
  mappedType: string;
  mappedResult: "Positive" | "Negative" | "Inconclusive" | "Pending";
  matchedAnimal: Animal | null;
  matchScore: "exact" | "partial" | "none";
  manualAnimalId: string;
  skip: boolean;
  imported: boolean;
  error?: string;
}

const SAMPLE_CSV = `Patient Name,Patient ID,Test Name,Result,Result Date,Accession Number,Analyzer ID,Operator
Buddy,26-04-001,HW Antigen,Negative,06/24/2026,ACC-001,SNAP Pro,Tech Casey
Luna,26-04-003,FIV Ab/FeLV Ag,Negative,06/24/2026,ACC-002,SNAP Pro,Tech Casey
Max,,Parvo Ag,Positive,06/24/2026,ACC-003,SNAP Pro,Tech Morgan`;

export default function IdexxImportPage() {
  const [step, setStep] = useState<"upload" | "preview" | "done">("upload");
  const [rows, setRows] = useState<ImportRow[]>([]);
  const [animals, setAnimals] = useState<Animal[]>([]);
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const [fileName, setFileName] = useState("");
  const [importLog, setImportLog] = useState<Array<{ id: string; imported_by: string; imported_at: string; file_name: string; imported_rows: number; skipped_rows: number; error_rows: number }>>([]);
  const [positiveAlerts, setPositiveAlerts] = useState<ImportRow[]>([]);

  useEffect(() => {
    Promise.all([
      fetchAnimals(),
      supabase.from("idexx_import_log").select("*").order("imported_at", { ascending: false }).limit(20),
    ]).then(([a, log]) => {
      setAnimals(a);
      setImportLog((log.data || []) as typeof importLog);
    }).finally(() => setLoading(false));
  }, []);

  const matchAnimal = useCallback((name: string, id: string): { animal: Animal | null; score: "exact" | "partial" | "none" } => {
    if (!name && !id) return { animal: null, score: "none" };
    if (id) {
      const byId = animals.find((a) => a.id === id);
      if (byId) return { animal: byId, score: "exact" };
    }
    const lower = name.toLowerCase().trim();
    const exact = animals.find((a) => a.name.toLowerCase() === lower);
    if (exact) return { animal: exact, score: "exact" };
    const partial = animals.find((a) => a.name.toLowerCase().includes(lower) || lower.includes(a.name.toLowerCase()));
    if (partial) return { animal: partial, score: "partial" };
    return { animal: null, score: "none" };
  }, [animals]);

  const handleFile = (files: File[]) => {
    const file = files[0];
    if (!file) return;
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const parsed = parseCsv(text);
      const mapped: ImportRow[] = parsed.map((r) => {
        const { animal, score } = matchAnimal(r.patientName, r.patientId);
        return {
          ...r,
          mappedType: mapTestName(r.testName),
          mappedResult: mapResult(r.result),
          matchedAnimal: animal,
          matchScore: score,
          manualAnimalId: "",
          skip: false,
          imported: false,
        };
      });
      setRows(mapped);
      setStep("preview");
    };
    reader.readAsText(file);
  };

  const matchedCount = rows.filter((r) => !r.skip && (r.matchedAnimal || r.manualAnimalId)).length;
  const unmatchedCount = rows.filter((r) => !r.skip && !r.matchedAnimal && !r.manualAnimalId).length;
  const skippedCount = rows.filter((r) => r.skip).length;

  const handleImport = async () => {
    setImporting(true);
    const userName = getCurrentUserName();
    const userId = getCurrentUserId();
    let imported = 0, skipped = 0, errors = 0;
    const positives: ImportRow[] = [];

    for (const row of rows) {
      if (row.skip) { skipped++; continue; }
      const animalId = row.manualAnimalId || row.matchedAnimal?.id;
      const animalName = row.manualAnimalId ? animals.find((a) => a.id === row.manualAnimalId)?.name : row.matchedAnimal?.name;
      if (!animalId) { skipped++; continue; }

      try {
        let dateStr = row.resultDate;
        if (dateStr.includes("/")) {
          const [m, d, y] = dateStr.split("/");
          dateStr = `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
        }

        await createMedical({
          animal_id: animalId,
          animal_name: animalName || row.patientName,
          type: row.mappedType,
          description: row.testName,
          test_result: row.mappedResult,
          date: dateStr || new Date().toISOString().split("T")[0],
          vet: row.operator || "IDEXX Analyzer",
          status: "Administered",
          idexx_accession_number: row.accessionNumber || undefined,
          idexx_status: "Resulted",
          idexx_resulted_at: new Date().toISOString(),
        } as Partial<MedicalRecord>);
        row.imported = true;
        imported++;
        if (row.mappedResult === "Positive") positives.push(row);
      } catch (err: unknown) {
        row.error = (err as { message?: string }).message || "Failed";
        errors++;
      }
    }

    await supabase.from("idexx_import_log").insert({
      imported_by: userId || userName,
      file_name: fileName,
      total_rows: rows.length,
      matched_rows: matchedCount,
      imported_rows: imported,
      skipped_rows: skipped,
      error_rows: errors,
    });

    setPositiveAlerts(positives);
    setImporting(false);
    setStep("done");
  };

  const downloadSample = () => {
    const blob = new Blob([SAMPLE_CSV], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "idexx-sample-template.csv";
    a.click();
  };

  return (
    <AppShell title="IDEXX CSV Import">
      <div style={{ maxWidth: 960, margin: "0 auto" }}>

        {/* Positive alerts */}
        {positiveAlerts.length > 0 && (
          <div style={{ background: "#fee2e2", border: "2px solid #dc2626", borderRadius: 8, padding: "12px 16px", marginBottom: 20 }}>
            <div style={{ fontWeight: 800, fontSize: 14, color: "#dc2626", marginBottom: 8 }}>⚠️ POSITIVE RESULTS DETECTED — {positiveAlerts.length} animal{positiveAlerts.length > 1 ? "s" : ""}</div>
            {positiveAlerts.map((r, i) => (
              <div key={i} style={{ fontSize: 13, marginBottom: 4 }}>
                <a href={`/animals/${r.matchedAnimal?.id || r.manualAnimalId}`} style={{ fontWeight: 700, color: "#dc2626" }}>{r.matchedAnimal?.name || r.patientName}</a>
                {" — "}{r.mappedType}: <strong>POSITIVE</strong>
              </div>
            ))}
          </div>
        )}

        {step === "upload" && (
          <div>
            <div className="card" style={{ padding: 24, marginBottom: 20 }}>
              <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 12 }}>📥 Import IDEXX VetConnect PLUS Results</div>
              <div style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 16, lineHeight: 1.6 }}>
                Upload a CSV file exported from IDEXX VetConnect PLUS. Results will be automatically matched to animals in ShelterTrace and added to their medical records.
              </div>
              <div style={{ background: "#f0f9ff", border: "1px solid #bae6fd", borderRadius: 8, padding: 14, marginBottom: 16, fontSize: 12, lineHeight: 1.8 }}>
                <strong>How to export from VetConnect PLUS:</strong><br />
                1. Log into vetconnect.idexx.com<br />
                2. Go to Results → Export<br />
                3. Select your date range<br />
                4. Click Export as CSV<br />
                5. Upload the downloaded file here
              </div>
              <DragDropUpload
                onFiles={handleFile}
                accept=".csv,text/csv"
                label="Drop IDEXX CSV file here or click to browse"
              />
              <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
                <button className="btn btn-secondary btn-sm" onClick={downloadSample}>📄 Download Sample Template</button>
              </div>
            </div>

            {/* Import history */}
            <div className="card" style={{ padding: 0, overflow: "hidden" }}>
              <div style={{ padding: "10px 16px", background: "#f8fafc", borderBottom: "1px solid var(--border)", fontWeight: 700, fontSize: 13 }}>📋 Import History</div>
              {importLog.length === 0 ? (
                <div style={{ padding: 16, color: "var(--text-muted)", fontSize: 13 }}>No imports yet.</div>
              ) : (
                <table className="data-table">
                  <thead><tr><th>Date</th><th>File</th><th>Imported</th><th>Skipped</th><th>Errors</th></tr></thead>
                  <tbody>
                    {importLog.map((l) => (
                      <tr key={l.id}>
                        <td style={{ fontSize: 12 }}>{new Date(l.imported_at).toLocaleString()}</td>
                        <td style={{ fontSize: 12 }}>{l.file_name || "—"}</td>
                        <td style={{ fontSize: 12, fontWeight: 700, color: "#15803d" }}>{l.imported_rows}</td>
                        <td style={{ fontSize: 12 }}>{l.skipped_rows}</td>
                        <td style={{ fontSize: 12, color: l.error_rows ? "#dc2626" : "var(--text-muted)" }}>{l.error_rows}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}

        {step === "preview" && (
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 16 }}>Preview — {fileName}</div>
                <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>
                  {matchedCount} matched · {unmatchedCount} unmatched · {skippedCount} skipped · {rows.length} total
                </div>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button className="btn btn-secondary" onClick={() => { setStep("upload"); setRows([]); }}>← Back</button>
                <button className="btn btn-primary" onClick={handleImport} disabled={importing || matchedCount === 0}>
                  {importing ? "Importing…" : `📥 Import ${matchedCount} Result${matchedCount !== 1 ? "s" : ""}`}
                </button>
              </div>
            </div>

            <div className="card" style={{ padding: 0, overflow: "auto" }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th style={{ width: 30 }}></th>
                    <th>Animal</th>
                    <th>Test</th>
                    <th>Result</th>
                    <th>Date</th>
                    <th>Match</th>
                    <th>Assign To</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => {
                    const resultColor = r.mappedResult === "Positive" ? "#dc2626" : r.mappedResult === "Negative" ? "#15803d" : r.mappedResult === "Inconclusive" ? "#b45309" : "#64748b";
                    return (
                      <tr key={i} style={{ opacity: r.skip ? 0.4 : 1 }}>
                        <td><input type="checkbox" checked={!r.skip} onChange={() => setRows((prev) => prev.map((x, j) => j === i ? { ...x, skip: !x.skip } : x))} /></td>
                        <td style={{ fontWeight: 600 }}>{r.patientName || "—"}{r.patientId ? ` (${r.patientId})` : ""}</td>
                        <td style={{ fontSize: 12 }}>
                          <div>{r.mappedType}</div>
                          {r.mappedType !== r.testName && <div style={{ fontSize: 10, color: "var(--text-muted)" }}>CSV: {r.testName}</div>}
                        </td>
                        <td style={{ fontWeight: 800, color: resultColor }}>{r.mappedResult}</td>
                        <td style={{ fontSize: 12 }}>{r.resultDate || "—"}</td>
                        <td>
                          {r.matchScore === "exact" && <span className="badge" style={{ background: "#dcfce7", color: "#15803d", fontSize: 10 }}>✓ Matched</span>}
                          {r.matchScore === "partial" && <span className="badge" style={{ background: "#fef3c7", color: "#b45309", fontSize: 10 }}>~ Partial</span>}
                          {r.matchScore === "none" && !r.manualAnimalId && <span className="badge" style={{ background: "#fee2e2", color: "#dc2626", fontSize: 10 }}>✗ No Match</span>}
                          {r.matchedAnimal && <div style={{ fontSize: 11, color: "var(--text-secondary)" }}>{r.matchedAnimal.name} ({r.matchedAnimal.id})</div>}
                        </td>
                        <td>
                          {!r.matchedAnimal && (
                            <select className="form-select" style={{ fontSize: 11, padding: "2px 6px", maxWidth: 160 }} value={r.manualAnimalId} onChange={(e) => setRows((prev) => prev.map((x, j) => j === i ? { ...x, manualAnimalId: e.target.value } : x))}>
                              <option value="">— Select —</option>
                              {animals.map((a) => <option key={a.id} value={a.id}>{a.name} ({a.id})</option>)}
                            </select>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {step === "done" && (
          <div className="card" style={{ padding: 30, textAlign: "center" }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>✅</div>
            <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 8 }}>Import Complete</div>
            <div style={{ fontSize: 14, color: "var(--text-secondary)", marginBottom: 20 }}>
              {rows.filter((r) => r.imported).length} results imported · {rows.filter((r) => r.skip || (!r.matchedAnimal && !r.manualAnimalId)).length} skipped · {rows.filter((r) => r.error).length} errors
            </div>
            {rows.filter((r) => r.error).length > 0 && (
              <div style={{ textAlign: "left", marginBottom: 16 }}>
                <div style={{ fontWeight: 700, color: "#dc2626", marginBottom: 6 }}>Errors:</div>
                {rows.filter((r) => r.error).map((r, i) => (
                  <div key={i} style={{ fontSize: 12, color: "#dc2626", marginBottom: 2 }}>• {r.patientName} — {r.mappedType}: {r.error}</div>
                ))}
              </div>
            )}
            <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
              <button className="btn btn-primary" onClick={() => { setStep("upload"); setRows([]); setPositiveAlerts([]); }}>Import Another File</button>
              <a href="/admin" className="btn btn-secondary" style={{ textDecoration: "none" }}>Back to Admin</a>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
