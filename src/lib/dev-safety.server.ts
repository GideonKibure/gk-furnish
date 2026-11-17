/**
 * Server-only warning when a development process is pointed at the live shop database.
 * It never throws and never blocks a request.
 */

type EnvLike = { [key: string]: string | undefined };

function hostOf(value: string | undefined): string | null {
  const raw = value?.trim();
  if (!raw) return null;
  try {
    return new URL(raw).host.toLowerCase();
  } catch {
    return null;
  }
}

/**
 * True when this process is a development server and its Supabase URL is the production project.
 * When SUPABASE_PRODUCTION_URL is set, the hosts are compared.
 * When it is not set, a missing APP_ENV or APP_ENV=production is treated as the live project,
 * because this repo has no staging database until the owner creates one.
 */
export function developmentUsesProductionDatabase(env: EnvLike): boolean {
  if (env["NODE_ENV"] !== "development") return false;
  const current = hostOf(env["SUPABASE_URL"]);
  const production = hostOf(env["SUPABASE_PRODUCTION_URL"]);
  if (production) return current === production;
  const appEnv = env["APP_ENV"]?.trim() ?? "";
  return appEnv === "" || appEnv === "production";
}

let warned = false;

export function warnIfDevelopmentUsesProduction(env: EnvLike = process.env): void {
  if (warned || !developmentUsesProductionDatabase(env)) return;
  warned = true;
  const appEnv = env["APP_ENV"]?.trim() || "(not set)";
  console.warn(
    [
      "",
      "======== GK FURNISH SAFETY WARNING ========",
      "NODE_ENV is development and Supabase is the production project.",
      `APP_ENV=${appEnv}. Orders, payments, and stock written here change the live shop.`,
      "Create a staging Supabase project, point SUPABASE_URL at it, and set APP_ENV=staging.",
      "Set SUPABASE_PRODUCTION_URL to the live project URL so this check can compare hosts.",
      "===========================================",
      "",
    ].join("\n"),
  );
}
