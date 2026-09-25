// SERVER ONLY — never import this from a client component (a test enforces it).
// IDEXX credentials come from environment variables, not from the database:
//
//   IDEXX_VETCONNECT_USERNAME   IDEXX_VETCONNECT_PASSWORD
//   IDEXX_AGENT_USERNAME        IDEXX_AGENT_PASSWORD
//   IDEXX_WEBHOOK_SECRET        (shared with IDEXX to sign result webhooks)
//
// Non-secret settings (account number, auto-sync, test mode) stay in shelter_config id 6.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { IdexxConfig } from "./idexx";
import { stripIdexxSecrets } from "./idexxConfig";

export function idexxSecrets() {
  const e = process.env;
  return {
    agent_username: e.IDEXX_AGENT_USERNAME ?? "",
    agent_password: e.IDEXX_AGENT_PASSWORD ?? "",
    vetconnect_username: e.IDEXX_VETCONNECT_USERNAME ?? "",
    vetconnect_password: e.IDEXX_VETCONNECT_PASSWORD ?? "",
    webhook_secret: e.IDEXX_WEBHOOK_SECRET ?? "",
  };
}

/** Which secrets are present — booleans only, safe to send to the browser. */
export function idexxCredentialStatus() {
  const s = idexxSecrets();
  return {
    vetconnect: !!(s.vetconnect_username && s.vetconnect_password),
    agent: !!(s.agent_username && s.agent_password),
    webhook_secret: !!s.webhook_secret,
  };
}

/** Stored settings merged with the environment credentials. Credentials in the database are ignored. */
export async function loadIdexxConfig(db: SupabaseClient): Promise<IdexxConfig> {
  const { data } = await db.from("shelter_config").select("config_data").eq("id", 6).maybeSingle();
  const stored = stripIdexxSecrets((data?.config_data ?? {}) as Partial<IdexxConfig>);
  return {
    account_number: "",
    auto_sync: true,
    use_sandbox: false,
    ...stored,
    ...idexxSecrets(),
  };
}
