// Public pages (no auth required) use the same underlying Supabase client.
// Re-exporting from lib/supabase.ts ensures only ONE GoTrueClient instance
// is ever created, eliminating the "Multiple GoTrueClient instances" warning.
export { supabase as supabasePublic } from "./supabase";
