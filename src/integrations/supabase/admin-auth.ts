import { createMiddleware } from "@tanstack/react-start";
import { requireSupabaseAuth } from "./auth-middleware";

/**
 * Requires a valid Supabase session AND membership in public.admin_users.
 * Use on admin-only server functions.
 */
export const requireAdmin = createMiddleware({ type: "function" })
  .middleware([requireSupabaseAuth])
  .server(async ({ next, context }) => {
    const { supabaseAdmin } = await import("./client.server");
    const { data, error } = await supabaseAdmin
      .from("admin_users")
      .select("user_id")
      .eq("user_id", context.userId)
      .maybeSingle();

    if (error || !data) {
      throw new Error("Forbidden: admin access required");
    }

    return next({
      context: {
        ...context,
        isAdmin: true as const,
      },
    });
  });

/** Client/helper: check whether the current session user is an admin. */
export async function isAdminUserId(userId: string): Promise<boolean> {
  const { supabaseAdmin } = await import("./client.server");
  const { data } = await supabaseAdmin
    .from("admin_users")
    .select("user_id")
    .eq("user_id", userId)
    .maybeSingle();
  return Boolean(data);
}
