import { createMiddleware } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "./types";

/**
 * Adds `userId` when the request carries a valid Supabase session, and `null` for guests.
 * Use on server functions that both guests and signed-in customers may call.
 */
export const optionalSupabaseAuth = createMiddleware({ type: "function" }).server(async ({ next }) => {
  const token = getRequest()?.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim() ?? "";
  const url = process.env["SUPABASE_URL"];
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"];
  let userId: string | null = null;
  let email: string | null = null;

  if (url && key && token.split(".").length === 3) {
    const client = createClient<Database>(url, key, {
      global: { headers: { apikey: key } },
      auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
    });
    const { data } = await client.auth.getClaims(token);
    const claims = data?.claims;
    if (claims?.sub) {
      userId = claims.sub;
      email = typeof claims["email"] === "string" ? claims["email"] : null;
    }
  }

  return next({ context: { userId, email } });
});
