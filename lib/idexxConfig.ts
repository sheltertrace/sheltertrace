// IDEXX settings that are safe to keep in the database and show in the browser.
// Credentials and the webhook secret live ONLY in server environment variables
// (see lib/idexxServer.ts); anything credential-shaped is stripped here so it can
// never be read from, or written to, the anon-readable shelter_config table again.
import type { IdexxConfig } from "./idexx";

export const IDEXX_SECRET_KEYS = [
  "agent_username", "agent_password",
  "vetconnect_username", "vetconnect_password",
  "webhook_secret", "api_key", "api_secret",
] as const;

export function stripIdexxSecrets<T extends Partial<IdexxConfig>>(config: T): T {
  const out: Record<string, unknown> = { ...config };
  for (const k of IDEXX_SECRET_KEYS) delete out[k];
  return out as T;
}
