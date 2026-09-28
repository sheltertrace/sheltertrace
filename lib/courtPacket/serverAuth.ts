import { createClient } from "@supabase/supabase-js";

// These endpoints do non-trivial work (rendering PDFs, sending email with a
// law-enforcement attachment) and shouldn't be open to anyone. This used to
// trust a client-supplied x-staff-id header, checked only for "does an active
// row with this id exist" — not an authentication mechanism, since staff ids
// are readable via plain SELECT on staff_accounts. It now requires the signed
// session token from staff_login/staff_verify_session (2026-09-28 fix): the
// caller must hold a token the database itself signed, not just know an id.
export async function verifyStaffSession(token: string | null): Promise<boolean> {
  if (!token) return false;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return false;
  const { data, error } = await createClient(url, key).rpc("staff_verify_session", { p_token: token });
  if (error) return false;
  return !!(data as { ok?: boolean })?.ok;
}
