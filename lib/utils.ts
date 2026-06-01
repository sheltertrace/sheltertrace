export function genId(): string {
  return Math.random().toString(36).substring(2, 9).toUpperCase();
}

export function formatDate(date: string | Date | null | undefined): string {
  if (!date) return "—";
  const d = typeof date === "string" ? new Date(date + "T00:00:00") : date;
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-US", { month: "2-digit", day: "2-digit", year: "numeric" });
}

export function formatDateTime(date: string | null | undefined): string {
  if (!date) return "—";
  const d = new Date(date);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleString("en-US", { month: "2-digit", day: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export function calcAge(dob: string | null | undefined): string {
  if (!dob) return "";
  const birth = new Date(dob + "T00:00:00");
  const now = new Date();
  const diffMs = now.getTime() - birth.getTime();
  if (diffMs < 0) return "";
  const totalDays = Math.floor(diffMs / 86400000);
  const years = Math.floor(totalDays / 365);
  const months = Math.floor((totalDays % 365) / 30);
  const days = totalDays % 30;
  if (years > 0) return `${years}y ${months}m`;
  if (months > 0) return `${months}m ${days}d`;
  return `${days}d`;
}

// Convert a DOB (ISO YYYY-MM-DD) to a human-readable age estimate string
// used as the initial value for the AgeInput component when DOB is entered.
export function dobToAgeEstimate(dob: string): string {
  if (!dob) return "";
  const birth = new Date(dob + "T00:00:00");
  const now = new Date();
  const totalDays = Math.floor((now.getTime() - birth.getTime()) / 86400000);
  if (totalDays < 0) return "";
  if (totalDays < 14) return `${totalDays} ${totalDays === 1 ? "Day" : "Days"}`;
  const weeks = Math.floor(totalDays / 7);
  if (weeks < 9) return `${weeks} ${weeks === 1 ? "Week" : "Weeks"}`;
  const months = Math.round(totalDays / 30.4);
  if (months < 24) return `${months} ${months === 1 ? "Month" : "Months"}`;
  const years = Math.round(totalDays / 365.25);
  return `${years} ${years === 1 ? "Year" : "Years"}`;
}

// Display an animal age with a ~ prefix for numeric estimates.
// Named presets (Neonate, Unknown, etc.) are shown as-is.
export function displayAge(age: string | null | undefined): string {
  if (!age) return "—";
  if (/^\d/.test(age)) return `~${age}`;
  return age;
}

export function genPid(nextNum: number): string {
  return `PID-${String(nextNum).padStart(5, "0")}`;
}

export function genCitationNumber(): string {
  const year = new Date().getFullYear();
  const seq = Math.floor(Math.random() * 9000) + 1000;
  return `CIT-${year}-${seq}`;
}

export function genReceiptId(): string {
  return `REC-${Date.now().toString(36).toUpperCase()}`;
}

export function today(): string {
  return new Date().toISOString().split("T")[0];
}

export function nowTime(): string {
  const now = new Date();
  return now.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
}

// ── Microchip manufacturer identification ─────────────────────────────────────

export interface ChipId {
  manufacturer: string;
  /** Phone is undefined when manufacturer is completely unknown — do not show a number */
  phone?: string;
  /** true when the prefix definitively maps to one company; false for generic fallbacks */
  certain: boolean;
}

/**
 * Identify the likely manufacturer of a microchip from its number prefix.
 * Based on known ISO 11784/11785 prefix allocations and AVID/HomeAgain ranges.
 * No network call — purely local lookup.
 *
 * Returns null for an empty string.
 * Returns { phone: undefined } when the prefix is genuinely unknown.
 */
export function identifyMicrochip(raw: string): ChipId | null {
  const c = raw.replace(/[\s\-]/g, "").toUpperCase();
  if (!c) return null;

  // ── 9-digit AVID (hexadecimal format) ──────────────────────────────────────
  if (c.length === 9) {
    return { manufacturer: "AVID MicroChip ID", phone: "(800) 336-2843", certain: false };
  }

  // ── 10-digit AVID ──────────────────────────────────────────────────────────
  if (c.length === 10) {
    if (c.startsWith("0A")) {
      return { manufacturer: "AVID MicroChip ID", phone: "(800) 336-2843", certain: true };
    }
    return { manufacturer: "AVID MicroChip ID", phone: "(800) 336-2843", certain: false };
  }

  // ── 15-digit ISO chips ──────────────────────────────────────────────────────
  if (c.length === 15) {
    // 985 sub-ranges — more specific prefixes checked before generic 985
    if (c.startsWith("98510")) return { manufacturer: "Trovan",                 phone: "(800) 336-2843",  certain: true };
    if (c.startsWith("98514")) return { manufacturer: "AKC Reunite",            phone: "(800) 252-7894",  certain: true };
    if (c.startsWith("98515")) return { manufacturer: "Datamars / PetLink",     phone: "(877) 738-5465",  certain: true };
    // 9851x (excl. 98510/98514/98515 already handled above) → AVID range
    if (c.startsWith("9851"))  return { manufacturer: "AVID MicroChip ID",      phone: "(800) 336-2843",  certain: true };
    if (c.startsWith("985"))   return { manufacturer: "ISO Standard",           phone: "(800) 252-2894",  certain: false };

    // 982 sub-ranges
    if (c.startsWith("9820")) return { manufacturer: "24PetWatch (Pethealth)",  phone: "(866) 597-2424",  certain: true };
    if (c.startsWith("9821")) return { manufacturer: "AKC Reunite",             phone: "(800) 252-7894",  certain: true };
    if (c.startsWith("9822")) return { manufacturer: "HomeAgain (Merck)",       phone: "(888) 466-3242",  certain: true };
    if (c.startsWith("9823")) return { manufacturer: "Nanochip ID",             phone: "(800) 434-2843",  certain: true };
    if (c.startsWith("982"))  return { manufacturer: "24PetWatch (Pethealth)",  phone: "(866) 597-2424",  certain: true };

    if (c.startsWith("981"))  return { manufacturer: "HomeAgain (Merck)",       phone: "(888) 466-3242",  certain: true };
    if (c.startsWith("991"))  return { manufacturer: "HomeAgain (Merck)",       phone: "(888) 466-3242",  certain: true };
    if (c.startsWith("956"))  return { manufacturer: "AKC Reunite",             phone: "(800) 252-7894",  certain: true };
    if (c.startsWith("900"))  return { manufacturer: "Datamars / PetLink",      phone: "(877) 738-5465",  certain: true };
  }

  // Prefix doesn't match any known pattern — return no phone number
  return { manufacturer: "Unknown manufacturer", phone: undefined, certain: false };
}

export function currencyFmt(amount: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(amount);
}

export function hasPermission(permissions: string[], required: string): boolean {
  return permissions.includes("all") || permissions.includes(required);
}

// ── Animal classification helpers ─────────────────────────────────────────────

// Statuses that indicate an animal is physically present in the shelter.
export const IN_SHELTER_STATUSES = [
  "Available", "Medical Hold", "Quarantine", "Pending", "Foster", "Boarding", "Confiscated",
];

// Returns true for animals imported from an external system (e.g. ShelterBuddy).
// These are excluded from active views but kept for historical search.
export function isImported(animal: { import_source?: string | null }): boolean {
  return !!animal.import_source;
}

// Returns true for animals currently in the shelter (not imported, active status).
export function isCurrentlySheltered(animal: { import_source?: string | null; status: string }): boolean {
  return !isImported(animal) && IN_SHELTER_STATUSES.includes(animal.status);
}
