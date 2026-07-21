/**
 * Converts empty-string ("") or undefined values for the listed fields to null
 * before sending to Postgres. DATE and TIME columns reject empty strings.
 * NULL is always the correct representation of "not provided."
 */
export function nullifyEmptyDates<T extends object>(
  obj: T,
  dateFields: ReadonlyArray<string>
): T {
  const out: Record<string, unknown> = { ...obj };
  for (const f of dateFields) {
    if (out[f] === "" || out[f] === undefined) out[f] = null;
  }
  return out as T;
}
