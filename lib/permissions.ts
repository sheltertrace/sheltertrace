// Shared permission checks kept in one place so every surface (UI, and any
// future API route) that decides "can this user do X" agrees with the others.
import type { StaffAccount, NarrativeEntry, DepartureReceipt, DispatchCall } from "./types";

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

// Court Packet: a compiled, law-enforcement-confidential copy of everything on
// a call. Administrators and supervisors can always generate one; an officer
// can generate one for a call they were assigned to; everyone else can't.
export function wasAssignedToCall(user: StaffAccount, call: Pick<DispatchCall, "assigned_officers">): boolean {
  const myName = `${user.firstName || user.first_name || ""} ${user.lastName || user.last_name || ""}`.trim();
  return ((call.assigned_officers || []) as Array<{ id?: string; name?: string; badge?: string }>).some((o) =>
    o.id === user.id || o.id === `staff-${user.id}` ||
    (!!user.badge && !!o.badge && o.badge === user.badge) ||
    (!!myName && o.name === myName));
}

export function canGenerateCourtPacket(user: StaffAccount | null, call: Pick<DispatchCall, "assigned_officers"> | null): boolean {
  if (!user || !call) return false;
  const role = (user.role || "").toLowerCase();
  if (Array.isArray(user.permissions) && user.permissions.includes("all")) return true;
  if (["admin", "administrator", "supervisor"].some((r) => role.includes(r))) return true;
  return role.includes("officer") && wasAssignedToCall(user, call);
}
