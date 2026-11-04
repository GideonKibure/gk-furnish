/**
 * Helpers for running before a migration has been applied in Supabase.
 * New tables and columns are added by SQL files the owner runs by hand, so code that
 * uses them must keep working (with less) until then.
 */

type MaybeDbError = { code?: string | null; message?: string | null } | null | undefined;

/** Postgres / PostgREST codes for a table, view or column that does not exist yet. */
const MISSING_SCHEMA_CODES = new Set(["42P01", "42703", "PGRST204", "PGRST205", "PGRST200"]);

export function isMissingSchema(error: MaybeDbError) {
  if (!error) return false;
  if (error.code && MISSING_SCHEMA_CODES.has(error.code)) return true;
  const message = error.message ?? "";
  return /does not exist|could not find the (table|column)|schema cache/i.test(message);
}

/** Message for admin screens that need a migration that has not been run. */
export function migrationNeeded(file: string) {
  return `Run drizzle/migrations/${file} in the Supabase SQL editor to switch this on.`;
}

export type Availability<T> =
  { available: true; data: T } | { available: false; data: T; reason: string };

/** Wrap a read so a missing table returns `fallback` with `available: false` instead of throwing. */
export async function readOptional<T>(
  file: string,
  fallback: T,
  run: () => PromiseLike<{ data: T | null; error: MaybeDbError }>,
): Promise<Availability<T>> {
  const { data, error } = await run();
  if (error) {
    if (isMissingSchema(error))
      return { available: false, data: fallback, reason: migrationNeeded(file) };
    throw new Error(error.message ?? "Database error");
  }
  return { available: true, data: data ?? fallback };
}
