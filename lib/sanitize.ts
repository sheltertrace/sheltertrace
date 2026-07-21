/**
 * Converts empty-string ("") or undefined values for the listed fields to null
 * before sending to Postgres. DATE and TIME columns reject empty strings with
 * "invalid input syntax for type date/time" — NULL is always the correct
 * representation of "not provided."
 *
 * Usage:
 *   const clean = nullifyEmptyDates(payload, ["incident_date", "follow_up_date"]);
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
