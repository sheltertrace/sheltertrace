import type { MedicalRecord } from "./types";
import { isDiagnosticTest } from "./constants";

export function getLatestTestResults(medRecords: MedicalRecord[]): MedicalRecord[] {
  const latest = new Map<string, MedicalRecord>();
  for (const m of medRecords) {
    if (!isDiagnosticTest(m.type) || !m.test_result) continue;
    const existing = latest.get(m.type);
    if (!existing || m.date > existing.date) latest.set(m.type, m);
  }
  return Array.from(latest.values()).sort((a, b) => a.type.localeCompare(b.type));
}

export function hasPositiveTest(medRecords: MedicalRecord[]): boolean {
  return getLatestTestResults(medRecords).some((m) => m.test_result === "Positive");
}

function resultStyle(result: string): { bg: string; color: string; border: string; icon: string } {
  switch (result) {
    case "Negative":     return { bg: "#dcfce7", color: "#15803d", border: "#86efac", icon: "🟢" };
    case "Positive":     return { bg: "#fee2e2", color: "#dc2626", border: "#fca5a5", icon: "🔴" };
    case "Inconclusive": return { bg: "#fef3c7", color: "#b45309", border: "#fde68a", icon: "🟡" };
    default:             return { bg: "#f1f5f9", color: "#64748b", border: "#cbd5e1", icon: "⬜" };
  }
}

function fmtDate(d: string | undefined): string {
  if (!d) return "—";
  const [y, m, day] = d.split("-");
  return `${m}/${day}/${y}`;
}

export function buildTestResultsBadgesHTML(medRecords: MedicalRecord[]): string {
  const tests = getLatestTestResults(medRecords);
  if (tests.length === 0) return "";
  return tests.map((m) => {
    const s = resultStyle(m.test_result || "Pending");
    const warn = m.test_result === "Positive" ? " ⚠️" : "";
    return `<span style="display:inline-flex;align-items:center;gap:3px;padding:3px 10px;border-radius:12px;font-size:11px;font-weight:700;background:${s.bg};color:${s.color};border:1px solid ${s.border};print-color-adjust:exact;-webkit-print-color-adjust:exact;">${s.icon} ${m.type.replace(" Test", "")}: ${(m.test_result || "Pending").toUpperCase()}${warn}</span>`;
  }).join(" ");
}

export function buildTestResultsSectionHTML(medRecords: MedicalRecord[]): string {
  const tests = getLatestTestResults(medRecords);
  const hasPositive = tests.some((m) => m.test_result === "Positive");

  const positiveWarning = hasPositive
    ? `<div style="background:#fee2e2;border:2px solid #dc2626;border-radius:5px;padding:6px 10px;font-size:11px;font-weight:800;color:#dc2626;margin-bottom:8px;print-color-adjust:exact;-webkit-print-color-adjust:exact;">⚠️ POSITIVE TEST RESULT ON FILE — See medical records for details</div>`
    : "";

  if (tests.length === 0) {
    return `
    <div style="border:1.5px solid #e2e8f0;border-radius:6px;overflow:hidden;margin-bottom:10px;">
      <div style="background:#7c3aed;color:#fff;padding:5px 14px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;print-color-adjust:exact;-webkit-print-color-adjust:exact;">🔬 Diagnostic Test Results</div>
      <div style="padding:8px 12px;color:#94a3b8;font-style:italic;font-size:11px;">No diagnostic tests on record</div>
    </div>`;
  }

  const rows = tests.map((m) => {
    const s = resultStyle(m.test_result || "Pending");
    const warn = m.test_result === "Positive" ? " ⚠️" : "";
    return `<tr>
      <td style="padding:4px 8px;border:1px solid #e2e8f0;font-size:11px;">${m.type}</td>
      <td style="padding:4px 8px;border:1px solid #e2e8f0;font-size:11px;font-weight:800;color:${s.color};background:${s.bg};print-color-adjust:exact;-webkit-print-color-adjust:exact;">${s.icon} ${(m.test_result || "Pending").toUpperCase()}${warn}</td>
      <td style="padding:4px 8px;border:1px solid #e2e8f0;font-size:11px;">${fmtDate(m.date)}</td>
      <td style="padding:4px 8px;border:1px solid #e2e8f0;font-size:11px;">${m.tested_by || m.vet || "—"}</td>
    </tr>`;
  }).join("");

  return `
  <div style="border:1.5px solid #e2e8f0;border-radius:6px;overflow:hidden;margin-bottom:10px;">
    <div style="background:#7c3aed;color:#fff;padding:5px 14px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;print-color-adjust:exact;-webkit-print-color-adjust:exact;">🔬 Diagnostic Test Results</div>
    <div style="padding:8px 12px;">
      ${positiveWarning}
      <table style="width:100%;border-collapse:collapse;">
        <thead><tr style="background:#f3e8ff;print-color-adjust:exact;-webkit-print-color-adjust:exact;">
          <th style="padding:4px 8px;text-align:left;font-size:10px;font-weight:700;color:#6d28d9;border:1px solid #e2e8f0;">Test Type</th>
          <th style="padding:4px 8px;text-align:left;font-size:10px;font-weight:700;color:#6d28d9;border:1px solid #e2e8f0;">Result</th>
          <th style="padding:4px 8px;text-align:left;font-size:10px;font-weight:700;color:#6d28d9;border:1px solid #e2e8f0;">Date</th>
          <th style="padding:4px 8px;text-align:left;font-size:10px;font-weight:700;color:#6d28d9;border:1px solid #e2e8f0;">Tested By</th>
        </tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  </div>`;
}

export function buildTestResultsTableHTML(medRecords: MedicalRecord[]): string {
  const tests = getLatestTestResults(medRecords);
  const hasPositive = tests.some((m) => m.test_result === "Positive");

  const positiveWarning = hasPositive
    ? `<div style="font-weight:800;color:#dc2626;font-size:12px;margin-top:6px;border:2px solid #dc2626;border-radius:4px;padding:4px 8px;print-color-adjust:exact;-webkit-print-color-adjust:exact;">⚠️ POSITIVE TEST RESULT ON FILE — See medical records for details</div>`
    : "";

  if (tests.length === 0) {
    return `<div style="margin-top:10px;"><div style="font-size:12px;font-weight:700;margin-bottom:4px;">Diagnostic Test Results</div><div style="font-size:11px;color:#64748b;font-style:italic;">No diagnostic tests on record</div></div>`;
  }

  const rows = tests.map((m) => {
    const s = resultStyle(m.test_result || "Pending");
    return `<tr>
      <td style="padding:3px 6px;border:1px solid #d1d5db;font-size:11px;">${m.type}</td>
      <td style="padding:3px 6px;border:1px solid #d1d5db;font-size:11px;font-weight:700;color:${s.color};print-color-adjust:exact;-webkit-print-color-adjust:exact;">${m.test_result || "Pending"}</td>
      <td style="padding:3px 6px;border:1px solid #d1d5db;font-size:11px;">${fmtDate(m.date)}</td>
    </tr>`;
  }).join("");

  return `
  <div style="margin-top:10px;">
    <div style="font-size:12px;font-weight:700;margin-bottom:4px;">Diagnostic Test Results</div>
    <table style="width:100%;border-collapse:collapse;">
      <thead><tr style="background:#f3f4f6;print-color-adjust:exact;-webkit-print-color-adjust:exact;">
        <th style="padding:3px 6px;text-align:left;font-size:10px;font-weight:700;border:1px solid #d1d5db;">Test Type</th>
        <th style="padding:3px 6px;text-align:left;font-size:10px;font-weight:700;border:1px solid #d1d5db;">Result</th>
        <th style="padding:3px 6px;text-align:left;font-size:10px;font-weight:700;border:1px solid #d1d5db;">Date</th>
      </tr></thead>
      <tbody>${rows}</tbody>
    </table>
    ${positiveWarning}
  </div>`;
}
