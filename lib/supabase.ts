import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// Single shared instance — avoids the "Multiple GoTrueClient instances"
// warning that fires when two createClient() calls use the same project URL.
let _instance: SupabaseClient | null = null;

function getSupabaseClient(): SupabaseClient {
  if (!_instance) {
    _instance = createClient(supabaseUrl, supabaseAnonKey, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });
  }
  return _instance;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const supabase: any = new Proxy({} as SupabaseClient, {
  get(_target, prop) {
    return (getSupabaseClient() as unknown as Record<string | symbol, unknown>)[prop];
  },
});
