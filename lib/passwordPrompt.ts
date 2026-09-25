// Account-management actions are verified in the database with the signed-in
// person's own password (see migration 20260925170000). This module asks for it
// through a modal (PasswordPromptHost) and remembers it in MEMORY ONLY for a few
// minutes so a burst of admin work doesn't re-prompt on every click. It is never
// written to sessionStorage/localStorage and is cleared on logout.

type Asker = (reason: string) => Promise<string | null>;

const REMEMBER_MS = 5 * 60 * 1000;

let asker: Asker | null = null;
let cached: { password: string; until: number } | null = null;

export function registerPasswordAsker(fn: Asker | null): void {
  asker = fn;
}

export function clearCachedPassword(): void {
  cached = null;
}

/** Resolves to the user's password, or null if they cancel. */
export async function requirePassword(reason: string): Promise<string | null> {
  if (cached && cached.until > Date.now()) return cached.password;
  cached = null;
  if (!asker) return null;
  const pw = await asker(reason);
  if (pw) cached = { password: pw, until: Date.now() + REMEMBER_MS };
  return pw;
}
