import { NextRequest, NextResponse } from "next/server";
import { extractText } from "unpdf";

interface ParsedResult {
  animal_name: string;
  species: string;
  result_date: string;
  result_time: string;
  test_name: string;
  raw_result: string;
  mapped_result: "Positive" | "Negative" | "Inconclusive" | "Pending";
  mapped_type: string;
  source: string;
}

const TEST_NAME_MAP: Record<string, string> = {
  "heartworm antigen":  "Heartworm Test",
  "heartworm ag":       "Heartworm Test",
  "hw antigen":         "Heartworm Test",
  "fiv antibody":       "FIV Test",
  "fiv ab":             "FIV Test",
  "felv antigen":       "FeLV Test",
  "felv ag":            "FeLV Test",
  "fiv ab/felv ag":     "FIV/FeLV Combo Test",
  "fiv antibody/felv antigen": "FIV/FeLV Combo Test",
  "cpv antigen":        "Parvo Test",
  "parvovirus":         "Parvo Test",
  "parvo ag":           "Parvo Test",
  "ehrlichia":          "Ehrlichia Test",
  "ehrlichia canis":    "Ehrlichia Test",
  "lyme":               "Lyme Test",
  "borrelia burgdorferi": "Lyme Test",
  "anaplasma":          "Anaplasma Test",
  "anaplasma phagocytophilum": "Anaplasma Test",
};

function mapTestName(raw: string): string {
  return TEST_NAME_MAP[raw.trim().toLowerCase()] || raw.trim();
}

function mapResult(raw: string): { mapped: ParsedResult["mapped_result"]; qualifier: string } {
  const v = raw.trim().toLowerCase();
  if (v === "negative" || v === "neg") return { mapped: "Negative", qualifier: "" };
  if (v === "positive" || v === "pos") return { mapped: "Positive", qualifier: "" };
  if (v === "strongpositive" || v === "strong positive") return { mapped: "Positive", qualifier: "StrongPositive" };
  if (v === "weakpositive" || v === "weak positive") return { mapped: "Positive", qualifier: "WeakPositive" };
  if (v === "inconclusive" || v === "inc") return { mapped: "Inconclusive", qualifier: "" };
  if (v === "invalid") return { mapped: "Inconclusive", qualifier: "Invalid" };
  if (v === "pending" || v === "") return { mapped: "Pending", qualifier: "" };
  return { mapped: "Pending", qualifier: raw.trim() };
}

function parseDateStr(d: string): string {
  const m = d.match(/(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
  if (!m) return d;
  const year = m[3].length === 2 ? `20${m[3]}` : m[3];
  return `${year}-${m[1].padStart(2, "0")}-${m[2].padStart(2, "0")}`;
}

function parsePage(pageText: string): ParsedResult[] {
  const results: ParsedResult[] = [];
  const lines = pageText.split("\n").map((l) => l.trim()).filter(Boolean);

  let animalName = "";
  for (const line of lines) {
    if (/^(PET OWNER|SPECIES|DATE OF|SEROLOGY|TEST|RESULT)/i.test(line)) break;
    if (/^[A-Z][A-Z\s'-]{1,30}$/.test(line) && !/(IDEXX|SNAP|VETCONNECT|SEROLOGY|REPORT|DIAGNOSTIC)/i.test(line)) {
      animalName = line.trim();
    }
  }

  let species = "";
  const speciesMatch = pageText.match(/SPECIES:\s*(.+)/i);
  if (speciesMatch) species = speciesMatch[1].trim().split(/\s{2,}/)[0];

  let resultDate = "";
  const dateMatch = pageText.match(/DATE OF RESULT:\s*(.+)/i);
  if (dateMatch) resultDate = parseDateStr(dateMatch[1].trim().split(/\s{2,}/)[0]);

  let resultTime = "";
  const timeMatch = pageText.match(/(\d{1,2}:\d{2}\s*[AP]M)/i);
  if (timeMatch) resultTime = timeMatch[1].trim();

  const knownTests = [
    "Heartworm Antigen", "FIV Antibody", "FeLV Antigen", "FIV Ab/FeLV Ag",
    "CPV Antigen", "Parvovirus", "Ehrlichia", "Lyme", "Anaplasma",
    "Heartworm Ag", "FIV Ab", "FeLV Ag",
  ];

  const testResults: Array<{ test: string; result: string }> = [];

  for (const testName of knownTests) {
    const regex = new RegExp(testName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\s+(\\S+)", "i");
    const match = pageText.match(regex);
    if (match) {
      testResults.push({ test: testName, result: match[1] });
    }
  }

  if (testResults.length === 0) {
    const tableMatch = pageText.match(/TEST\s+RESULT([\s\S]*?)(?:\n\s*\n|REFERENCE|DISCLAIMER|$)/i);
    if (tableMatch) {
      const tableLines = tableMatch[1].split("\n").map((l) => l.trim()).filter(Boolean);
      for (const line of tableLines) {
        const parts = line.split(/\s{2,}/);
        if (parts.length >= 2) {
          const lastPart = parts[parts.length - 1];
          if (/^(Negative|Positive|StrongPositive|WeakPositive|Inconclusive|Invalid|Pending)$/i.test(lastPart)) {
            testResults.push({ test: parts.slice(0, -1).join(" "), result: lastPart });
          }
        }
      }
    }
  }

  if (animalName && testResults.length === 0) {
    for (const line of lines) {
      const m = line.match(/(Negative|Positive|StrongPositive|WeakPositive)/i);
      if (m) {
        testResults.push({ test: "Unknown Test", result: m[1] });
        break;
      }
    }
  }

  for (const { test, result } of testResults) {
    const { mapped, qualifier } = mapResult(result);
    results.push({
      animal_name: animalName,
      species,
      result_date: resultDate,
      result_time: resultTime,
      test_name: test,
      raw_result: qualifier || result,
      mapped_result: mapped,
      mapped_type: mapTestName(test),
      source: "IDEXX SNAP Pro",
    });
  }

  return results;
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
    }

    if (!file.name.toLowerCase().endsWith(".pdf")) {
      return NextResponse.json({ error: "File must be a PDF" }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const uint8 = new Uint8Array(bytes);

    let pageTexts: string[];
    try {
      const extracted = await extractText(uint8, { mergePages: false });
      const textArr = extracted.text;
      pageTexts = (Array.isArray(textArr) ? textArr : [String(textArr)]).filter((t: string) => t.length > 20);
    } catch (extractErr: unknown) {
      const msg = (extractErr as Error).message || "";
      return NextResponse.json({ error: `Could not parse PDF — please make sure this is an IDEXX VetConnect PLUS result PDF. (${msg.slice(0, 100)})` }, { status: 422 });
    }

    if (pageTexts.length === 0) {
      return NextResponse.json({ error: "Could not extract text from this PDF. It may be a scanned image — try a digital IDEXX export instead." }, { status: 422 });
    }

    const results: ParsedResult[] = [];
    for (const pageText of pageTexts) {
      results.push(...parsePage(pageText));
    }

    return NextResponse.json({ results, pages_detected: pageTexts.length });
  } catch (err: unknown) {
    const e = err as Error;
    return NextResponse.json({ error: `Could not parse PDF — please make sure this is an IDEXX VetConnect PLUS result PDF. (${e.message?.slice(0, 100) || "Unknown error"})` }, { status: 500 });
  }
}
