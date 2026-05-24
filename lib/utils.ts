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
  phone: string;
  /** true when prefix is definitively mapped; false for generic fallbacks */
  certain: boolean;
}

/**
 * Identify the likely manufacturer of a microchip from its number prefix.
 * Based on known ISO 11784/11785 prefix allocations and AVID/HomeAgain ranges.
 * No network call — purely local lookup.
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
    // 985 sub-ranges — check specific before generic
    if (c.startsWith("98510")) return { manufacturer: "Trovan",                 phone: "(800) 336-2843",  certain: true };
    if (c.startsWith("98512")) return { manufacturer: "AVID MicroChip ID",      phone: "(800) 336-2843",  certain: true };
    if (c.startsWith("98514")) return { manufacturer: "AKC Reunite",            phone: "(800) 252-7894",  certain: true };
    if (c.startsWith("98515")) return { manufacturer: "Datamars / PetLink",     phone: "(877) 738-5465",  certain: true };
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

  // Unknown — direct caller to AAHA universal lookup
  return { manufacturer: "Unknown manufacturer", phone: "(800) 252-2894", certain: false };
}

export function currencyFmt(amount: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(amount);
}

export function hasPermission(permissions: string[], required: string): boolean {
  return permissions.includes("all") || permissions.includes(required);
}
