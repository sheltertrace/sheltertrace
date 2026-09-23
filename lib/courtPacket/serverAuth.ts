import { createClient } from "@supabase/supabase-js";

// The app's session lives in the browser (sessionStorage), so API routes have
// no server session to verify. At minimum require a real, active staff
// account id — these endpoints do non-trivial work (rendering PDFs, sending
// email with a law-enforcement attachment) and shouldn't be open to anyone.
export async function isActiveStaff(staffId: string | null): Promise<boolean> {
  if (!staffId) return false;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return false;
  const { data } = await createClient(url, key).from("staff_accounts").select("id").eq("id", staffId).eq("active", true).limit(1);
  return !!data && data.length > 0;
}
