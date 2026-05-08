import type { Citation, CourtSettings } from "./types";

export function buildCourtEmailUrl(citation: Citation, settings: CourtSettings): string {
  const courtType = citation.court_type || "Magistrate";
  const recipientEmail = (courtType === "State" || courtType === "Municipal") ? settings.municipal_email : settings.magistrate_email;
  if (!recipientEmail) return "";

  const citNumber = citation.citation_number || "—";
  const dateIssued = citation.date || "—";

  const violatorParts = [
    citation.violator_last,
    citation.violator_first
      ? `${citation.violator_first}${citation.violator_middle ? ` ${citation.violator_middle.charAt(0).toUpperCase()}.` : ""}`
      : "",
  ].filter(Boolean);
  const violatorName = violatorParts.length ? violatorParts.join(", ") : (citation.violator_name || "—");

  const violationLines = (citation.violations || [])
    .map((v) => `  \u2022 \u00a7 ${v.code} \u2014 ${v.description}${v.count > 1 ? ` (\u00d7${v.count})` : ""}`)
    .join("\n");

  const courtDateTime = [
    citation.court_date || "—",
    citation.court_time ? `at ${citation.court_time} ${citation.court_am_pm || ""}`.trim() : "",
  ].filter(Boolean).join(" ");

  const courtLabel = (courtType === "State" || courtType === "Municipal") ? "Morgan County State Court" : "Morgan County Magistrate Court";
  const portalUrl = settings.portal_url || "https://sheltertrace.com/court";

  const subject = `New Citation Issued \u2014 Citation #${citNumber}`;

  const body = [
    "Morgan County Animal Services",
    "2392 Athens Hwy, Madison, GA 30650",
    "",
    "This is to notify the court that a citation has been issued:",
    "",
    `Citation Number: ${citNumber}`,
    `Date Issued: ${dateIssued}`,
    `Violator: ${violatorName}`,
    `Violation(s):`,
    violationLines || "  \u2022 (none listed)",
    `Court Date: ${courtDateTime}`,
    `Court: ${courtLabel}`,
    `Issuing Officer: ${citation.issuing_officer || "\u2014"}, Badge #${citation.badge_number || "\u2014"}`,
    "",
    "Please review the full citation and case details on the ShelterTrace Court Portal at:",
    portalUrl,
    "",
    "Login credentials have been provided separately.",
    "",
    "Morgan County Animal Services",
  ].join("\n");

  return `mailto:${encodeURIComponent(recipientEmail)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

export function openCourtEmail(citation: Citation, settings: CourtSettings): boolean {
  const url = buildCourtEmailUrl(citation, settings);
  if (!url) return false;
  window.location.href = url;
  return true;
}
