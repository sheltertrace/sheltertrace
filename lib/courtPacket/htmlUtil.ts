// Pure string helpers shared by the client-side packet builder and the
// server-side render route. No "use client" / browser APIs here on purpose.

export const LOGO_TOKEN = "cid:mcas-seal";

export function esc(v: unknown): string {
  return String(v ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// Remove every @page { ... } rule, including nested margin boxes
// (@top-left { ... }). Each section print carries its own page furniture
// (per-document "Page 1 of 3" headers, screen print buttons' margins); in a
// packet those would fight the packet's continuous numbering, so the render
// step owns page size and margins instead.
export function stripPageRules(html: string): string {
  let out = "";
  let i = 0;
  while (i < html.length) {
    const at = html.indexOf("@page", i);
    if (at === -1) { out += html.slice(i); break; }
    out += html.slice(i, at);
    const open = html.indexOf("{", at);
    if (open === -1) { out += html.slice(at); break; }
    let depth = 1;
    let j = open + 1;
    while (j < html.length && depth > 0) {
      if (html[j] === "{") depth++;
      else if (html[j] === "}") depth--;
      j++;
    }
    i = j;
  }
  return out;
}

// Prepend the repeating section banner (title + call number) and neutralize
// per-document body padding/screen-only controls.
export function decorateSection(html: string, opts: { callNumber: string; title: string }): string {
  const style = `<style>
    body { padding: 0 !important; margin: 0 !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .no-print { display: none !important; }
    .pk-hdr { display:flex; justify-content:space-between; align-items:baseline; border-bottom:2px solid #0f2942; padding-bottom:5px; margin-bottom:14px; font-family: Arial, Helvetica, sans-serif; }
    .pk-hdr .t { font-size:11px; font-weight:800; letter-spacing:.6px; text-transform:uppercase; color:#0f2942; }
    .pk-hdr .c { font-size:10px; font-weight:700; color:#475569; font-family: monospace; }
  </style>`;
  const banner = `<div class="pk-hdr"><span class="t">${esc(opts.title)}</span><span class="c">${esc(opts.callNumber)}</span></div>`;
  let out = stripPageRules(html);
  if (/<\/head>/i.test(out)) out = out.replace(/<\/head>/i, `${style}</head>`);
  else out = style + out;
  if (/<body[^>]*>/i.test(out)) out = out.replace(/(<body[^>]*>)/i, `$1${banner}`);
  else out = out.replace(/(<\/style>)/i, `$1${banner}`);
  return out;
}

// Wrap loose body content (sections built by the packet itself) in a document.
export function wrapDocument(bodyHtml: string, title = "Court Packet"): string {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${esc(title)}</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: Arial, Helvetica, sans-serif; color:#0f172a; font-size:12px; line-height:1.45; }
  section { margin-bottom: 18px; }
  .st { font-size:10px; font-weight:700; text-transform:uppercase; letter-spacing:.6px; color:#1e3a5f; border-bottom:2px solid #1e3a5f; padding-bottom:4px; margin:0 0 8px; }
  .row { display:flex; gap:12px; padding:4px 0; border-bottom:1px solid #f1f5f9; }
  .row .k { width:150px; flex-shrink:0; color:#64748b; font-weight:600; }
  .card { border:1px solid #e2e8f0; border-radius:6px; padding:10px 12px; margin-bottom:10px; page-break-inside: avoid; }
  .muted { color:#94a3b8; font-style:italic; }
  table { width:100%; border-collapse:collapse; }
  th, td { text-align:left; padding:5px 8px; border:1px solid #e2e8f0; font-size:11px; vertical-align:top; }
  th { background:#f1f5f9; font-size:10px; text-transform:uppercase; letter-spacing:.4px; color:#475569; }
</style></head><body>${bodyHtml}</body></html>`;
}

export function fld(label: string, val?: unknown): string {
  const v = val === undefined || val === null || String(val).trim() === "" ? "" : esc(val);
  return v ? `<div class="row"><span class="k">${esc(label)}</span><span>${v}</span></div>` : "";
}
