import type { Json } from "@/integrations/supabase/types";
import { isMissingSchema } from "@/lib/db-compat";

type SupabaseAdmin = Awaited<typeof import("@/integrations/supabase/client.server")>["supabaseAdmin"];

export type AuditInput = {
  /** Auth user id of the admin (requireAdmin context.userId). */
  actor: string | null | undefined;
  action: string;
  entity: string;
  entityId?: string | null | undefined;
  before?: unknown;
  after?: unknown;
};

const emailCache = new Map<string, string | null>();

export async function actorEmail(supabaseAdmin: SupabaseAdmin, userId: string | null | undefined) {
  if (!userId) return null;
  if (emailCache.has(userId)) return emailCache.get(userId) ?? null;
  const { data } = await supabaseAdmin.auth.admin.getUserById(userId);
  const email = data.user?.email ?? null;
  emailCache.set(userId, email);
  return email;
}

/** A short label for history rows and movement logs: the admin's email, else "Admin". */
export async function actorLabel(supabaseAdmin: SupabaseAdmin, userId: string | null | undefined) {
  return (await actorEmail(supabaseAdmin, userId)) ?? "Admin";
}

function asJson(value: unknown): Json | null {
  if (value === undefined || value === null) return null;
  return JSON.parse(JSON.stringify(value)) as Json;
}

/**
 * Record a sensitive change (prices, payments, refunds, stock adjustments, status overrides,
 * deletions and archives). Never throws: the audit log must not block the change itself,
 * and before migration 0008 the table does not exist.
 */
export async function writeAudit(supabaseAdmin: SupabaseAdmin, input: AuditInput) {
  try {
    const { error } = await supabaseAdmin.from("audit_logs").insert({
      actor: input.actor ?? null,
      actor_email: await actorEmail(supabaseAdmin, input.actor),
      action: input.action,
      entity: input.entity,
      entity_id: input.entityId ?? null,
      before: asJson(input.before),
      after: asJson(input.after),
    });
    if (error && !isMissingSchema(error)) console.warn("audit failed:", error.message);
  } catch (err) {
    console.warn("audit failed:", err instanceof Error ? err.message : err);
  }
}
