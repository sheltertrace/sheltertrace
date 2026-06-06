// Demo mode utilities. All gated on NEXT_PUBLIC_IS_DEMO=true.

export const IS_DEMO = process.env.NEXT_PUBLIC_IS_DEMO === "true";

// Features disabled in demo mode
export const DEMO_DISABLED = {
  drugLog: true,
  emailNotifications: true,
  paymentProcessing: true,
  gdaSubmit: true,
  passwordChange: true,
} as const;

// Pre-configured demo user accounts (credentials match the seed SQL)
export const DEMO_USERS = [
  {
    role: "Administrator",
    username: "demo-admin",
    password: "Demo@Admin2026",
    icon: "⚙️",
    desc: "Full access to all shelter modules",
  },
  {
    role: "Animal Control Officer",
    username: "demo-officer",
    password: "Demo@Officer2026",
    icon: "🚓",
    desc: "Dispatch, field ops, citations, and animal intake",
  },
  {
    role: "Front Desk Staff",
    username: "demo-frontdesk",
    password: "Demo@FrontDesk2026",
    icon: "🖥️",
    desc: "Animal records, adoptions, and public inquiries",
  },
] as const;

// Reset demo data by calling the Supabase RPC function
export async function resetDemoData(supabase: import("@supabase/supabase-js").SupabaseClient): Promise<void> {
  const { error } = await supabase.rpc("reset_demo_data");
  if (error) throw new Error(`Demo reset failed: ${error.message}`);
}
