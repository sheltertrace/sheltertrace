"use client";
import { useState, useEffect, useCallback } from "react";
import AppShell from "@/components/layout/AppShell";
import { supabase } from "@/lib/supabase";
import { fetchAnimals, createMedical } from "@/lib/data";
import type { Animal, MedicalRecord } from "@/lib/types";
import { getCurrentUserName, getCurrentUserId } from "@/lib/auth";
import DragDropUpload from "@/components/ui/DragDropUpload";

// ── CSV test name mapping (kept for CSV fallback) ────────────────────────────

const CSV_TEST_MAP: Record<string, string> = {
  "hw antigen": "Heartworm Test", "heartworm ag": "Heartworm Test", "heartworm antigen": "Heartworm Test",
  "4dx": "Heartworm Test", "snap 4dx": "Heartworm Test", "snap 4dx plus": "Heartworm Test",
  "fiv ab": "FIV Test", "fiv antibody": "FIV Test",
  "felv ag": "FeLV Test", "felv antigen": "FeLV Test",
  "fiv ab/felv ag": "FIV/FeLV Combo Test", "fiv/felv": "FIV/FeLV Combo Test",
  "cpv ag": "Parvo Test", "parvo ag": "Parvo Test", "parvovirus": "Parvo Test",
};

function csvMapTest(raw: string): string { return CSV_TEST_MAP[raw.trim().toLowerCase()] || raw.trim(); }
function csvMapResult(raw: string): "Positive" | "Negative" | "Inconclusive" | "Pending" {
  const v = raw.trim().toLowerCase();
  if (v === "positive" || v === "pos" || v === "+") return "Positive";
  if (v === "negative" || v === "neg" || v === "-") return "Negative";
  if (v === "inconclusive" || v === "inc") return "Inconclusive";
  return "Pending";
}

// ── Import row ───────────────────────────────────────────────────────────────

interface ImportRow {
  animalName: string;
  testName: string;
  mappedType: string;
  rawResult: string;
  mappedResult: "Positive" | "Negative" | "Inconclusive" | "Pending";
  resultDate: string;
  source: string;
  species?: string;
  matchedAnimal: Animal | null;
  matchScore: "exact" | "partial" | "none";
  manualAnimalId: string;
  skip: boolean;
  imported: boolean;
  error?: string;
}

// ── CSV parsing ──────────────────────────────────────────────────────────────

function parseCsv(text: string): ImportRow[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return [];
  const headers = lines[0].split(",").map((h) => h.trim().replace(/^"|"$/g, "").toLowerCase());
  const col = (names: string[]): number => { for (const n of names) { const i = headers.indexOf(n); if (i >= 0) return i; } return -1; };
  const iName = col(["patient name", "animal name", "name"]);
  const iTest = col(["test name", "test type", "test", "analyte"]);
  const iResult = col(["result", "result value", "interpretation"]);
  const iDate = col(["result date", "date", "run date"]);

  return lines.slice(1).map((line) => {
    const vals = line.split(",").map((v) => v.trim().replace(/^"|"$/g, ""));
    const testRaw = iTest >= 0 ? vals[iTest] || "" : "";
    const resultRaw = iResult >= 0 ? vals[iResult] || "" : "";
    return {
      animalName: iName >= 0 ? vals[iName] || "" : "",
      testName: testRaw,
      mappedType: csvMapTest(testRaw),
      rawResult: resultRaw,
      mappedResult: csvMapResult(resultRaw),
      resultDate: iDate >= 0 ? vals[iDate] || "" : "",
      source: "IDEXX CSV Import",
      matchedAnimal: null, matchScore: "none" as const, manualAnimalId: "", skip: false, imported: false,
    };
  }).filter((r) => r.testName || r.rawResult);
}

// ── Main page ────────────────────────────────────────────────────────────────

export default function IdexxImportPage() {
  const [step, setStep] = useState<"upload" | "preview" | "done">("upload");
  const [rows, setRows] = useState<ImportRow[]>([]);
  const [animals, setAnimals] = useState<Animal[]>([]);
  const [loading, setLoading] = useState(true);
  const [parsing, setParsing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [fileName, setFileName] = useState("");
  const [parseError, setParseError] = useState("");
  const [importLog, setImportLog] = useState<Array<{ id: string; imported_by: string; imported_at: string; file_name: string; imported_rows: number; skipped_rows: number; error_rows: number }>>([]);
  const [positiveAlerts, setPositiveAlerts] = useState<ImportRow[]>([]);

  useEffect(() => {
    Promise.all([
      fetchAnimals(),
      supabase.from("idexx_import_log").select("*").order("imported_at", { ascending: false }).limit(20),
    ]).then(([a, log]) => { setAnimals(a); setImportLog((log.data || []) as typeof importLog); }).finally(() => setLoading(false));
  }, []);

  const matchAnimal = useCallback((name: string): { animal: Animal | null; score: "exact" | "partial" | "none" } => {
    if (!name) return { animal: null, score: "none" };
    const lower = name.toLowerCase().trim();
    const exact = animals.find((a) => a.name.toLowerCase() === lower);
    if (exact) return { animal: exact, score: "exact" };
    const partial = animals.find((a) => a.name.toLowerCase().includes(lower) || lower.includes(a.name.toLowerCase()));
    if (partial) return { animal: partial, score: "partial" };
    return { animal: null, score: "none" };
  }, [animals]);

  const applyMatching = useCallback((parsed: ImportRow[]): ImportRow[] => {
    return parsed.map((r) => {
      const { animal, score } = matchAnimal(r.animalName);
      return { ...r, matchedAnimal: animal, matchScore: score };
    });
  }, [matchAnimal]);

  const handleFile = async (files: File[]) => {
    const file = files[0];
    if (!file) return;
    setFileName(file.name);
    setParseError("");
    const isPdf = file.name.toLowerCase().endsWith(".pdf");

    if (isPdf) {
      setParsing(true);
      try {
        const form = new FormData();
        form.append("file", file);
        const res = await fetch("/api/idexx/parse-pdf", { method: "POST", body: form });
        const data = await res.json() as { results?: Array<{ animal_name: string; test_name: string; mapped_type: string; raw_result: string; mapped_result: string; result_date: string; source: string; species?: string }>; error?: string };
        if (!res.ok || data.error) throw new Error(data.error || "Parse failed");
        if (!data.results?.length) throw new Error("No test results found in this PDF. Make sure it is an IDEXX VetConnect PLUS results report.");
        const mapped: ImportRow[] = data.results.map((r) => ({
          animalName: r.animal_name,
          testName: r.test_name,
          mappedType: r.mapped_type,
          rawResult: r.raw_result,
          mappedResult: r.mapped_result as ImportRow["mappedResult"],
          resultDate: r.result_date,
          source: "IDEXX PDF Import",
          species: r.species,
          matchedAnimal: null, matchScore: "none" as const, manualAnimalId: "", skip: false, imported: false,
        }));
        setRows(applyMatching(mapped));
        setStep("preview");
      } catch (err: unknown) {
        setParseError((err as Error).message || "Failed to parse PDF");
      } finally { setParsing(false); }
    } else {
      const reader = new FileReader();
      reader.onload = (e) => {
        const parsed = parseCsv(e.target?.result as string);
        if (parsed.length === 0) { setParseError("No results found in CSV."); return; }
        setRows(applyMatching(parsed));
        setStep("preview");
      };
      reader.readAsText(file);
    }
  };

  const matchedCount = rows.filter((r) => !r.skip && (r.matchedAnimal || r.manualAnimalId)).length;
  const skippedCount = rows.filter((r) => r.skip).length;

  const handleImport = async () => {
    setImporting(true);
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
        if (dateStr.includes("/") && !dateStr.startsWith("20")) {
          const [m, d, y] = dateStr.split("/");
          const yr = y.length === 2 ? `20${y}` : y;
          dateStr = `${yr}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
        }

        const desc = row.rawResult && row.rawResult !== row.mappedResult
          ? `${row.testName} (IDEXX result: ${row.rawResult})`
          : row.testName;

        await createMedical({
          animal_id: animalId,
          animal_name: animalName || row.animalName,
          type: row.mappedType,
          description: desc,
          test_result: row.mappedResult,
          date: dateStr || new Date().toISOString().split("T")[0],
          vet: row.source.includes("SNAP") ? "IDEXX SNAP Pro" : "IDEXX Analyzer",
          status: "Administered",
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
      imported_by: userId || getCurrentUserName(),
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

  return (
    <AppShell title="IDEXX Import">
      <div style={{ maxWidth: 960, margin: "0 auto" }}>

        {positiveAlerts.length > 0 && (
          <div style={{ background: "#fee2e2", border: "2px solid #dc2626", borderRadius: 8, padding: "12px 16px", marginBottom: 20 }}>
            <div style={{ fontWeight: 800, fontSize: 14, color: "#dc2626", marginBottom: 8 }}>⚠️ POSITIVE RESULTS DETECTED — {positiveAlerts.length} animal{positiveAlerts.length > 1 ? "s" : ""}</div>
            {positiveAlerts.map((r, i) => (
              <div key={i} style={{ fontSize: 13, marginBottom: 4 }}>
                <a href={`/animals/${r.matchedAnimal?.id || r.manualAnimalId}`} style={{ fontWeight: 700, color: "#dc2626" }}>{r.matchedAnimal?.name || r.animalName}</a>
                {" — "}{r.mappedType}: <strong>POSITIVE{r.rawResult && r.rawResult !== "Positive" ? ` (${r.rawResult})` : ""}</strong>
              </div>
            ))}
          </div>
        )}

        {step === "upload" && (
          <div>
            <div className="card" style={{ padding: 24, marginBottom: 20 }}>
              <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 12 }}>📥 Import IDEXX Results</div>
              <div style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 16, lineHeight: 1.6 }}>
                Upload an IDEXX VetConnect PLUS results PDF or CSV export. Results will be automatically matched to animals and added to their medical records.
              </div>
              <div style={{ background: "#f0f9ff", border: "1px solid #bae6fd", borderRadius: 8, padding: 14, marginBottom: 16, fontSize: 12, lineHeight: 1.8 }}>
                <strong>PDF Import (recommended):</strong> Print or save results from VetConnect PLUS as PDF, then upload here. Each page = one animal.<br />
                <strong>CSV Import:</strong> Export from VetConnect PLUS → Results → Export as CSV.
              </div>
              {parseError && (
                <div style={{ background: "#fee2e2", border: "1px solid #fca5a5", borderRadius: 8, padding: "10px 14px", marginBottom: 12, fontSize: 13, color: "#dc2626" }}>⚠️ {parseError}</div>
              )}
              <DragDropUpload
                onFiles={handleFile}
                accept=".pdf,.csv,application/pdf,text/csv"
                label={parsing ? "Parsing PDF…" : "Drop IDEXX PDF or CSV file here"}
                disabled={parsing}
              />
              {parsing && <div style={{ textAlign: "center", color: "var(--text-muted)", marginTop: 12, fontSize: 13 }}>Extracting results from PDF…</div>}
            </div>

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
                  {matchedCount} matched · {rows.filter((r) => !r.skip && !r.matchedAnimal && !r.manualAnimalId).length} unmatched · {skippedCount} skipped · {rows.length} total
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
                <thead><tr><th style={{ width: 30 }}></th><th>Animal</th><th>Test</th><th>Result</th><th>Date</th><th>Match</th><th>Assign To</th></tr></thead>
                <tbody>
                  {rows.map((r, i) => {
                    const rColor = r.mappedResult === "Positive" ? "#dc2626" : r.mappedResult === "Negative" ? "#15803d" : r.mappedResult === "Inconclusive" ? "#b45309" : "#64748b";
                    return (
                      <tr key={i} style={{ opacity: r.skip ? 0.4 : 1, background: r.mappedResult === "Positive" ? "#fef2f2" : undefined }}>
                        <td><input type="checkbox" checked={!r.skip} onChange={() => setRows((prev) => prev.map((x, j) => j === i ? { ...x, skip: !x.skip } : x))} /></td>
                        <td style={{ fontWeight: 600 }}>{r.animalName || "—"}{r.species ? ` (${r.species})` : ""}</td>
                        <td style={{ fontSize: 12 }}>
                          <div>{r.mappedType}</div>
                          {r.mappedType !== r.testName && <div style={{ fontSize: 10, color: "var(--text-muted)" }}>PDF: {r.testName}</div>}
                        </td>
                        <td>
                          <span style={{ fontWeight: 800, color: rColor }}>{r.mappedResult}</span>
                          {r.rawResult && r.rawResult !== r.mappedResult && r.rawResult !== "Positive" && r.rawResult !== "Negative" && (
                            <span style={{ fontSize: 10, color: "var(--text-muted)", marginLeft: 4 }}>({r.rawResult})</span>
                          )}
                        </td>
                        <td style={{ fontSize: 12 }}>{r.resultDate || "—"}</td>
                        <td>
                          {r.matchScore === "exact" && <span className="badge" style={{ background: "#dcfce7", color: "#15803d", fontSize: 10 }}>✓ Matched</span>}
                          {r.matchScore === "partial" && <span className="badge" style={{ background: "#fef3c7", color: "#b45309", fontSize: 10 }}>~ Partial</span>}
                          {r.matchScore === "none" && !r.manualAnimalId && <span className="badge" style={{ background: "#fee2e2", color: "#dc2626", fontSize: 10 }}>✗ No Match</span>}
                          {r.matchedAnimal && <div style={{ fontSize: 11 }}>{r.matchedAnimal.name} ({r.matchedAnimal.id})</div>}
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
              {rows.filter((r) => r.imported).length} imported · {rows.filter((r) => r.skip || (!r.matchedAnimal && !r.manualAnimalId)).length} skipped · {rows.filter((r) => r.error).length} errors
            </div>
            {rows.filter((r) => r.error).length > 0 && (
              <div style={{ textAlign: "left", marginBottom: 16 }}>
                {rows.filter((r) => r.error).map((r, i) => (
                  <div key={i} style={{ fontSize: 12, color: "#dc2626", marginBottom: 2 }}>• {r.animalName} — {r.mappedType}: {r.error}</div>
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
