// Shared permission checks kept in one place so every surface (UI, and any
// future API route) that decides "can this user do X" agrees with the others.
import type { StaffAccount, NarrativeEntry, DepartureReceipt } from "./types";

const NARRATIVE_PRIVILEGED_ROLES = ["admin", "administrator", "supervisor"];
const RECEIPT_PRIVILEGED_ROLES = ["admin", "administrator", "supervisor"];

// The officer who wrote a narrative entry can always edit it; admins/supervisors
// can edit any entry; everyone else gets a read-only view. System-generated
// entries (status changes, etc.) are never editable.
export function canEditNarrative(user: StaffAccount | null, entry: NarrativeEntry): boolean {
  if (!user || entry.officer === "System") return false;
  const role = (user.role || "").toLowerCase();
  if (NARRATIVE_PRIVILEGED_ROLES.some((r) => role.includes(r))) return true;
  if (entry.author_id) return entry.author_id === user.id;
  // Legacy entries saved before author_id existed — fall back to name matching.
  const myName = `${user.firstName || user.first_name || ""} ${user.lastName || user.last_name || ""}`.trim() || user.username;
  return entry.officer === myName;
}

// Admins/supervisors can reprint any receipt; the officer who processed the
// original transaction can reprint their own. Everyone else can view but not
// reprint receipts they didn't process.
export function canReprintReceipt(user: StaffAccount | null, receipt: DepartureReceipt): boolean {
  if (!user) return false;
  const role = (user.role || "").toLowerCase();
  if (RECEIPT_PRIVILEGED_ROLES.some((r) => role.includes(r))) return true;
  if (receipt.officer_id) return receipt.officer_id === user.id;
  // Older receipts saved before officer_id was recorded — fall back to name matching.
  const myName = `${user.firstName || user.first_name || ""} ${user.lastName || user.last_name || ""}`.trim() || user.username;
  return receipt.officer_name === myName;
}
