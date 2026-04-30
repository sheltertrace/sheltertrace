export interface AamvaData {
  firstName?: string;
  middleName?: string;
  lastName?: string;
  address?: string;
  city?: string;
  state?: string;
  zip?: string;
  dob?: string;        // YYYY-MM-DD
  sex?: string;        // "Male" | "Female"
  licenseNumber?: string;
  expiration?: string; // YYYY-MM-DD
}

// AAMVA dates: MMDDYYYY (US) or YYYYMMDD (some states)
function aamvaDate(raw: string): string {
  if (!raw) return "";
  const s = raw.trim();
  if (s.length === 8) {
    // Detect format: if first 4 chars look like a year (>1900) it's YYYYMMDD
    const maybe_year = parseInt(s.substring(0, 4), 10);
    if (maybe_year >= 1900 && maybe_year <= 2100) {
      // YYYYMMDD
      return `${s.substring(0, 4)}-${s.substring(4, 6)}-${s.substring(6, 8)}`;
    }
    // MMDDYYYY
    return `${s.substring(4, 8)}-${s.substring(0, 2)}-${s.substring(2, 4)}`;
  }
  return "";
}

export function parseAamva(raw: string): AamvaData {
  // Extract all AAMVA field codes — each is 3 uppercase letters followed by value up to \r or \n
  const fields: Record<string, string> = {};
  const re = /([A-Z]{3})([^\r\n]+)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(raw)) !== null) {
    const code = m[1];
    const val  = m[2].trim();
    // Only keep driver's license fields (all start with D) plus ZG (GA-specific)
    if (code[0] === "D" || code[0] === "Z") {
      fields[code] = val;
    }
  }

  const result: AamvaData = {};

  // Name
  result.lastName  = fields["DCS"] || fields["DAB"] || "";
  result.firstName = fields["DAC"] || "";
  result.middleName = fields["DAD"] || "";

  // Address
  result.address = fields["DAG"] || "";
  result.city    = fields["DAI"] || "";
  result.state   = fields["DAJ"] || "";
  // DAK is 9-digit zip — take first 5
  result.zip = (fields["DAK"] || "").replace(/\D/g, "").substring(0, 5);

  // Identification
  result.licenseNumber = fields["DAQ"] || "";

  // Dates
  result.dob        = aamvaDate(fields["DBB"] || fields["DBD"] || "");
  result.expiration = aamvaDate(fields["DBA"] || "");

  // Sex: 1=Male 2=Female 9=Not Specified
  const sex = (fields["DBC"] || "").trim();
  if (sex === "1") result.sex = "Male";
  else if (sex === "2") result.sex = "Female";

  // Clean up empty strings to undefined
  for (const key of Object.keys(result) as (keyof AamvaData)[]) {
    if (result[key] === "") delete result[key];
  }

  return result;
}
