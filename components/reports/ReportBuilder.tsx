"use client";
import { useState, useCallback } from "react";
import DateInput from "@/components/ui/DateInput";
import { downloadCsv } from "@/lib/reportUtils";
import { today } from "@/lib/utils";
import type { ReportConfig, ReportRow, FieldConfig } from "@/lib/reportTypes";

function fmtCell(val: unknown, field: FieldConfig, row: ReportRow): string {
  if (field.format) return field.format(val, row);
  if (val == null) return "—";
  return String(val);
}

export default function ReportBuilder({ config }: { config: ReportConfig }) {
  const [dateFrom, setDateFrom] = useState(`${new Date().getFullYear()}-01-01`);
  const [dateTo, setDateTo] = useState(today());
  const [filterValues, setFilterValues] = useState<Record<string, string>>(
    () => Object.fromEntries(config.filters.map((f) => [f.key, "All"]))
  );
  const [activeFields, setActiveFields] = useState<Set<string>>(
    () => new Set(config.fields.filter((f) => f.defaultOn !== false).map((f) => f.key))
  );
  const [rows, setRows] = useState<ReportRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [generated, setGenerated] = useState(false);
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [fieldsOpen, setFieldsOpen] = useState(false);

  const visibleFields = config.fields.filter((f) => activeFields.has(f.key));

  const handleSort = useCallback((key: string) => {
    setSortKey((prev) => {
      if (prev === key) {
        setSortDir((d) => (d === "asc" ? "desc" : "asc"));
        return key;
      }
      setSortDir("asc");
      return key;
    });
  }, []);

  const sortedRows = [...rows].sort((a, b) => {
    if (!sortKey) return 0;
    const av = a[sortKey] ?? "";
    const bv = b[sortKey] ?? "";
    const cmp = String(av).localeCompare(String(bv), undefined, { numeric: true });
    return sortDir === "asc" ? cmp : -cmp;
  });

  const handleGenerate = async () => {
    setLoading(true);
    try {
      const data = await config.fetchData(dateFrom, dateTo, filterValues);
      setRows(data);
      setGenerated(true);
    } catch (e) {
      console.error("[ReportBuilder] fetchData error:", e);
      setRows([]);
      setGenerated(true);
    } finally {
      setLoading(false);
    }
  };

  const exportCSV = () => {
    const headers = visibleFields.map((f) => f.label);
    const csvRows = sortedRows.map((row) =>
      visibleFields.map((f) => fmtCell(row[f.key], f, row))
    );
    downloadCsv(`${config.id}-${dateFrom}-${dateTo}.csv`, headers, csvRows);
  };

  const printResults = () => {
    const w = window.open("", "_blank", "width=1000,height=750");
    if (!w) return;
    const activeFilterLines = config.filters
      .filter((f) => filterValues[f.key] && filterValues[f.key] !== "All")
      .map((f) => `${f.label}: ${filterValues[f.key]}`)
      .join(" | ");
    const theadHtml = visibleFields.map((f) => `<th>${f.label}</th>`).join("");
    const tbodyHtml = sortedRows.map((row, i) => {
      const cells = visibleFields.map((f) => `<td>${fmtCell(row[f.key], f, row)}</td>`).join("");
      return `<tr class="${i % 2 === 1 ? "alt" : ""}">${cells}</tr>`;
    }).join("");
    const summaryData = config.summaryRow ? config.summaryRow(sortedRows) : null;
    const summaryHtml = summaryData
      ? `<tr class="summary-row">${visibleFields.map((f) => `<td>${fmtCell(summaryData[f.key], f, summaryData)}</td>`).join("")}</tr>`
      : "";
    w.document.write(`<!DOCTYPE html><html><head><title>${config.title}</title>
<style>
@page { size: letter landscape; margin: 0.5in; }
* { box-sizing: border-box; }
body { font-family: Arial, sans-serif; font-size: 9pt; color: #111; margin: 0; }
.header { background: #0f2942; color: #fff; padding: 12px 16px; margin-bottom: 14px; }
.header h1 { margin: 0 0 2px; font-size: 14pt; }
.header h2 { margin: 0 0 4px; font-size: 11pt; font-weight: 400; }
.header p { margin: 0; font-size: 9pt; opacity: 0.85; }
table { width: 100%; border-collapse: collapse; }
th { background: #e8eef4; padding: 4px 7px; border: 1px solid #ccc; text-align: left; font-size: 8pt; }
td { padding: 3px 7px; border: 1px solid #ddd; font-size: 8pt; }
tr.alt td { background: #f9fafb; }
tr.summary-row td { background: #f0fdf4; font-weight: 700; border-top: 2px solid #86efac; }
.count { margin: 8px 0; font-size: 10pt; }
.footer { margin-top: 16px; font-size: 8pt; color: #888; border-top: 1px solid #ddd; padding-top: 6px; }
</style>
</head><body>
<div class="header">
  <h1>Morgan County Animal Services</h1>
  <h2>${config.icon} ${config.title}</h2>
  <p>Period: ${dateFrom} – ${dateTo}${activeFilterLines ? " | " + activeFilterLines : ""}</p>
</div>
<div class="count">${sortedRows.length} record(s)</div>
<table><thead><tr>${theadHtml}</tr></thead><tbody>${tbodyHtml}${summaryHtml}</tbody></table>
<div class="footer">Morgan County Animal Services &middot; 390 Hancock Drive, Madison, GA 30650 &middot; (706) 343-7566 | Generated ${new Date().toLocaleString()}</div>
</body></html>`);
    w.document.close();
    w.onload = () => w.print();
  };

  const summaryData = config.summaryRow && generated ? config.summaryRow(sortedRows) : null;

  return (
    <div>
      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontWeight: 700, fontSize: 14 }}>{config.icon} {config.title}</div>
          <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>{config.description}</div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: config.filters.length > 0 ? 12 : 0 }}>
          <div>
            <label style={{ display: "block", fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Date From</label>
            <DateInput
              className="form-input"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
            />
          </div>
          <div>
            <label style={{ display: "block", fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Date To</label>
            <DateInput
              className="form-input"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
            />
          </div>
        </div>
        {config.filters.length > 0 && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
            {config.filters.map((filter) => (
              <div key={filter.key}>
                <label style={{ display: "block", fontSize: 12, fontWeight: 600, marginBottom: 4 }}>{filter.label}</label>
                {filter.type === "select" ? (
                  <select
                    className="form-input"
                    value={filterValues[filter.key] ?? "All"}
                    onChange={(e) => setFilterValues((prev) => ({ ...prev, [filter.key]: e.target.value }))}
                  >
                    <option value="All">All</option>
                    {filter.options?.map((o) => <option key={o} value={o}>{o}</option>)}
                  </select>
                ) : (
                  <input
                    type="text"
                    className="form-input"
                    value={filterValues[filter.key] ?? ""}
                    onChange={(e) => setFilterValues((prev) => ({ ...prev, [filter.key]: e.target.value }))}
                    placeholder={`Filter by ${filter.label.toLowerCase()}...`}
                  />
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <button
          type="button"
          onClick={() => setFieldsOpen((o) => !o)}
          style={{ background: "none", border: "none", cursor: "pointer", padding: 0, fontSize: 13, fontWeight: 600, display: "flex", alignItems: "center", gap: 6 }}
        >
          {fieldsOpen ? "▾" : "▸"} Include Fields ({activeFields.size} of {config.fields.length} selected)
        </button>
        {fieldsOpen && (
          <div style={{ marginTop: 12 }}>
            <label style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
              <input
                type="checkbox"
                checked={activeFields.size === config.fields.length}
                onChange={(e) => {
                  if (e.target.checked) setActiveFields(new Set(config.fields.map((f) => f.key)));
                  else setActiveFields(new Set());
                }}
              />
              Select All
            </label>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(190px, 1fr))", gap: 6 }}>
              {config.fields.map((f) => (
                <label key={f.key} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, cursor: "pointer" }}>
                  <input
                    type="checkbox"
                    checked={activeFields.has(f.key)}
                    onChange={(e) => {
                      setActiveFields((prev) => {
                        const next = new Set(prev);
                        if (e.target.checked) next.add(f.key);
                        else next.delete(f.key);
                        return next;
                      });
                    }}
                  />
                  {f.label}
                </label>
              ))}
            </div>
          </div>
        )}
      </div>

      <button
        className="btn btn-primary"
        onClick={handleGenerate}
        disabled={loading}
        style={{ width: "100%", fontSize: 12, marginBottom: 16 }}
      >
        {loading ? "Generating…" : "Generate Report"}
      </button>

      {generated && (
        <div className="card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, flexWrap: "wrap", gap: 8 }}>
            <div style={{ fontWeight: 600, fontSize: 13 }}>{rows.length} record(s)</div>
            <div style={{ display: "flex", gap: 8 }}>
              <button className="btn btn-secondary btn-sm" onClick={exportCSV}>Export CSV</button>
              <button className="btn btn-secondary btn-sm" onClick={printResults}>Print</button>
            </div>
          </div>
          {rows.length === 0 ? (
            <div style={{ textAlign: "center", padding: "32px 0", color: "var(--text-secondary)", fontSize: 13 }}>
              No records match the selected filters
            </div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table className="data-table">
                <thead>
                  <tr>
                    {visibleFields.map((f) => (
                      <th
                        key={f.key}
                        onClick={() => handleSort(f.key)}
                        style={{ cursor: "pointer", userSelect: "none", whiteSpace: "nowrap" }}
                      >
                        {f.label}
                        {sortKey === f.key ? (sortDir === "asc" ? " ↑" : " ↓") : " ↕"}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sortedRows.map((row, i) => (
                    <tr key={i}>
                      {visibleFields.map((f) => (
                        <td key={f.key} style={{ fontSize: 12 }}>{fmtCell(row[f.key], f, row)}</td>
                      ))}
                    </tr>
                  ))}
                  {summaryData && (
                    <tr style={{ background: "#f0fdf4", fontWeight: 700, borderTop: "2px solid #86efac" }}>
                      {visibleFields.map((f) => (
                        <td key={f.key} style={{ fontSize: 12, fontWeight: 700 }}>{fmtCell(summaryData[f.key], f, summaryData)}</td>
                      ))}
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
