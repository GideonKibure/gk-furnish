import { isMissingSchema } from "@/lib/db-compat";

export type NotifyInput = {
  audience: "customer" | "staff";
  /** Customer to notify. Leave empty for staff notifications. */
  userId?: string | null;
  type: string;
  title: string;
  body?: string | null;
  link?: string | null;
  entity?: string | null;
  entityId?: string | null;
};

/**
 * Store an in-app notification. Never throws: a notification must not break the action
 * that triggered it, and before migration 0007 the table does not exist.
 * Customer notifications without a user id are skipped (guests have no inbox).
 */
export async function notify(input: NotifyInput): Promise<boolean> {
  if (input.audience === "customer" && !input.userId) return false;
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("notifications").insert({
      audience: input.audience,
      user_id: input.userId ?? null,
      type: input.type,
      title: input.title.slice(0, 200),
      body: input.body ? input.body.slice(0, 1000) : null,
      link: input.link ?? null,
      entity: input.entity ?? null,
      entity_id: input.entityId ?? null,
    });
    if (error && !isMissingSchema(error)) console.warn("notify failed:", error.message);
    return !error;
  } catch (err) {
    console.warn("notify failed:", err instanceof Error ? err.message : err);
    return false;
  }
}

/** Notify several recipients; failures are ignored. */
export async function notifyAll(inputs: NotifyInput[]) {
  await Promise.all(inputs.map((input) => notify(input)));
}
