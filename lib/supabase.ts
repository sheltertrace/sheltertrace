import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// This app uses its own session-storage auth (staff_accounts), NOT Supabase Auth.
//
// supabase-js v2.46+ calls supabase.auth.getSession() before every DB request
// and registers auth state listeners at client creation. This triggers the
// "Supabase Client is configured with the accessToken option" error in v2.104+
// because of an interaction with the GoTrue lifecycle.
//
// Using the `accessToken` option disables GoTrue entirely: every request sends
// the anon key directly as the Bearer token without any auth calls. This is the
// correct pattern for apps that do not use Supabase Auth.
//
// supabase.auth is blocked in this mode — that is intentional and safe here
// because nothing in this codebase calls supabase.auth.*.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  accessToken: async () => supabaseAnonKey,
}) as any;
