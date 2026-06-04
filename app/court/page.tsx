"use client";
import { useState, useEffect, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import AppShell from "@/components/layout/AppShell";
import { fetchCitations, fetchCourtSettings, markCitationNotified, fetchCall, fetchCitationsByPerson, fetchFormsByLinked } from "@/lib/data";
import type { Citation, CourtSettings, ShelterForm } from "@/lib/types";
import { formatDate } from "@/lib/utils";
import { MCAS_SEAL_LOGO } from "@/lib/mcasLogo";
import { MORGAN_COUNTY_ORDINANCES } from "@/lib/constants";
import DispositionModal, { CitationStatusBadge } from "@/app/citations/DispositionModal";
import { openCourtEmail } from "@/lib/courtEmail";

export default function CourtPage() {
  const router = useRouter();
  const [citations, setCitations] = useState<Citation[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [selected, setSelected]     = useState<Citation | null>(null);
  const [dispTarget, setDispTarget] = useState<Citation | null>(null);
  const [courtSettings, setCourtSettings] = useState<CourtSettings>({ magistrate_email: "", municipal_email: "", portal_url: "https://sheltertrace.com/court" });

  const load = useCallback(async () => {
    try {
      const [c, cs] = await Promise.all([fetchCitations(), fetchCourtSettings()]);
      setCitations(c);
      setCourtSettings(cs);
    } catch { } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleNotifyCourt = useCallback(async (cit: Citation) => {
    const courtType = cit.court_type || "Magistrate";
    const email = courtType === "Municipal" ? courtSettings.municipal_email : courtSettings.magistrate_email;
    if (!email) {
      alert(`No ${courtType} Court email configured. Go to Admin → Court Settings.`);
      return;
    }
    const opened = openCourtEmail(cit, courtSettings);
    if (opened) {
      await markCitationNotified(cit.id);
      const updated = { ...cit, court_notified: true, court_notified_at: new Date().toISOString() };
      setCitations((prev) => prev.map((c) => c.id === cit.id ? updated : c));
      setSelected(updated);
    }
  }, [courtSettings]);

  const statuses = ["All", "Issued", "Served", "Active", "Continued", "Guilty", "Not Guilty", "Dismissed", "Paid", "Warrant Issued", "Closed"];

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return citations.filter((c) => {
      const matchStatus = statusFilter === "All" || c.status === statusFilter;
      const matchSearch = !q || c.violator_name?.toLowerCase().includes(q) || c.citation_number?.toLowerCase().includes(q) || c.animal_impound?.toLowerCase().includes(q);
      return matchStatus && matchSearch;
    });
  }, [citations, search, statusFilter]);

  const handleDispositionSaved = (updated: Citation) => {
    setCitations((prev) => prev.map((c) => c.id === updated.id ? updated : c));
    setSelected(updated);
    setDispTarget(null);
  };

  const printWarrant = (cit: Citation) => {
    const w = window.open("", "_blank", "width=900,height=700");
    if (!w) return;
    const photoUrl = (cit as any).photo_id_url as string | undefined;
    w.document.write(`<!DOCTYPE html><html><head><title>Bench Warrant — ${cit.citation_number}</title>
    <style>*{-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important;color-adjust:exact!important;}
      body { font-family: Arial, sans-serif; font-size: 12px; margin: 0; padding: 24px; }
      h2 { font-size: 13px; font-weight: 900; text-transform: uppercase; background: #000; color: #fff; padding: 4px 10px; margin: 16px 0 8px; }
      table { width: 100%; border-collapse: collapse; margin-bottom: 10px; }
      td, th { border: 1px solid #ccc; padding: 5px 8px; vertical-align: top; }
      th { background: #f0f0f0; font-weight: bold; font-size: 11px; text-align: left; width: 35%; }
      .warrant-box { border: 3px solid #000; padding: 16px; margin: 20px 0; text-align: center; }
      @media print { body { padding: 10px; } }
    </style></head><body>
    ${mcasHeader("BENCH WARRANT — FAILURE TO APPEAR")}
    <div class="warrant-box">
      <div style="font-size:22px;font-weight:900;letter-spacing:2px;text-transform:uppercase">BENCH WARRANT</div>
      <div style="font-size:14px;margin-top:6px;font-weight:700">State of Georgia · Morgan County</div>
      <div style="font-size:12px;margin-top:4px;color:#555">Issued for Failure to Appear in Court</div>
    </div>
    <h2>Warrant Information</h2>
    <table>
      <tr><th>Citation #</th><td>${cit.citation_number || "—"}</td></tr>
      <tr><th>Original Court Date</th><td>${cit.court_date || "—"} ${cit.court_time || ""} ${cit.court_am_pm || ""}</td></tr>
      <tr><th>Court</th><td>${cit.court_type || "—"} Court — ${courtAddr(cit)}</td></tr>
      <tr><th>Issuing Judge</th><td>${cit.judge_name || "___________________________"}</td></tr>
      <tr><th>Warrant Date</th><td>${new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}</td></tr>
    </table>
    <h2>Subject Information</h2>
    <table>
      <tr><th>Name</th><td><b>${violatorName(cit)}</b></td></tr>
      <tr><th>Address</th><td>${[cit.violator_address, cit.violator_city, cit.violator_state, cit.violator_zip].filter(Boolean).join(", ") || "—"}</td></tr>
      <tr><th>Phone</th><td>${cit.violator_phone || "—"}</td></tr>
      <tr><th>Date of Birth</th><td>${cit.violator_dob || "—"}</td></tr>
      <tr><th>Driver's License</th><td>${cit.violator_dl || "—"}</td></tr>
      <tr><th>Hair / Eyes</th><td>${cit.desc_hair || "—"} / ${cit.desc_eyes || "—"}</td></tr>
      <tr><th>Height / Weight</th><td>${cit.desc_height || "—"} / ${cit.desc_weight || "—"}</td></tr>
    </table>
    <h2>Original Charges</h2>
    ${renderViolationTable(Array.isArray(cit.violations) ? cit.violations : [])}
    <p style="margin:16px 0;font-size:12px;line-height:1.6">
      The above-named subject was cited for violations of Morgan County Animal Services Chapter 10 Ordinances on
      ${cit.date || "the date shown above"} and was ordered to appear before the ${cit.court_type || ""} Court of Morgan County, Georgia
      on ${cit.court_date || "the scheduled court date"}. Said subject failed to appear as ordered. You are hereby commanded
      to arrest the above-named subject and bring them before the Court without delay.
    </p>
    ${cit.fine_amount ? `<p style="font-size:12px"><b>Outstanding Fine:</b> $${Number(cit.fine_amount).toFixed(2)}</p>` : ""}
    <div style="margin-top:40px;display:flex;gap:60px">
      <div style="width:260px">
        <div style="height:50px;border-bottom:1px solid #000;margin-bottom:6px"></div>
        <div style="font-size:11px">Judge Signature</div>
        <div style="font-size:10px;color:#555;margin-top:2px">${cit.judge_name || "Presiding Judge, Morgan County"}</div>
      </div>
      <div style="width:260px">
        <div style="height:50px;border-bottom:1px solid #000;margin-bottom:6px"></div>
        <div style="font-size:11px">Date</div>
      </div>
    </div>
    ${photoUrl ? `
    <div style="page-break-before:always;padding-top:20px">
      ${mcasHeader("Subject Photo Identification")}
      <div style="text-align:center;margin-top:16px">
        ${photoUrl.toLowerCase().includes(".pdf")
          ? `<a href="${photoUrl}" target="_blank">Open Photo ID Document</a>`
          : `<img src="${photoUrl}" style="max-width:100%;max-height:70vh;border:2px solid #000;border-radius:4px" />`}
      </div>
    </div>` : ""}
    <script>window.onload = function(){ window.print(); }</script>
    </body></html>`);
    w.document.close();
  };

  const pending = citations.filter((c) => ["Issued", "Served", "Active"].includes(c.status || "")).length;
  const resolved = citations.filter((c) => ["Guilty", "Paid", "Closed", "Not Guilty"].includes(c.status || "")).length;

  const mcasHeader = (subtitle: string) => `
    <div style="display:flex;align-items:center;gap:14px;border-bottom:3px solid #000;padding-bottom:10px;margin-bottom:14px">
      <img src="${MCAS_SEAL_LOGO}" alt="MCAS Seal" style="width:80px;height:80px;object-fit:contain;flex-shrink:0" />
      <div style="flex:1">
        <div style="font-size:16px;font-weight:900;text-transform:uppercase;letter-spacing:0.5px">Morgan County Animal Services</div>
        <div style="font-size:11px;margin-top:2px">2392 Athens Hwy, Madison, GA 30650 · State of Georgia</div>
        <div style="font-size:13px;font-weight:700;margin-top:5px;font-style:italic">${subtitle}</div>
      </div>
    </div>`;

  const violatorName = (cit: Citation) => cit.violator_last
    ? [cit.violator_last, (cit.violator_first || "") + (cit.violator_middle ? ` ${cit.violator_middle.charAt(0).toUpperCase()}.` : "")].filter(Boolean).join(", ")
    : (cit.violator_name || "—");

  const courtAddr = (cit: Citation) =>
    cit.court_type === "Magistrate" ? "149 E Jefferson St, Madison, GA 30650" :
    (cit.court_type === "State" || cit.court_type === "Municipal") ? "118 N Main St, Madison, GA 30650" : "—";

  // Table format — matches physical MCAS citation form
  const renderViolationTable = (vios: any[]) => `
    <table>
      <tr>
        <th style="width:60px;text-align:center">Count</th>
        <th style="width:140px">Code Section</th>
        <th>Description</th>
      </tr>
      ${vios.length === 0
        ? "<tr><td colspan='3' style='text-align:center;color:#888'>No violations listed</td></tr>"
        : vios.map((v: any) => {
            const code = v.code || v.code_section || "—";
            const qty  = v.count ?? 1;
            return `<tr>
              <td style="text-align:center;font-weight:bold;font-size:13px">×${qty}</td>
              <td style="font-family:monospace">§ ${code}</td>
              <td>${v.description || "—"}</td>
            </tr>`;
          }).join("")}
    </table>`;

  // Block format with full ordinance text — for case packet
  const renderViolationBlocks = (vios: any[]) =>
    vios.length === 0 ? "<p>No violations listed.</p>" :
    vios.map((v: any, i: number) => {
      const ord  = MORGAN_COUNTY_ORDINANCES.find((o) => o.code === (v.code || v.code_section));
      const code = v.code || v.code_section || "—";
      const title = ord?.title || v.description || "—";
      const desc  = v.description || ord?.description || "—";
      const qty   = v.count ?? 1;
      return `
        <div style="margin-bottom:14px;border:1px solid #000;border-radius:3px;overflow:hidden;page-break-inside:avoid">
          <div style="background:#000;color:#fff;padding:5px 8px;font-weight:bold;font-size:12px">
            Violation ${i + 1}: § ${code} — ${title} <span style="font-weight:400;font-size:11px">(×${qty} count${qty !== 1 ? "s" : ""})</span>
          </div>
          <div style="padding:8px 10px">
            <div style="font-size:11px;margin-bottom:8px"><b>Charge:</b> ${desc}</div>
            ${ord?.fullText ? `<div style="font-size:11px;background:#f5f5f5;border-left:3px solid #555;padding:6px 10px;font-style:italic"><b>Ordinance Text:</b> ${ord.fullText}</div>` : ""}
          </div>
        </div>`;
    }).join("");

  const sigBlock = (cit: Citation) => `
    <div style="margin-top:16px;font-size:10px;font-style:italic">My signature acknowledges service of this Summons. I promise to appear in court on the date and time shown above or properly dispose of this case as provided by law.</div>
    <div style="margin-top:12px;width:260px">
      ${cit.violator_signature
        ? `<img src="${cit.violator_signature}" style="width:200px;height:50px;object-fit:contain;display:block;margin-bottom:4px" />`
        : `<div style="height:50px"></div>`}
      <div style="border-top:1px solid #000;padding-top:4px;font-size:10px">Violator Signature</div>
      ${cit.signed_at ? `<div style="font-size:9px;color:#555">Signed: ${cit.signed_at}</div>` : ""}
    </div>
    <div style="margin-top:20px;padding:10px;border:2px solid #000;text-align:center;font-size:11px">
      Failure to appear in court or properly dispose of this case will result in a <b><u>BENCH WARRANT</u></b> being issued for <b><u>CONTEMPT OF COURT</u></b>.
    </div>
    <div style="margin-top:18px;text-align:center;font-size:12px;font-weight:bold;text-transform:uppercase;letter-spacing:0.5px;border-bottom:2px solid #000;padding-bottom:4px">Officer's Certification</div>
    <div style="margin-top:8px;font-size:10px">I, the undersigned officer, certify that I personally served the above-named violator with a copy of this Citation and Summons on the date and at the location specified above, and that the foregoing is true and correct to the best of my knowledge and belief.</div>
    <div style="margin-top:14px;display:flex;gap:40px;flex-wrap:wrap">
      <div style="width:220px">
        ${cit.officer_signature
          ? `<img src="${cit.officer_signature}" style="width:200px;height:50px;object-fit:contain;display:block;margin-bottom:4px" />`
          : `<div style="height:50px"></div>`}
        <div style="border-top:1px solid #000;padding-top:4px;font-size:10px">Officer Signature</div>
      </div>
      <div style="min-width:160px">
        <div style="font-size:11px;margin-bottom:4px"><b>Badge #:</b> ${cit.badge_number || "___________"}</div>
        <div style="font-size:11px;margin-bottom:4px"><b>Date:</b> ${cit.date || "___________"}</div>
        <div style="font-size:11px;margin-bottom:4px"><b>Time:</b> ${cit.time || "___________"}</div>
        <div style="font-size:11px"><b>Served By:</b> ${cit.served_by || "___________"}</div>
      </div>
    </div>`;

  const printCitation = (cit: Citation) => {
    const w = window.open("", "_blank", "width=900,height=700");
    if (!w) return;
    const vios = Array.isArray(cit.violations) ? cit.violations : [];
    w.document.write(`<!DOCTYPE html><html><head><title>Citation #${cit.citation_number}</title>
    <style>*{-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important;color-adjust:exact!important;}
      body { font-family: Arial, sans-serif; font-size: 12px; margin: 0; padding: 20px; }
      table { width: 100%; border-collapse: collapse; margin-bottom: 12px; }
      td, th { border: 1px solid #000; padding: 4px 6px; vertical-align: top; }
      th { background: #e8e8e8; font-weight: bold; font-size: 11px; }
      .label { font-size: 9px; color: #555; text-transform: uppercase; display: block; }
      .sh { background: #000; color: #fff; font-weight: bold; font-size: 11px; padding: 3px 6px; margin: 10px 0 0; }
      @media print { body { padding: 8px; } }
    </style></head><body>
    ${mcasHeader("Uniform Citation, Summons, Accusation / Warning")}
    <table>
      <tr>
        <td><span class="label">Citation #</span>${cit.citation_number || "—"}</td>
        <td><span class="label">Physical Citation #</span>${cit.physical_cit_number || "—"}</td>
        <td><span class="label">Animal Impound #</span>${cit.animal_impound || "—"}</td>
        <td><span class="label">Date</span>${cit.date || "—"}</td>
        <td><span class="label">Time</span>${cit.time || "—"}</td>
      </tr>
    </table>
    <div class="sh">VIOLATOR INFORMATION</div>
    <table>
      <tr>
        <td colspan="3"><span class="label">Name</span>${violatorName(cit)}</td>
        <td><span class="label">Sex</span>${cit.violator_sex || "—"}</td>
        <td><span class="label">DOB</span>${cit.violator_dob || "—"}</td>
      </tr>
      <tr>
        <td colspan="2"><span class="label">Address</span>${cit.violator_address || "—"}</td>
        <td><span class="label">City</span>${cit.violator_city || "—"}</td>
        <td><span class="label">State</span>${cit.violator_state || "—"}</td>
        <td><span class="label">ZIP</span>${cit.violator_zip || "—"}</td>
      </tr>
      <tr>
        <td><span class="label">Phone</span>${cit.violator_phone || "—"}</td>
        <td><span class="label">Driver's License</span>${cit.violator_dl || "—"}</td>
        <td><span class="label">Hair</span>${cit.desc_hair || "—"}</td>
        <td><span class="label">Eyes</span>${cit.desc_eyes || "—"}</td>
        <td><span class="label">Weight / Height</span>${cit.desc_weight || "—"} / ${cit.desc_height || "—"}</td>
      </tr>
    </table>
    <div class="sh">VIOLATIONS</div>
    <div style="margin-top:6px">${renderViolationTable(vios)}</div>
    ${cit.animal_desc ? `<div class="sh">ANIMAL DESCRIPTION</div><table><tr><td>${cit.animal_desc}</td></tr></table>` : ""}
    <div class="sh">COURT INFORMATION</div>
    <table>
      <tr>
        <td><span class="label">Court</span>${cit.court_type || "—"}</td>
        <td><span class="label">Court Address</span>${courtAddr(cit)}</td>
        <td><span class="label">Date / Time</span>${cit.court_date || "—"} ${cit.court_time || ""} ${cit.court_am_pm || ""}</td>
        <td><span class="label">Fine</span>${cit.fine_amount ? `$${cit.fine_amount}` : "—"}</td>
        <td><span class="label">Due Date</span>${cit.due_date || "—"}</td>
      </tr>
      <tr>
        <td><span class="label">Issuing Officer</span>${cit.issuing_officer || "—"}</td>
        <td><span class="label">Badge #</span>${cit.badge_number || "—"}</td>
        <td><span class="label">Served By</span>${cit.served_by || "—"}</td>
        <td colspan="2"><span class="label">Location</span>${cit.location || "—"}</td>
      </tr>
    </table>
    ${cit.remarks ? `<div class="sh">REMARKS</div><table><tr><td>${cit.remarks}</td></tr></table>` : ""}
    ${sigBlock(cit)}
    <script>window.onload = function(){ window.print(); }</script>
    </body></html>`);
    w.document.close();
  };

  const printCasePacket = async (cit: Citation) => {
    const [call, priorCitsRaw, linkedForms] = await Promise.all([
      cit.call_id ? fetchCall(cit.call_id) : Promise.resolve(null),
      fetchCitationsByPerson(cit.violator_first, cit.violator_last),
      cit.call_id ? fetchFormsByLinked({ callId: cit.call_id }) : Promise.resolve([]),
    ]);
    const priorCits = priorCitsRaw.filter((c) => c.id !== cit.id);
    const vios = Array.isArray(cit.violations) ? cit.violations : [];
    const photoUrl = cit.photo_id_url;
    const vName = violatorName(cit);
    const prepDate = new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
    const narrative = Array.isArray(call?.narrative) ? call!.narrative : [];
    const parties   = Array.isArray(call?.involved_parties) ? call!.involved_parties : [];
    const evidence  = Array.isArray(call?.evidence) ? call!.evidence : [];

    const FORM_LABELS: Record<string, string> = {
      door_knocker: "Door Knocker Notice",
      rabies_quarantine: "Rabies Quarantine Acknowledgement",
      request_for_compliance: "Request for Compliance",
      gda_foster_agreement: "GDA Foster Home Agreement",
      gda_foster_inspection: "GDA Foster Home Inspection",
      gda_animal_inventory: "GDA Animal Inventory",
      adoption_application: "Pet Adoption Application",
    };

    const pgHdr = (section: string) =>
      `<div style="display:flex;justify-content:space-between;border-bottom:1px solid #ccc;margin-bottom:8px;padding-bottom:4px;font-size:9px;color:#555"><span>Citation #${cit.citation_number} — ${vName}</span><span>${section}</span></div>`;

    const label9 = (text: string) => `<span style="font-size:9px;color:#555;text-transform:uppercase;display:block">${text}</span>`;

    const renderParty = (p: any) => {
      const isAnimal = (p.role || "").toLowerCase().includes("animal");
      if (isAnimal) return `
        <div style="margin-bottom:12px;border:1px solid #ccc;border-radius:3px;overflow:hidden;page-break-inside:avoid">
          <div style="background:#333;color:#fff;padding:4px 10px;font-size:11px;font-weight:bold">${p.role || "Animal"}</div>
          <table>
            <tr><th>Species / Breed</th><td>${[p.species, p.breed].filter(Boolean).join(" / ") || "—"}</td></tr>
            <tr><th>Description</th><td>${p.desc || p.color || "—"}</td></tr>
            ${p.condition ? `<tr><th>Condition</th><td>${p.condition}</td></tr>` : ""}
            ${p.injuries ? `<tr><th>Injuries</th><td>${p.injuries}</td></tr>` : ""}
            ${p.behavior ? `<tr><th>Behavior</th><td>${p.behavior}</td></tr>` : ""}
            ${p.dangerous ? `<tr><th>Dangerous</th><td><b style="color:#dc2626">⚠ DANGEROUS ANIMAL</b></td></tr>` : ""}
          </table>
        </div>`;
      return `
        <div style="margin-bottom:12px;border:1px solid #ccc;border-radius:3px;overflow:hidden;page-break-inside:avoid">
          <div style="background:#333;color:#fff;padding:4px 10px;font-size:11px;font-weight:bold">${p.role || "Party"}</div>
          <table>
            ${p.name    ? `<tr><th>Name</th><td>${p.name}</td></tr>` : ""}
            ${p.phone   ? `<tr><th>Phone</th><td>${p.phone}</td></tr>` : ""}
            ${p.address ? `<tr><th>Address</th><td>${p.address}</td></tr>` : ""}
            ${p.statement ? `<tr><th>Statement</th><td style="font-style:italic">"${p.statement}"</td></tr>` : ""}
          </table>
        </div>`;
    };

    const renderFormSummary = (f: ShelterForm) => {
      const d = f.form_data as Record<string, unknown>;
      const fLabel = FORM_LABELS[f.form_type] || f.form_type;
      const fDate = f.created_at ? new Date(f.created_at).toLocaleDateString() : "—";
      let details = "";
      if (f.form_type === "request_for_compliance") {
        details = `<tr><th>Violations</th><td>${(d.violations as string[])?.join(", ") || "—"}</td></tr>
          <tr><th>Deadline</th><td>${d.deadline || "—"}</td></tr>
          ${d.officer_notes ? `<tr><th>Officer Notes</th><td>${d.officer_notes}</td></tr>` : ""}`;
      } else if (f.form_type === "door_knocker") {
        details = `<tr><th>Reason for Visit</th><td>${d.reason || "—"}</td></tr>
          <tr><th>Action Required</th><td>${d.action_required || "—"}</td></tr>`;
      } else if (f.form_type === "rabies_quarantine") {
        details = `<tr><th>Animal</th><td>${d.animal_name || "—"} (${d.animal_species || "—"})</td></tr>
          <tr><th>Quarantine End</th><td>${d.quarantine_end || "—"}</td></tr>`;
      }
      return `
        <div style="margin-bottom:14px;border:1px solid #ccc;border-radius:3px;overflow:hidden;page-break-inside:avoid">
          <div style="background:#333;color:#fff;padding:5px 10px;font-weight:bold;font-size:11px">${fLabel}</div>
          <table>
            <tr><th>Date</th><td>${fDate}</td></tr>
            <tr><th>Officer</th><td>${f.officer || f.created_by || "—"}</td></tr>
            ${details}
          </table>
        </div>`;
    };

    const w = window.open("", "_blank", "width=900,height=700");
    if (!w) return;

    w.document.write(`<!DOCTYPE html><html><head><title>Case Packet — ${cit.citation_number}</title>
    <style>*{-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important;color-adjust:exact!important;}
      * { box-sizing: border-box; }
      body { font-family: Arial, sans-serif; font-size: 12px; margin: 0; padding: 0; }
      .page { padding: 24px; }
      .pb  { page-break-before: always; }
      h2   { font-size: 13px; font-weight: 900; text-transform: uppercase; letter-spacing: 0.5px;
             background: #000; color: #fff; padding: 4px 10px; margin: 16px 0 8px; }
      table { width: 100%; border-collapse: collapse; margin-bottom: 10px; }
      td, th { border: 1px solid #ccc; padding: 5px 8px; vertical-align: top; }
      th { background: #f0f0f0; font-weight: bold; font-size: 11px; text-align: left; width: 35%; }
      .two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
      @media print {
        .page { padding: 12px; }
        @page { margin: 10mm 12mm; @bottom-right { content: "Page " counter(page); font-size: 9px; font-family: Arial; } }
      }
    </style></head><body>

    <!-- ══════════════════════════════════════════════════════════════
         PAGE 1 — COVER
    ══════════════════════════════════════════════════════════════ -->
    <div class="page">
      ${mcasHeader("Court Case Packet")}
      <div style="text-align:center;margin:28px 0 22px">
        <div style="font-size:26px;font-weight:900;letter-spacing:3px;text-transform:uppercase;border:3px solid #000;display:inline-block;padding:10px 28px">COURT CASE PACKET</div>
        <div style="font-size:12px;margin-top:8px;color:#555">State of Georgia · Morgan County Animal Services</div>
      </div>
      <table style="max-width:520px;margin:0 auto 20px">
        <tr><th>Citation #</th><td><b style="font-size:13px">${cit.citation_number || "—"}</b></td></tr>
        ${cit.call_id ? `<tr><th>Call / Case #</th><td>${cit.call_id}</td></tr>` : ""}
        ${cit.animal_impound ? `<tr><th>Animal Impound #</th><td>${cit.animal_impound}</td></tr>` : ""}
        <tr><th>Violator</th><td><b>${vName}</b></td></tr>
        <tr><th>Court</th><td>${cit.court_type || "—"} Court — ${courtAddr(cit)}</td></tr>
        <tr><th>Court Date / Time</th><td>${cit.court_date || "—"} ${cit.court_time || ""} ${cit.court_am_pm || ""}</td></tr>
        <tr><th>Current Status</th><td>${cit.status || "Issued"}</td></tr>
        <tr><th>Issuing Officer</th><td>${cit.issuing_officer || "—"} — Badge #${cit.badge_number || "—"}</td></tr>
        <tr><th>Date Prepared</th><td>${prepDate}</td></tr>
      </table>
      <div style="text-align:center;margin-top:32px;padding:10px 20px;border:2px solid #000;font-size:11px;font-weight:bold;text-transform:uppercase;letter-spacing:1px">
        CONFIDENTIAL — LAW ENFORCEMENT DOCUMENT — FOR AUTHORIZED COURT USE ONLY
      </div>
    </div>

    <!-- ══════════════════════════════════════════════════════════════
         PAGE 2 — FULL CITATION
    ══════════════════════════════════════════════════════════════ -->
    <div class="page pb">
      ${pgHdr("FULL CITATION")}
      ${mcasHeader("Uniform Citation, Summons, Accusation / Warning")}
      <table>
        <tr>
          <td>${label9("Citation #")}${cit.citation_number || "—"}</td>
          <td>${label9("Physical Citation #")}${cit.physical_cit_number || "—"}</td>
          <td>${label9("Animal Impound #")}${cit.animal_impound || "—"}</td>
          <td>${label9("Date")}${cit.date || "—"}</td>
          <td>${label9("Time")}${cit.time || "—"}</td>
        </tr>
      </table>
      <h2>VIOLATOR INFORMATION</h2>
      <table>
        <tr>
          <td colspan="3">${label9("Name")}${vName}</td>
          <td>${label9("Sex")}${cit.violator_sex || "—"}</td>
          <td>${label9("DOB")}${cit.violator_dob || "—"}</td>
        </tr>
        <tr>
          <td colspan="2">${label9("Address")}${cit.violator_address || "—"}</td>
          <td>${label9("City")}${cit.violator_city || "—"}</td>
          <td>${label9("State")}${cit.violator_state || "—"}</td>
          <td>${label9("ZIP")}${cit.violator_zip || "—"}</td>
        </tr>
        <tr>
          <td>${label9("Phone")}${cit.violator_phone || "—"}</td>
          <td>${label9("Driver's License")}${cit.violator_dl || "—"}</td>
          <td>${label9("Hair")}${cit.desc_hair || "—"}</td>
          <td>${label9("Eyes")}${cit.desc_eyes || "—"}</td>
          <td>${label9("Weight / Height")}${cit.desc_weight || "—"} / ${cit.desc_height || "—"}</td>
        </tr>
      </table>
      <h2>VIOLATIONS</h2>
      ${renderViolationTable(vios)}
      ${cit.animal_desc ? `<h2>ANIMAL DESCRIPTION</h2><table><tr><td>${cit.animal_desc}</td></tr></table>` : ""}
      <h2>COURT INFORMATION</h2>
      <table>
        <tr>
          <td>${label9("Court")}${cit.court_type || "—"}</td>
          <td>${label9("Court Address")}${courtAddr(cit)}</td>
          <td>${label9("Date / Time")}${cit.court_date || "—"} ${cit.court_time || ""} ${cit.court_am_pm || ""}</td>
          <td>${label9("Fine")}${cit.fine_amount ? `$${cit.fine_amount}` : "—"}</td>
          <td>${label9("Due Date")}${cit.due_date || "—"}</td>
        </tr>
        <tr>
          <td>${label9("Issuing Officer")}${cit.issuing_officer || "—"}</td>
          <td>${label9("Badge #")}${cit.badge_number || "—"}</td>
          <td>${label9("Served By")}${cit.served_by || "—"}</td>
          <td colspan="2">${label9("Location")}${cit.location || "—"}</td>
        </tr>
      </table>
      ${cit.remarks ? `<h2>REMARKS</h2><table><tr><td>${cit.remarks}</td></tr></table>` : ""}
      ${sigBlock(cit)}
    </div>

    <!-- ══════════════════════════════════════════════════════════════
         PAGE 3 — ORDINANCE REFERENCE
    ══════════════════════════════════════════════════════════════ -->
    ${vios.length > 0 ? `
    <div class="page pb">
      ${pgHdr("ORDINANCE REFERENCE")}
      ${mcasHeader("Ordinance Reference — Violated Code Sections")}
      <p style="font-size:10px;font-style:italic;margin-bottom:12px">Full text of each ordinance section charged in this citation.</p>
      ${renderViolationBlocks(vios)}
    </div>` : ""}

    <!-- ══════════════════════════════════════════════════════════════
         PAGE 4 — VIOLATOR INFORMATION
    ══════════════════════════════════════════════════════════════ -->
    <div class="page pb">
      ${pgHdr("VIOLATOR INFORMATION")}
      ${mcasHeader("Violator Information")}
      ${photoUrl ? `
      <div style="float:right;margin:0 0 16px 20px;text-align:center">
        ${photoUrl.toLowerCase().includes(".pdf")
          ? `<div style="padding:10px;border:1px solid #ccc;font-size:11px">📄 <a href="${photoUrl}" target="_blank">Photo ID (PDF)</a></div>`
          : `<img src="${photoUrl}" style="max-width:200px;border:2px solid #000;border-radius:4px;display:block" />`}
        <div style="font-size:9px;color:#555;margin-top:4px">Violator Photo ID on File</div>
      </div>` : ""}
      <div class="two-col">
        <table>
          <tr><th>Full Name</th><td><b>${vName}</b></td></tr>
          <tr><th>Address</th><td>${[cit.violator_address, cit.violator_city, cit.violator_state, cit.violator_zip].filter(Boolean).join(", ") || "—"}</td></tr>
          <tr><th>Phone</th><td>${cit.violator_phone || "—"}</td></tr>
          ${cit.violator_email ? `<tr><th>Email</th><td>${cit.violator_email}</td></tr>` : ""}
          <tr><th>Driver's License</th><td>${cit.violator_dl || "—"}</td></tr>
          <tr><th>Date of Birth</th><td>${cit.violator_dob || "—"}</td></tr>
          <tr><th>Sex</th><td>${cit.violator_sex || "—"}</td></tr>
        </table>
        <table>
          <tr><th>Hair Color</th><td>${cit.desc_hair || "—"}</td></tr>
          <tr><th>Eye Color</th><td>${cit.desc_eyes || "—"}</td></tr>
          <tr><th>Weight</th><td>${cit.desc_weight || "—"}</td></tr>
          <tr><th>Height</th><td>${cit.desc_height || "—"}</td></tr>
        </table>
      </div>
      <div style="clear:both"></div>
      <h2>PRIOR CITATIONS${priorCits.length > 0 ? ` (${priorCits.length})` : ""}</h2>
      ${priorCits.length > 0 ? `
      <table>
        <tr>
          <th style="width:120px">Citation #</th>
          <th style="width:90px">Date</th>
          <th>Violations</th>
          <th style="width:100px">Status</th>
          <th style="width:80px">Fine</th>
        </tr>
        ${priorCits.map((pc) => `
          <tr>
            <td style="font-family:monospace">${pc.citation_number || "—"}</td>
            <td>${pc.date || "—"}</td>
            <td style="font-size:11px">${(pc.violations || []).map((v: any) => `§ ${v.code || v.code_section || "—"}`).join(", ") || pc.violation_desc || "—"}</td>
            <td>${pc.status || "—"}</td>
            <td>${pc.fine_amount ? `$${pc.fine_amount}` : "—"}</td>
          </tr>`).join("")}
      </table>` : `<p style="font-size:11px;font-style:italic;color:#555">No prior citations found for this violator.</p>`}
    </div>

    ${call ? `
    <!-- ══════════════════════════════════════════════════════════════
         PAGE 5 — DISPATCH CALL DETAILS
    ══════════════════════════════════════════════════════════════ -->
    <div class="page pb">
      ${pgHdr("DISPATCH CALL DETAILS")}
      ${mcasHeader(`Dispatch Call Record — ${call.id}`)}
      <div class="two-col">
        <table>
          <tr><th>Call Number</th><td><b>${call.id}</b></td></tr>
          <tr><th>Call Type</th><td>${call.type || "—"}</td></tr>
          <tr><th>Priority</th><td>${call.priority || "—"}</td></tr>
          <tr><th>Status</th><td>${call.status || "—"}</td></tr>
          <tr><th>Date Reported</th><td>${call.date_reported || call.created_at?.split("T")[0] || "—"}</td></tr>
          <tr><th>Time Reported</th><td>${call.time_reported || (call.created_at ? call.created_at.split("T")[1]?.substring(0, 5) : "") || "—"}</td></tr>
        </table>
        <table>
          <tr><th>Location</th><td>${[call.address, call.city].filter(Boolean).join(", ") || "—"}</td></tr>
          <tr><th>Caller Name</th><td>${call.caller || "—"}</td></tr>
          <tr><th>Caller Phone</th><td>${call.caller_phone || "—"}</td></tr>
          ${call.animal_involved ? `<tr><th>Animal Involved</th><td>Yes${call.animal_description ? ` — ${call.animal_description}` : ""}</td></tr>` : ""}
          <tr><th>Assigned Officers</th><td>${(call.assigned_officers || []).map((o: any) => `${o.name} (Badge #${o.badge || "—"})`).join("<br>") || "—"}</td></tr>
        </table>
      </div>
      ${call.description ? `<h2>INCIDENT DESCRIPTION</h2><div style="padding:8px;border:1px solid #ccc;font-size:11px;line-height:1.5">${call.description}</div>` : ""}
      ${call.response_notes ? `<h2>RESPONSE NOTES</h2><div style="padding:8px;border:1px solid #ccc;font-size:11px;line-height:1.5">${call.response_notes}</div>` : ""}
    </div>

    ${narrative.length > 0 ? `
    <!-- ══════════════════════════════════════════════════════════════
         PAGE 6 — OFFICER'S NARRATIVE
    ══════════════════════════════════════════════════════════════ -->
    <div class="page pb">
      ${pgHdr("OFFICER'S NARRATIVE")}
      ${mcasHeader("Officer's Narrative")}
      <p style="font-size:10px;font-style:italic;margin-bottom:14px">Chronological account of events as recorded by responding officers. All times are local.</p>
      ${narrative.map((entry: any) => `
        <div style="margin-bottom:16px;border-left:4px solid #000;padding:4px 4px 4px 12px;page-break-inside:avoid">
          <div style="font-weight:bold;font-size:11px;margin-bottom:4px">${entry.time || "—"} — ${entry.officer || "Unknown Officer"}</div>
          <div style="font-size:12px;line-height:1.6">${entry.text || "—"}</div>
        </div>`).join("")}
    </div>` : ""}

    ${parties.length > 0 ? `
    <!-- ══════════════════════════════════════════════════════════════
         PAGE 7 — INVOLVED PARTIES
    ══════════════════════════════════════════════════════════════ -->
    <div class="page pb">
      ${pgHdr("INVOLVED PARTIES")}
      ${mcasHeader("Involved Parties")}
      ${parties.map((p: any) => renderParty(p)).join("")}
    </div>` : ""}

    ${evidence.length > 0 ? `
    <!-- ══════════════════════════════════════════════════════════════
         PAGE 8 — EVIDENCE
    ══════════════════════════════════════════════════════════════ -->
    <div class="page pb">
      ${pgHdr("EVIDENCE")}
      ${mcasHeader("Evidence Log")}
      <p style="font-size:10px;font-style:italic;margin-bottom:12px">${evidence.length} item${evidence.length !== 1 ? "s" : ""} logged for Call ${call.id}.</p>
      ${evidence.map((ev: any, i: number) => {
        const fileUrl = ev.url || ev.file_url;
        const isImage = ev.file_type?.startsWith("image/") || /\.(jpg|jpeg|png|gif|webp)$/i.test(fileUrl || ev.file_name || "");
        return `
          <div style="margin-bottom:16px;border:1px solid #ccc;border-radius:3px;overflow:hidden;page-break-inside:avoid">
            <div style="background:#333;color:#fff;padding:5px 10px;font-weight:bold;font-size:11px">
              Evidence ${i + 1} — ${ev.type || "Item"}: ${ev.description || "Untitled"}
            </div>
            <div style="padding:8px 10px">
              <div style="font-size:11px;margin-bottom:4px"><b>Date:</b> ${ev.date || "—"}</div>
              ${ev.file_name ? `<div style="font-size:11px;margin-bottom:4px"><b>File:</b> ${ev.file_name}</div>` : ""}
              ${ev.notes ? `<div style="font-size:11px;margin-bottom:8px;font-style:italic">${ev.notes}</div>` : ""}
              ${isImage && fileUrl ? `<div style="margin-top:8px"><img src="${fileUrl}" style="max-width:100%;max-height:420px;border:1px solid #ccc;border-radius:3px" /></div>` : ""}
              ${!isImage && fileUrl ? `<div style="margin-top:6px;font-size:10px"><a href="${fileUrl}" target="_blank">View / Download File</a></div>` : ""}
            </div>
          </div>`;
      }).join("")}
    </div>` : ""}
    ` : ""}

    ${linkedForms.length > 0 ? `
    <!-- ══════════════════════════════════════════════════════════════
         PAGE 9 — FORMS & DOCUMENTS
    ══════════════════════════════════════════════════════════════ -->
    <div class="page pb">
      ${pgHdr("FORMS & DOCUMENTS")}
      ${mcasHeader("Related Forms & Documents")}
      <p style="font-size:10px;font-style:italic;margin-bottom:12px">Official MCAS forms associated with this case, included for the court's reference.</p>
      ${linkedForms.map((f: ShelterForm) => renderFormSummary(f)).join("")}
    </div>` : ""}

    ${(cit.disposition_history || []).length > 0 ? `
    <!-- ══════════════════════════════════════════════════════════════
         PAGE 10 — DISPOSITION HISTORY
    ══════════════════════════════════════════════════════════════ -->
    <div class="page pb">
      ${pgHdr("DISPOSITION HISTORY")}
      ${mcasHeader("Disposition History")}
      <table>
        <tr>
          <th style="width:100px">Date</th>
          <th style="width:130px">Status</th>
          <th>Notes / Details</th>
          <th style="width:110px">Changed By</th>
        </tr>
        ${(cit.disposition_history || []).map((d: any) => `
          <tr>
            <td>${d.date || "—"}</td>
            <td><b>${d.status || "—"}</b></td>
            <td style="font-size:11px">${[
              d.notes,
              d.newCourtDate ? `New court date: ${d.newCourtDate}` : "",
              d.fineAmount   ? `Fine: $${d.fineAmount}` : "",
              d.amountPaid   ? `Paid: $${d.amountPaid}` : "",
              d.paymentMethod ? `Via ${d.paymentMethod}` : "",
              d.judgeName    ? `Judge: ${d.judgeName}` : "",
              d.dismissedReason ? `Reason: ${d.dismissedReason}` : "",
              d.communityServiceHours ? `Community service: ${d.communityServiceHours} hrs` : "",
            ].filter(Boolean).join(" · ") || "—"}</td>
            <td style="font-size:11px">${d.changedBy || "—"}</td>
          </tr>`).join("")}
      </table>
    </div>` : ""}

    <script>window.onload = function(){ window.print(); }</script>
    </body></html>`);
    w.document.close();
  };

  return (
    <>
    <AppShell title="Court Portal">
      {/* Stats */}
      <div className="grid-4" style={{ marginBottom: 16 }}>
        {[
          { label: "Total Citations", value: citations.length, color: "#6366f1", icon: "📋" },
          { label: "Pending / Issued", value: pending, color: "#f59e0b", icon: "⏳" },
          { label: "Resolved", value: resolved, color: "#22c55e", icon: "✅" },
          { label: "Dismissed", value: citations.filter((c) => c.status === "Dismissed").length, color: "#64748b", icon: "❌" },
        ].map(({ label, value, color, icon }) => (
          <div key={label} className="stat-card">
            <div className="stat-icon" style={{ background: `${color}20` }}><span style={{ fontSize: 20 }}>{icon}</span></div>
            <div><div className="stat-value" style={{ color }}>{value}</div><div className="stat-label">{label}</div></div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div style={{ display: "flex", gap: 10, marginBottom: 12, flexWrap: "wrap", alignItems: "center" }}>
        <input className="form-input" style={{ maxWidth: 280 }} placeholder="Search by name, citation #, impound #…" value={search} onChange={(e) => setSearch(e.target.value)} />
        <div style={{ display: "flex", gap: 6 }}>
          {statuses.map((s) => (
            <button key={s} className={`btn btn-sm ${statusFilter === s ? "btn-primary" : "btn-secondary"}`} onClick={() => setStatusFilter(s)}>{s}</button>
          ))}
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: selected ? "1fr 380px" : "1fr", gap: 16 }}>
        {/* Citations Table */}
        <div className="card" style={{ padding: 0, overflow: "hidden" }}>
          <table className="data-table">
            <thead>
              <tr><th>Citation #</th><th>Date</th><th>Violator</th><th>Violations</th><th>Court Date</th><th>Fine</th><th>Status</th></tr>
            </thead>
            <tbody>
              {loading ? <tr><td colSpan={7} className="empty-state">Loading…</td></tr>
                : filtered.length === 0 ? <tr><td colSpan={7} className="empty-state">No citations found</td></tr>
                : filtered.map((c) => {
                  const vios = Array.isArray(c.violations) ? c.violations : [];
                  return (
                    <tr key={c.id} onClick={() => setSelected(selected?.id === c.id ? null : c)} style={{ background: selected?.id === c.id ? "#f0fdfa" : undefined }}>
                      <td style={{ fontFamily: "monospace", fontSize: 11, fontWeight: 700 }}>{c.citation_number || "—"}</td>
                      <td style={{ fontSize: 12 }}>{c.date ? formatDate(c.date) : "—"}</td>
                      <td style={{ fontWeight: 600 }}>{c.violator_name || "—"}</td>
                      <td style={{ fontSize: 12 }}>{vios.length} violation{vios.length !== 1 ? "s" : ""}</td>
                      <td style={{ fontSize: 12 }}>{c.court_date ? formatDate(c.court_date) : "—"}</td>
                      <td style={{ fontSize: 12 }}>{c.fine_amount ? `$${Number(c.fine_amount).toFixed(2)}` : "—"}</td>
                      <td><CitationStatusBadge status={c.status || "Issued"} /></td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>

        {/* Case Detail Panel */}
        {selected && (
          <div className="card" style={{ padding: 16, position: "sticky", top: 16, maxHeight: "80vh", overflowY: "auto" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14 }}>
              <div>
                <div style={{ fontWeight: 800, fontSize: 16 }}>Citation #{selected.citation_number}</div>
                <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 2 }}>{selected.date} · {selected.court_type || "No court assigned"}</div>
              </div>
              <button className="btn btn-ghost btn-sm" onClick={() => setSelected(null)}>✕</button>
            </div>

            {/* Action buttons */}
            <div style={{ display: "flex", gap: 6, marginBottom: 8, flexWrap: "wrap" }}>
              <button className="btn btn-primary btn-sm" style={{ flex: 1 }} onClick={() => setDispTarget(selected)}>⚖️ Update Disposition</button>
              {selected.status === "Warrant Issued" && (
                <button className="btn btn-danger btn-sm" style={{ flex: 1 }} onClick={() => printWarrant(selected)}>🚨 Print Warrant</button>
              )}
            </div>
            <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
              <button className="btn btn-secondary btn-sm" style={{ flex: 1 }} onClick={() => printCitation(selected)}>🖨 Print Citation</button>
              <button className="btn btn-secondary btn-sm" style={{ flex: 1 }} onClick={() => { printCasePacket(selected); }}>📄 Case Packet</button>
            </div>
            <div style={{ marginBottom: 14 }}>
              <button
                className="btn btn-sm"
                style={{ width: "100%", background: selected.court_notified ? "#f1f5f9" : "#eff6ff", color: selected.court_notified ? "#64748b" : "#1d4ed8", border: `1px solid ${selected.court_notified ? "#e2e8f0" : "#bfdbfe"}` }}
                onClick={() => handleNotifyCourt(selected)}
                title={selected.court_notified_at ? `Last notified: ${new Date(selected.court_notified_at).toLocaleString()}` : "Send court notification email"}
              >
                {selected.court_notified ? "✉ Re-send Court Notification" : "📧 Notify Court"}
              </button>
              {selected.court_notified && selected.court_notified_at && (
                <div style={{ fontSize: 10, color: "var(--text-muted)", textAlign: "center", marginTop: 3 }}>
                  Notified {new Date(selected.court_notified_at).toLocaleDateString()}
                </div>
              )}
            </div>

            {/* Status */}
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12, padding: "6px 10px", background: "var(--surface-alt)", borderRadius: 6 }}>
              <span style={{ fontSize: 12, color: "var(--text-secondary)", fontWeight: 600 }}>Status:</span>
              <CitationStatusBadge status={selected.status || "Issued"} />
              {selected.judge_name && <span style={{ fontSize: 11, color: "var(--text-muted)", marginLeft: "auto" }}>Judge: {selected.judge_name}</span>}
            </div>

            {/* Key info rows */}
            {[
              ["Violator", violatorName(selected)],
              ["Address", [selected.violator_address, selected.violator_city, selected.violator_state].filter(Boolean).join(", ") || "—"],
              ["Phone", selected.violator_phone || "—"],
              ["DL", selected.violator_dl || "—"],
              ["Animal Impound #", selected.animal_impound || "—"],
              ["Issuing Officer", `${selected.issuing_officer || "—"} · Badge #${selected.badge_number || "—"}`],
              ["Court Date/Time", `${selected.court_date ? formatDate(selected.court_date) : "—"} ${selected.court_time || ""} ${(selected as any).court_am_pm || ""}`.trim()],
              ["Fine", selected.fine_amount ? `$${Number(selected.fine_amount).toFixed(2)}` : "—"],
              ...(selected.fine_paid ? [["Paid", `$${selected.fine_paid} · ${selected.payment_method_used || ""}`]] : []),
              ...(selected.dismissed_reason ? [["Dismissed Reason", selected.dismissed_reason]] : []),
              ...(selected.community_service_hours ? [["Community Service", `${selected.community_service_hours} hrs`]] : []),
            ].map(([label, value]) => (
              <div key={label} style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", borderBottom: "1px solid var(--border-light)", fontSize: 13, gap: 8 }}>
                <span style={{ color: "var(--text-secondary)", fontWeight: 600, whiteSpace: "nowrap" }}>{label}</span>
                <span style={{ textAlign: "right", fontSize: 12 }}>{value}</span>
              </div>
            ))}

            {/* Violations */}
            {Array.isArray(selected.violations) && selected.violations.length > 0 && (
              <div style={{ marginTop: 12 }}>
                <div style={{ fontWeight: 700, fontSize: 11, textTransform: "uppercase", color: "var(--text-secondary)", marginBottom: 6 }}>Violations</div>
                {(selected.violations as any[]).map((v, i) => (
                  <div key={i} style={{ background: "var(--surface-alt)", border: "1px solid var(--border-light)", borderRadius: 6, padding: "6px 10px", marginBottom: 4 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-secondary)" }}>Violation {i + 1} — § {v.code || v.code_section || "—"}</div>
                      <div style={{ fontSize: 12, fontWeight: 800, color: "var(--teal)" }}>×{v.count ?? 1}</div>
                    </div>
                    <div style={{ fontSize: 13 }}>{v.description}</div>
                  </div>
                ))}
              </div>
            )}

            {/* Disposition History */}
            {Array.isArray(selected.disposition_history) && selected.disposition_history.length > 0 && (
              <div style={{ marginTop: 14 }}>
                <div style={{ fontWeight: 700, fontSize: 11, textTransform: "uppercase", color: "var(--text-secondary)", marginBottom: 8 }}>Disposition History</div>
                <div style={{ position: "relative", paddingLeft: 16 }}>
                  <div style={{ position: "absolute", left: 6, top: 0, bottom: 0, width: 2, background: "var(--border)" }} />
                  {([...selected.disposition_history]).reverse().map((entry, i) => (
                    <div key={i} style={{ marginBottom: 10, position: "relative" }}>
                      <div style={{ position: "absolute", left: -14, top: 4, width: 10, height: 10, borderRadius: "50%", background: "var(--teal)", border: "2px solid var(--surface)" }} />
                      <div style={{ background: "var(--surface-alt)", border: "1px solid var(--border-light)", borderRadius: 6, padding: "6px 10px" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 2 }}>
                          <CitationStatusBadge status={entry.status} />
                          <span style={{ fontSize: 10, color: "var(--text-muted)" }}>{entry.date}</span>
                        </div>
                        {entry.judgeName && <div style={{ fontSize: 11, color: "var(--text-secondary)" }}>Judge: {entry.judgeName}</div>}
                        {entry.fineAmount && <div style={{ fontSize: 11, color: "var(--text-secondary)" }}>Fine: ${entry.fineAmount}</div>}
                        {entry.amountPaid && <div style={{ fontSize: 11, color: "#15803d" }}>Paid: ${entry.amountPaid} · {entry.paymentMethod}</div>}
                        {entry.dismissedReason && <div style={{ fontSize: 11, color: "var(--text-secondary)" }}>Reason: {entry.dismissedReason}</div>}
                        {entry.newCourtDate && <div style={{ fontSize: 11, color: "var(--text-secondary)" }}>Rescheduled: {entry.newCourtDate}</div>}
                        {entry.communityServiceHours && <div style={{ fontSize: 11, color: "var(--text-secondary)" }}>Community Service: {entry.communityServiceHours} hrs</div>}
                        {entry.notes && <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2, fontStyle: "italic" }}>{entry.notes}</div>}
                        {entry.changedBy && <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 2 }}>By {entry.changedBy}</div>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {selected.remarks && (
              <div style={{ marginTop: 12 }}>
                <div style={{ fontWeight: 700, fontSize: 11, textTransform: "uppercase", color: "var(--text-secondary)", marginBottom: 4 }}>Remarks</div>
                <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>{selected.remarks}</div>
              </div>
            )}
          </div>
        )}
      </div>
    </AppShell>
    {dispTarget && (
      <DispositionModal
        citation={dispTarget}
        onSave={handleDispositionSaved}
        onClose={() => setDispTarget(null)}
      />
    )}
    </>
  );
}
