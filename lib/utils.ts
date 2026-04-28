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

export function currencyFmt(amount: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(amount);
}

export function hasPermission(permissions: string[], required: string): boolean {
  return permissions.includes("all") || permissions.includes(required);
}
