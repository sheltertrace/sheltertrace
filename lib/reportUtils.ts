// Shared utilities for the Reports section.
// Handles: print windows, CSV export, date-range presets, formatting.

export type DatePreset =
  | "today" | "week" | "month" | "quarter" | "year"
  | "last_month" | "last_year" | "custom";

export interface DateRange { from: string; to: string; label: string; }

/** Compute a concrete {from, to, label} from a preset + optional custom dates. */
export function computeDateRange(
  preset: DatePreset,
  customFrom: string,
  customTo: string
): DateRange {
  const now  = new Date();
  const ymd  = (d: Date) => d.toISOString().split("T")[0];
  const fmt  = (d: Date) => d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

  switch (preset) {
    case "today": {
      const d = ymd(now);
      return { from: d, to: d, label: `Today (${fmt(now)})` };
    }
    case "week": {
      const start = new Date(now);
      start.setDate(now.getDate() - now.getDay());
      const end = new Date(start); end.setDate(start.getDate() + 6);
      return { from: ymd(start), to: ymd(end), label: `This Week (${fmt(start)}–${fmt(end)})` };
    }
    case "month": {
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      const end   = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      return { from: ymd(start), to: ymd(end), label: `This Month (${fmt(start)}–${fmt(end)})` };
    }
    case "quarter": {
      const q = Math.floor(now.getMonth() / 3);
      const start = new Date(now.getFullYear(), q * 3, 1);
      const end   = new Date(now.getFullYear(), q * 3 + 3, 0);
      return { from: ymd(start), to: ymd(end), label: `This Quarter (${fmt(start)}–${fmt(end)})` };
    }
    case "year": {
      const start = new Date(now.getFullYear(), 0, 1);
      const end   = new Date(now.getFullYear(), 11, 31);
      return { from: ymd(start), to: ymd(end), label: `This Year (${now.getFullYear()})` };
    }
    case "last_month": {
      const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const end   = new Date(now.getFullYear(), now.getMonth(), 0);
      return { from: ymd(start), to: ymd(end), label: `Last Month (${fmt(start)}–${fmt(end)})` };
    }
    case "last_year": {
      const y = now.getFullYear() - 1;
      return { from: `${y}-01-01`, to: `${y}-12-31`, label: `Last Year (${y})` };
    }
    case "custom":
    default: {
      const label = customFrom && customTo
        ? `${customFrom} to ${customTo}`
        : "Custom Range";
      return { from: customFrom, to: customTo, label };
    }
  }
}

/** Return true if a YYYY-MM-DD date string falls within [from, to] inclusive. */
export function inRange(dateStr: string | null | undefined, from: string, to: string): boolean {
  if (!dateStr || !from || !to) return false;
  return dateStr >= from && dateStr <= to;
}

// ── Formatting helpers ─────────────────────────────────────────────────────────

export function fmtMoney(n?: number | null): string {
  if (n == null) return "—";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);
}

export function fmtDateUS(d?: string | null): string {
  if (!d) return "—";
  const dt = new Date(`${d}T12:00:00`);
  return dt.toLocaleDateString("en-US", { month: "2-digit", day: "2-digit", year: "numeric" });
}

// ── Shared print window ────────────────────────────────────────────────────────

const PRINT_CSS = `
  * { box-sizing: border-box; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; color-adjust: exact !important; }
  body { font-family: Arial, Helvetica, sans-serif; font-size: 10pt; color: #111; margin: 0.5in; }
  h1 { font-size: 14pt; margin: 0 0 2px; }
  h2 { font-size: 12pt; margin: 0 0 4px; }
  .mcas-hdr { border-bottom: 2px solid #0f2942; padding-bottom: 10px; margin-bottom: 16px; }
  .mcas-hdr .sub { font-size: 9pt; color: #555; margin: 2px 0; }
  .summary { display: flex; gap: 24px; margin-bottom: 14px; flex-wrap: wrap; }
  .summary-item { text-align: center; }
  .summary-item .val { font-size: 18pt; font-weight: 800; }
  .summary-item .lbl { font-size: 8pt; color: #555; text-transform: uppercase; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
  th { background: #e8eef4; padding: 5px 8px; border: 1px solid #ccc; text-align: left; font-size: 9pt; }
  td { padding: 4px 8px; border: 1px solid #ddd; font-size: 9pt; }
  tr:nth-child(even) td { background: #f9fafb; }
  .right { text-align: right; }
  .bold { font-weight: 700; }
  .section-title { font-size: 11pt; font-weight: 700; margin: 18px 0 6px; border-bottom: 1px solid #ccc; padding-bottom: 3px; }
  .footer { margin-top: 20px; font-size: 8pt; color: #999; border-top: 1px solid #ddd; padding-top: 6px; }
  .page-break { page-break-before: always; }
  @media print {
    body { margin: 0.4in; }
    .no-print { display: none !important; }
  }
`;

export function printReport(
  title: string,
  dateRange: string,
  bodyHtml: string,
  generatedBy?: string
): void {
  const w = window.open("", "_blank", "width=900,height=700");
  if (!w) return;
  w.document.write(`<!DOCTYPE html><html><head><title>${title}</title>
<style>${PRINT_CSS}</style></head><body>
<div class="mcas-hdr">
  <h1>Morgan County Animal Services</h1>
  <p class="sub">2392 Athens Hwy, Madison, GA 30650 · (706) 752-1195</p>
  <h2>${title}</h2>
  <p class="sub">Period: ${dateRange}</p>
</div>
${bodyHtml}
<div class="footer">Generated ${new Date().toLocaleString()}${generatedBy ? ` by ${generatedBy}` : ""} · ShelterTrace</div>
</body></html>`);
  w.document.close();
  setTimeout(() => w.print(), 400);
}

// ── CSV export ─────────────────────────────────────────────────────────────────

export function downloadCsv(filename: string, headers: string[], rows: (string | number | null | undefined)[][]): void {
  const esc = (v: string | number | null | undefined): string => {
    const s = String(v ?? "").replace(/"/g, '""');
    return s.includes(",") || s.includes('"') || s.includes("\n") ? `"${s}"` : s;
  };
  const lines = [headers.map(esc).join(","), ...rows.map((r) => r.map(esc).join(","))];
  const blob  = new Blob([lines.join("\n")], { type: "text/csv" });
  const url   = URL.createObjectURL(blob);
  const a     = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

// ── Days between two date strings ─────────────────────────────────────────────
export function daysBetween(a?: string | null, b?: string | null): number {
  if (!a || !b) return 0;
  return Math.round(Math.abs(new Date(b).getTime() - new Date(a).getTime()) / 86400000);
}
