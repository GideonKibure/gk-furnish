import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { optionalSupabaseAuth } from "@/integrations/supabase/customer-auth";
import { QUOTE_RESPONSES } from "@/lib/custom-quotes";
import type { CustomRequestView, CustomRow } from "@/lib/requests.server";

export type { CustomRequestView } from "@/lib/requests.server";

function claimEmail(claims: Record<string, unknown>) {
  return typeof claims["email"] === "string" ? claims["email"] : "";
}

export const listMyRequests = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<CustomRequestView[]> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { myRequestRows, toRequestViews } = await import("@/lib/requests.server");
    const rows = await myRequestRows(supabaseAdmin, context.userId, claimEmail(context.claims));
    return toRequestViews(supabaseAdmin, rows);
  });

export const getMyRequest = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ number: z.string().trim().min(1).max(40) }).parse(d))
  .handler(async ({ data, context }): Promise<CustomRequestView | null> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { myRequestRows, toRequestViews } = await import("@/lib/requests.server");
    const rows = await myRequestRows(supabaseAdmin, context.userId, claimEmail(context.claims));
    const row = rows.find((r) => r.request_number === data.number);
    if (!row) return null;
    return (await toRequestViews(supabaseAdmin, [row]))[0] ?? null;
  });

/** Accept, decline or ask to change a quote. Allowed for the owner, or anyone holding the tracking link. */
export const respondToQuote = createServerFn({ method: "POST" })
  .middleware([optionalSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        number: z.string().trim().max(40).optional(),
        token: z.string().uuid().optional(),
        quoteId: z.string().min(1).max(80),
        response: z.enum(QUOTE_RESPONSES),
        message: z.string().trim().max(1000).optional().or(z.literal("")),
      })
      .refine((d) => d.number || d.token, "Request not found")
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { recordQuoteResponse } = await import("@/lib/quotations.server");
    const { myRequestRows } = await import("@/lib/requests.server");
    const { isMissingSchema } = await import("@/lib/db-compat");
    const { notify } = await import("@/lib/notify.server");

    let row: CustomRow | null = null;
    if (data.token) {
      const { data: found, error } = await supabaseAdmin
        .from("custom_orders")
        .select("*")
        .eq("tracking_token", data.token)
        .maybeSingle();
      if (error && !isMissingSchema(error)) throw new Error(error.message);
      row = found ?? null;
    } else if (data.number && context.userId) {
      const rows = await myRequestRows(supabaseAdmin, context.userId, context.email ?? "");
      row = rows.find((r) => r.request_number === data.number) ?? null;
    }
    if (!row) throw new Error("Request not found");

    const quote = await recordQuoteResponse(
      supabaseAdmin,
      row,
      data.quoteId,
      data.response,
      data.message ?? "",
    );
    await supabaseAdmin.from("custom_orders").update({ status: data.response }).eq("id", row.id);

    const verb =
      data.response === "accepted"
        ? "accepted"
        : data.response === "rejected"
          ? "declined"
          : "asked to change";
    await notify({
      audience: "staff",
      type: `quote_${data.response}`,
      title: `${row.full_name} ${verb} quote ${quote.number}`,
      body: data.message || null,
      link: "/admin/custom-orders",
      entity: "custom_order",
      entityId: row.id,
    });
    return { ok: true, quote };
  });
