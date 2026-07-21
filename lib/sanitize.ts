/**
 * Converts empty-string ("") or undefined values for the listed fields to null
 * before sending to Postgres. DATE and TIME columns reject empty strings.
 * NULL is always the correct representation of "not provided."
 */
export function nullifyEmptyDates<T extends Record<string, unknown>>(
  obj: T,
  dateFields: ReadonlyArray<string>
): T {
  const out: Record<string, unknown> = { ...obj };
  for (const f of dateFields) {
    if (out[f] === "" || out[f] === undefined) out[f] = null;
  }
  return out as T;
}

/**
 * Converts Y/N/Unknown radio text values ("yes"/"no"/"unknown") as well as
 * empty-string/undefined for the listed fields into true/false/null before
 * sending to Postgres. BOOLEAN columns reject empty strings.
 */
export function nullifyEmptyBooleans<T extends Record<string, unknown>>(
  obj: T,
  boolFields: ReadonlyArray<string>
): T {
  const out: Record<string, unknown> = { ...obj };
  for (const f of boolFields) {
    if (out[f] === "" || out[f] === undefined) {
      out[f] = null;
    } else if (out[f] === "yes" || out[f] === "true") {
      out[f] = true;
    } else if (out[f] === "no" || out[f] === "false") {
      out[f] = false;
    } else if (out[f] === "unknown") {
      out[f] = null;
    }
  }
  return out as T;
}
