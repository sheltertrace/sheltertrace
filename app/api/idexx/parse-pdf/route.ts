import { NextRequest, NextResponse } from "next/server";

// Dynamic import to avoid bundling issues with pdf-parse
async function extractText(buffer: Buffer): Promise<string> {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const pdfParse = require("pdf-parse") as (buf: Buffer) => Promise<{ text: string }>;
  const result = await pdfParse(buffer);
  return result.text;
}

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

function parsePages(text: string): ParsedResult[] {
  const results: ParsedResult[] = [];

  // Split by form-feed or by common IDEXX page markers
  const pages = text.split(/\f/).filter((p) => p.trim().length > 50);
  if (pages.length === 0) {
    // Fallback: treat entire text as one page
    pages.push(text);
  }

  for (const page of pages) {
    const lines = page.split("\n").map((l) => l.trim()).filter(Boolean);

    // Extract animal name — first all-caps word(s) before PET OWNER or SPECIES
    let animalName = "";
    for (const line of lines) {
      if (/^(PET OWNER|SPECIES|DATE OF|SEROLOGY|TEST|RESULT)/i.test(line)) break;
      if (/^[A-Z][A-Z\s'-]{1,30}$/.test(line) && !/(IDEXX|SNAP|VETCONNECT|SEROLOGY|REPORT)/i.test(line)) {
        animalName = line.trim();
      }
    }

    // Extract species
    let species = "";
    const speciesMatch = page.match(/SPECIES:\s*(.+)/i);
    if (speciesMatch) species = speciesMatch[1].trim().split(/\s{2,}/)[0];

    // Extract date
    let resultDate = "";
    const dateMatch = page.match(/DATE OF RESULT:\s*(.+)/i);
    if (dateMatch) resultDate = parseDateStr(dateMatch[1].trim().split(/\s{2,}/)[0]);

    // Extract time
    let resultTime = "";
    const timeMatch = page.match(/(\d{1,2}:\d{2}\s*[AP]M)/i);
    if (timeMatch) resultTime = timeMatch[1].trim();

    // Extract test results from the serology section
    // Look for TEST / RESULT column pattern
    const testResults: Array<{ test: string; result: string }> = [];

    // Strategy 1: Find lines after "TEST" header that contain known test names
    const knownTests = [
      "Heartworm Antigen", "FIV Antibody", "FeLV Antigen", "FIV Ab/FeLV Ag",
      "CPV Antigen", "Parvovirus", "Ehrlichia", "Lyme", "Anaplasma",
      "Heartworm Ag", "FIV Ab", "FeLV Ag",
    ];

    for (const testName of knownTests) {
      const regex = new RegExp(testName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\s+(\\S+)", "i");
      const match = page.match(regex);
      if (match) {
        testResults.push({ test: testName, result: match[1] });
      }
    }

    // Strategy 2: If no known tests found, look for TEST/RESULT table pattern
    if (testResults.length === 0) {
      const tableMatch = page.match(/TEST\s+RESULT([\s\S]*?)(?:\n\s*\n|REFERENCE|DISCLAIMER|$)/i);
      if (tableMatch) {
        const tableText = tableMatch[1];
        const tableLines = tableText.split("\n").map((l) => l.trim()).filter(Boolean);
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

    // If we found an animal but no test results, still note it
    if (animalName && testResults.length === 0) {
      // Try a more aggressive scan for any result-like words
      for (const line of lines) {
        const m = line.match(/(Negative|Positive|StrongPositive|WeakPositive)/i);
        if (m) {
          const { mapped, qualifier } = mapResult(m[1]);
          results.push({
            animal_name: animalName,
            species,
            result_date: resultDate,
            result_time: resultTime,
            test_name: "Unknown Test",
            raw_result: qualifier || m[1],
            mapped_result: mapped,
            mapped_type: "Diagnostic Test",
            source: "IDEXX SNAP Pro",
          });
          break;
        }
      }
    }
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
    const buffer = Buffer.from(bytes);
    const text = await extractText(buffer);
    const results = parsePages(text);

    return NextResponse.json({ results, raw_text_length: text.length, pages_detected: text.split(/\f/).length });
  } catch (err: unknown) {
    const e = err as Error;
    return NextResponse.json({ error: `PDF parsing failed: ${e.message}` }, { status: 500 });
  }
}
