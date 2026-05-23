// Dedicated Supabase client for public (unauthenticated) pages:
//   /volunteer-apply, /adopt-apply, /available-animals,
//   /volunteer-clock, /volunteer, /field-status
//
// Uses the anon/publishable key with NO session, NO accessToken, and NO
// auth-helpers wrappers so the apikey header is always sent as-is.
// Staff pages continue to use the same underlying client via lib/supabase.ts;
// the separation here keeps the public surface explicit and easy to audit.

import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !key) {
  console.error(
    "[supabase-public] NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY is undefined. " +
    "Make sure both variables are set in .env.local and in Vercel → Settings → Environment Variables."
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const supabasePublic = createClient(url!, key!) as any;
