"use client";
import type { PDFDocument, PDFFont, PDFPage } from "pdf-lib";
import type { EvidenceItem, StaffAccount } from "../types";
import { AGENCY_SEAL_LOGO } from "../shelterInfo";
import { buildCitationHTML } from "../citationPrint";
import { buildBiteReportHTML } from "../biteReportPrint";
import { buildIntakeFormHTML } from "../intakeFormPrint";
import { decorateSection, stripPageRules, LOGO_TOKEN } from "./htmlUtil";
import {
  type PacketInputs, type PacketExtras, type SectionId, type TocEntry,
  buildCoverHtml, buildCertificationHtml, buildPeopleHtml, buildAnimalsHtml, buildWitnessHtml,
  buildMedicalHtml, buildQuarantineHtml, describeSections, photoEvidence, documentEvidence,
  impoundedAnimals, quarantineRows, evidenceUrl,
} from "./sections";

type PdfLib = typeof import("pdf-lib");

export interface PacketProgress { done: number; total: number; label: string }
export interface PacketSectionResult { id: SectionId; label: string; startPage: number; pages: number }
export interface PacketResult {
  bytes: Uint8Array;
  pageCount: number;
  filename: string;
  sections: PacketSectionResult[];
  skipped: string[]; // "[Section] — record no longer available"
}

export function courtPacketFilename(callNumber: string, d = new Date()): string {
  const ymd = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  return `MCAS_${callNumber.replace(/[^A-Za-z0-9-]/g, "_")}_CourtPacket_${ymd}.pdf`;
}

// ── Server rendering (HTML → PDF via headless Chromium) ───────────────────────

async function renderHtml(html: string, staffId: string): Promise<Uint8Array> {
  // The 1.4MB seal is inlined as a data URL in several print templates — swap
  // it for a token the server re-inflates, rather than uploading it every call.
  let payload = stripPageRules(html);
  if (AGENCY_SEAL_LOGO.startsWith("data:")) payload = payload.split(AGENCY_SEAL_LOGO).join(LOGO_TOKEN);
  let lastErr: unknown;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await fetch("/api/court-packet/render", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-staff-id": staffId },
        body: JSON.stringify({ html: payload }),
      });
      if (res.ok) return new Uint8Array(await res.arrayBuffer());
      const msg = await res.json().catch(() => ({ error: res.statusText }));
      lastErr = new Error(msg.error || `Render failed (${res.status})`);
      if (res.status < 500) break; // a 4xx won't get better on retry
    } catch (e) { lastErr = e; }
  }
  throw lastErr instanceof Error ? lastErr : new Error("Render failed");
}

// ── pdf-lib drawing helpers ───────────────────────────────────────────────────

const PAGE_W = 612;
const PAGE_H = 792;

// pdf-lib's standard fonts only encode WinAnsi — anything else would throw.
function safe(s: string): string {
  // Keep the typographic dashes/quotes WinAnsi does encode (so an em dash in
  // the notice and footer prints as written); flatten everything else.
  return String(s ?? "")
    .replace(/\u00A0/g, " ")
    .replace(/\r?\n/g, " ")
    .replace(/[^\x20-\x7E\xA1-\xFF\u2013\u2014\u2018\u2019\u201C\u201D\u2022\u2026]/g, "?");
}

function wrap(font: PDFFont, text: string, size: number, maxW: number): string[] {
  const out: string[] = [];
  let line = "";
  for (const word of safe(text).split(/\s+/).filter(Boolean)) {
    const next = line ? `${line} ${word}` : word;
    if (font.widthOfTextAtSize(next, size) <= maxW) line = next;
    else { if (line) out.push(line); line = word; }
  }
  if (line) out.push(line);
  return out.length ? out : [""];
}

async function fonts(pdfLib: PdfLib, doc: PDFDocument) {
  return { reg: await doc.embedFont(pdfLib.StandardFonts.Helvetica), bold: await doc.embedFont(pdfLib.StandardFonts.HelveticaBold) };
}

function headerBand(pdfLib: PdfLib, page: PDFPage, f: { reg: PDFFont; bold: PDFFont }, title: string, callNumber: string) {
  const ink = pdfLib.rgb(0.06, 0.16, 0.26);
  page.drawText(safe(title.toUpperCase()), { x: 43, y: PAGE_H - 46, size: 10, font: f.bold, color: ink });
  const cn = safe(callNumber);
  page.drawText(cn, { x: PAGE_W - 43 - f.reg.widthOfTextAtSize(cn, 9), y: PAGE_H - 45, size: 9, font: f.reg, color: pdfLib.rgb(0.28, 0.33, 0.41) });
  page.drawLine({ start: { x: 43, y: PAGE_H - 54 }, end: { x: PAGE_W - 43, y: PAGE_H - 54 }, thickness: 1.5, color: ink });
}

function drawLines(pdfLib: PdfLib, page: PDFPage, f: { reg: PDFFont; bold: PDFFont }, lines: Array<{ text: string; bold?: boolean; size?: number }>, x: number, y: number, maxW: number): number {
  let cy = y;
  for (const l of lines) {
    const size = l.size || 10;
    for (const w of wrap(l.bold ? f.bold : f.reg, l.text, size, maxW)) {
      page.drawText(w, { x, y: cy, size, font: l.bold ? f.bold : f.reg, color: pdfLib.rgb(0.1, 0.13, 0.2) });
      cy -= size + 4;
    }
  }
  return cy;
}

async function noticePdf(pdfLib: PdfLib, callNumber: string, section: string, detail?: string): Promise<Uint8Array> {
  const doc = await pdfLib.PDFDocument.create();
  const f = await fonts(pdfLib, doc);
  const page = doc.addPage([PAGE_W, PAGE_H]);
  headerBand(pdfLib, page, f, section, callNumber);
  drawLines(pdfLib, page, f, [
    { text: `${section} — record no longer available`, bold: true, size: 13 },
    { text: "This item was selected for the packet but could not be retrieved when the packet was generated, so it has been skipped." },
    ...(detail ? [{ text: `Detail: ${detail}` }] : []),
  ], 43, PAGE_H - 96, PAGE_W - 86);
  return doc.save();
}

// ── Photos and attached documents (built in the browser; no server needed) ───

const meta = (it: EvidenceItem, ...keys: string[]): string => {
  const r = it as unknown as Record<string, unknown>;
  for (const k of keys) if (r[k] !== undefined && r[k] !== null && String(r[k]).trim() !== "") return String(r[k]);
  return "";
};

async function loadImageAsJpeg(url: string): Promise<{ bytes: Uint8Array; w: number; h: number }> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`image ${res.status}`);
  const bmp = await createImageBitmap(await res.blob());
  // Full-resolution phone photos would make the packet enormous — 1600px on
  // the long edge is plenty for a letter page.
  const scale = Math.min(1, 1600 / Math.max(bmp.width, bmp.height));
  const w = Math.max(1, Math.round(bmp.width * scale));
  const h = Math.max(1, Math.round(bmp.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("no canvas");
  ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, w, h);
  ctx.drawImage(bmp, 0, 0, w, h);
  bmp.close?.();
  const blob: Blob | null = await new Promise((r) => canvas.toBlob(r, "image/jpeg", 0.8));
  if (!blob) throw new Error("encode failed");
  return { bytes: new Uint8Array(await blob.arrayBuffer()), w, h };
}

async function photoPdf(pdfLib: PdfLib, callNumber: string, item: EvidenceItem, i: number, n: number): Promise<Uint8Array> {
  const url = evidenceUrl(item)!;
  const img = await loadImageAsJpeg(url);
  const doc = await pdfLib.PDFDocument.create();
  const f = await fonts(pdfLib, doc);
  const page = doc.addPage([PAGE_W, PAGE_H]);
  headerBand(pdfLib, page, f, "Photos and Evidence", callNumber);
  const jpg = await doc.embedJpg(img.bytes);
  const maxW = PAGE_W - 86, maxH = 500;
  const s = Math.min(maxW / img.w, maxH / img.h);
  const dw = img.w * s, dh = img.h * s;
  const top = PAGE_H - 74;
  page.drawImage(jpg, { x: (PAGE_W - dw) / 2, y: top - dh, width: dw, height: dh });
  page.drawRectangle({ x: (PAGE_W - dw) / 2, y: top - dh, width: dw, height: dh, borderColor: pdfLib.rgb(0.8, 0.84, 0.88), borderWidth: 0.75 });
  const gps = meta(item, "gps", "location") || ((meta(item, "lat", "latitude") && meta(item, "lng", "longitude")) ? `${meta(item, "lat", "latitude")}, ${meta(item, "lng", "longitude")}` : "");
  drawLines(pdfLib, page, f, [
    { text: `Photo ${i} of ${n}`, bold: true, size: 11 },
    { text: `Description: ${item.description || item.notes || item.file_name || "—"}` },
    { text: `Source: Dispatch call evidence${item.file_name ? ` — ${item.file_name}` : ""}` },
    { text: `Date: ${meta(item, "uploaded_at", "timestamp", "date") || "not recorded"}` },
    { text: `Uploaded by: ${meta(item, "uploaded_by", "added_by") || "not recorded"}` },
    ...(gps ? [{ text: `GPS: ${gps}` }] : []),
  ], 43, top - dh - 22, PAGE_W - 86);
  return doc.save();
}

async function documentPdf(pdfLib: PdfLib, callNumber: string, item: EvidenceItem, i: number, n: number): Promise<Uint8Array> {
  const url = evidenceUrl(item)!;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`document ${res.status}`);
  const buf = new Uint8Array(await res.arrayBuffer());
  const isPdf = buf.length > 4 && String.fromCharCode(buf[0], buf[1], buf[2], buf[3]) === "%PDF";
  const doc = await pdfLib.PDFDocument.create();
  const f = await fonts(pdfLib, doc);
  const cover = doc.addPage([PAGE_W, PAGE_H]);
  headerBand(pdfLib, cover, f, "Attached Documents", callNumber);
  let embedded: Awaited<ReturnType<PDFDocument["embedPdf"]>> = [];
  let note = "";
  if (isPdf) {
    try {
      const src = await pdfLib.PDFDocument.load(buf, { ignoreEncryption: true });
      embedded = await doc.embedPdf(src, src.getPageIndices());
    } catch { note = "This PDF could not be read (it may be damaged or protected), so its pages are not included."; }
  } else {
    note = "This file type can't be embedded in the packet. It remains available in the call's attached documents.";
  }
  drawLines(pdfLib, cover, f, [
    { text: `Attached Document ${i} of ${n}`, bold: true, size: 13 },
    { text: `File: ${item.file_name || item.description || "document"}` },
    { text: `Description: ${item.description || item.notes || "—"}` },
    { text: `Date: ${meta(item, "uploaded_at", "timestamp", "date") || "not recorded"}` },
    { text: `Uploaded by: ${meta(item, "uploaded_by", "added_by") || "not recorded"}` },
    { text: `Size: ${(buf.length / 1024).toFixed(0)} KB${embedded.length ? ` · ${embedded.length} page${embedded.length === 1 ? " follows" : "s follow"}` : ""}` },
    ...(note ? [{ text: note, bold: true }] : []),
  ], 43, PAGE_H - 96, PAGE_W - 86);
  // Scale each attached page into a safe letter-sized area so packet page
  // numbers and footers never collide with the attachment's own content.
  for (const ep of embedded) {
    const p = doc.addPage([PAGE_W, PAGE_H]);
    headerBand(pdfLib, p, f, `Attached Document ${i} of ${n}`, callNumber);
    const boxW = PAGE_W - 72, boxH = PAGE_H - 62 - 66;
    const s = Math.min(boxW / ep.width, boxH / ep.height);
    p.drawPage(ep, { x: (PAGE_W - ep.width * s) / 2, y: 66 + (boxH - ep.height * s) / 2, width: ep.width * s, height: ep.height * s });
  }
  return doc.save();
}

// ── Orchestration ─────────────────────────────────────────────────────────────

interface Part { section: SectionId; label: string; sectionTitle: string; run: () => Promise<Uint8Array> }

export async function generateCourtPacket(
  inputs: PacketInputs,
  extras: PacketExtras,
  selected: Set<SectionId>,
  user: StaffAccount,
  onProgress: (p: PacketProgress) => void,
  signal?: { aborted: boolean },
): Promise<PacketResult> {
  const pdfLib = await import("pdf-lib");
  const { PDFDocument, StandardFonts, rgb } = pdfLib;
  const callNumber = inputs.callNumber;
  const defs = describeSections(inputs, extras);
  const isSel = (id: SectionId) => selected.has(id) && defs.some((d) => d.id === id);
  const render = (html: string, title: string) => renderHtml(decorateSection(html, { callNumber, title }), user.id);

  // Build the ordered work list (spec order). Each part becomes one server
  // render or one browser-built PDF; a failure in one never sinks the packet.
  const parts: Part[] = [];
  const add = (section: SectionId, label: string, sectionTitle: string, run: () => Promise<Uint8Array>) => parts.push({ section, label, sectionTitle, run });

  if (isSel("callReview")) add("callReview", "Call Review", "Call Review", () => render(inputs.buildCallReviewHtml(), "Call Review"));
  if (isSel("narrativeHistory")) add("narrativeHistory", "Narrative Edit History", "Narrative Edit History", () => render(inputs.buildNarrativeHistoryHtml(), "Narrative Edit History"));
  if (isSel("people")) add("people", "People on Scene", "People on Scene", () => render(buildPeopleHtml(inputs), "People on Scene"));
  if (isSel("animals")) add("animals", "Animals on Scene", "Animals on Scene", () => render(buildAnimalsHtml(inputs), "Animals on Scene"));
  if (isSel("citations")) inputs.citations.forEach((c) => add("citations", `Citation ${c.citation_number}`, "Citations Issued", () => render(buildCitationHTML(c), "Citations Issued")));
  if (isSel("bites")) inputs.biteReports.forEach((b) => add("bites", `Bite Report ${b.report_number || b.id || ""}`.trim(), "Bite Reports", () => render(buildBiteReportHTML(b), "Bite Reports")));
  if (isSel("witnesses")) add("witnesses", "Witness Statements", "Witness Statements", () => render(buildWitnessHtml(inputs.witnessStatements), "Witness Statements"));
  if (isSel("photos")) { const ph = photoEvidence(inputs.call); ph.forEach((e, i) => add("photos", `Photo ${i + 1} of ${ph.length}`, "Photos and Evidence", () => photoPdf(pdfLib, callNumber, e, i + 1, ph.length))); }
  if (isSel("intake")) impoundedAnimals(inputs.animalLinks).forEach((l) => add("intake", `Intake form — ${l.animal?.name || l.animal_id}`, "Animal Intake Forms", async () => {
    if (!l.animal) throw new Error("animal record missing");
    const p = extras.intakePeople[l.animal_id] || {};
    return render(buildIntakeFormHTML(l.animal, { ownerPerson: p.owner || null, finderPerson: p.finder || null }), "Animal Intake Forms");
  }));
  if (isSel("medical")) add("medical", "Medical Records", "Medical Records", () => render(buildMedicalHtml(inputs, extras), "Medical Records"));
  if (isSel("quarantine")) { const q = quarantineRows(inputs); if (q.forms.length + q.bites.length + inputs.animalLinks.filter((l) => l.animal?.status === "Quarantine").length > 0) add("quarantine", "Quarantine Records", "Quarantine Records", () => render(buildQuarantineHtml(inputs), "Quarantine Records")); }
  if (isSel("documents")) { const ds = documentEvidence(inputs.call); ds.forEach((e, i) => add("documents", `Attached document ${i + 1} of ${ds.length}`, "Attached Documents", () => documentPdf(pdfLib, callNumber, e, i + 1, ds.length))); }

  const total = parts.length + 3; // + cover, certification, merge
  let done = 0;
  const tick = (label: string) => onProgress({ done: ++done, total, label });
  onProgress({ done: 0, total, label: "Starting…" });

  const skipped: string[] = [];
  const results: Uint8Array[] = new Array(parts.length);
  let next = 0;
  const worker = async () => {
    while (next < parts.length) {
      if (signal?.aborted) throw new Error("Cancelled");
      const idx = next++;
      const part = parts[idx];
      try {
        results[idx] = await part.run();
      } catch (e) {
        console.error("[court-packet] section failed:", part.sectionTitle, part.label, e);
        skipped.push(`${part.sectionTitle} — record no longer available (${part.label})`);
        results[idx] = await noticePdf(pdfLib, callNumber, part.sectionTitle, part.label);
      }
      tick(part.label);
    }
  };
  await Promise.all([worker(), worker(), worker()]);
  if (signal?.aborted) throw new Error("Cancelled");

  // Group by section and count pages (needed for the table of contents).
  const bodyDocs: Array<{ part: Part; doc: PDFDocument }> = [];
  for (let i = 0; i < parts.length; i++) bodyDocs.push({ part: parts[i], doc: await PDFDocument.load(results[i]) });
  const order: SectionId[] = [];
  for (const b of bodyDocs) if (!order.includes(b.part.section)) order.push(b.part.section);
  const sectionLabel = (id: SectionId) => (defs.find((d) => d.id === id)?.label || id).replace(/\s*\(.*\)\s*$/, "");
  const sectionPages = (id: SectionId) => bodyDocs.filter((b) => b.part.section === id).reduce((s, b) => s + b.doc.getPageCount(), 0);
  const bodyPages = bodyDocs.reduce((s, b) => s + b.doc.getPageCount(), 0);

  // Cover (with TOC). Its own length shifts every page number, so render,
  // measure, and re-render if it wasn't the single page we assumed.
  let coverPages = 1;
  let coverDoc: PDFDocument | null = null;
  const includeCover = isSel("cover");
  let toc: TocEntry[] = [];
  const buildToc = (offset: number) => {
    let p = offset + 1;
    const t: TocEntry[] = [];
    for (const id of order) { t.push({ label: sectionLabel(id), page: p }); p += sectionPages(id); }
    t.push({ label: "Certification of Records", page: p });
    return t;
  };
  if (includeCover) {
    for (let attempt = 0; attempt < 2; attempt++) {
      toc = buildToc(coverPages);
      const bytes = await renderHtml(buildCoverHtml(inputs, user, toc), user.id);
      coverDoc = await PDFDocument.load(bytes);
      if (coverDoc.getPageCount() === coverPages) break;
      coverPages = coverDoc.getPageCount();
    }
  } else {
    coverPages = 0;
    toc = buildToc(0);
  }
  tick("Cover page");

  // Certification: states the final page count, which includes itself.
  let certPages = 1;
  let certDoc: PDFDocument | null = null;
  for (let attempt = 0; attempt < 2; attempt++) {
    const totalPages = coverPages + bodyPages + certPages;
    const bytes = await renderHtml(buildCertificationHtml(inputs, user, totalPages), user.id);
    certDoc = await PDFDocument.load(bytes);
    if (certDoc.getPageCount() === certPages) break;
    certPages = certDoc.getPageCount();
  }
  tick("Certification");

  // Merge → number → stamp footers.
  const merged = await PDFDocument.create();
  const append = async (src: PDFDocument) => { (await merged.copyPages(src, src.getPageIndices())).forEach((p) => merged.addPage(p)); };
  if (coverDoc) await append(coverDoc);
  const sections: PacketSectionResult[] = [];
  let cursor = coverPages + 1;
  for (const id of order) {
    const pages = sectionPages(id);
    sections.push({ id, label: sectionLabel(id), startPage: cursor, pages });
    cursor += pages;
    for (const b of bodyDocs.filter((x) => x.part.section === id)) await append(b.doc);
  }
  await append(certDoc!);

  const pageCount = merged.getPageCount();
  const font = await merged.embedFont(StandardFonts.Helvetica);
  const bold = await merged.embedFont(StandardFonts.HelveticaBold);
  const grey = rgb(0.35, 0.4, 0.47);
  merged.getPages().forEach((page, i) => {
    const { width } = page.getSize();
    page.drawLine({ start: { x: 43, y: 46 }, end: { x: width - 43, y: 46 }, thickness: 0.5, color: rgb(0.8, 0.84, 0.88) });
    page.drawText(safe(callNumber), { x: 43, y: 32, size: 8, font: bold, color: grey });
    const mid = "MCAS Confidential — Law Enforcement Use";
    page.drawText(mid, { x: (width - font.widthOfTextAtSize(mid, 8)) / 2, y: 32, size: 8, font, color: grey });
    const pg = `Page ${i + 1} of ${pageCount}`;
    page.drawText(pg, { x: width - 43 - font.widthOfTextAtSize(pg, 8), y: 32, size: 8, font, color: grey });
  });
  merged.setTitle(`Court Packet ${callNumber}`);
  merged.setAuthor(safe(`${user.first_name || user.firstName || ""} ${user.last_name || user.lastName || ""}`.trim() || user.username));
  merged.setSubject("MCAS Confidential — Law Enforcement Use");
  const bytes = await merged.save();
  tick("Assembling packet");

  return { bytes, pageCount, filename: courtPacketFilename(callNumber), sections, skipped };
}
