import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { isMissingSchema } from "@/lib/db-compat";

type SupabaseAdmin = Awaited<
  typeof import("@/integrations/supabase/client.server")
>["supabaseAdmin"];

/** Orders count as received once they are delivered or completed. */
const RECEIVED_STATUSES = ["delivered", "completed"];

async function eligibility(supabaseAdmin: SupabaseAdmin, userId: string, productId: string) {
  const existing = await supabaseAdmin
    .from("product_reviews")
    .select("id,status")
    .eq("product_id", productId)
    .eq("user_id", userId)
    .maybeSingle();
  if (existing.error) {
    if (isMissingSchema(existing.error)) return { available: false as const };
    throw new Error(existing.error.message);
  }
  if (existing.data)
    return { available: true as const, eligible: false, already: true, orderId: null };

  const { data: orders, error } = await supabaseAdmin
    .from("orders")
    .select("id,order_items!inner(product_id)")
    .eq("user_id", userId)
    .in("status", RECEIVED_STATUSES)
    .eq("order_items.product_id", productId)
    .order("created_at", { ascending: false })
    .limit(1);
  if (error) throw new Error(error.message);
  const orderId = orders?.[0]?.id ?? null;
  return { available: true as const, eligible: Boolean(orderId), already: false, orderId };
}

/** Whether the signed-in customer may review this product (verified buyer, not reviewed yet). */
export const getReviewEligibility = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ productId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const result = await eligibility(supabaseAdmin, context.userId, data.productId);
    if (!result.available) return { available: false, eligible: false, already: false };
    return { available: true, eligible: result.eligible, already: result.already };
  });

export const submitReview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        productId: z.string().uuid(),
        rating: z.number().int().min(1).max(5),
        title: z.string().trim().max(120).optional().or(z.literal("")),
        body: z.string().trim().min(3).max(2000),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { notify } = await import("@/lib/notify.server");
    const result = await eligibility(supabaseAdmin, context.userId, data.productId);
    if (!result.available) throw new Error("Reviews are not switched on yet.");
    if (result.already) throw new Error("You have already reviewed this product.");
    if (!result.eligible)
      throw new Error("Only customers who have received this product can review it.");

    const { data: profile } = await supabaseAdmin
      .from("customer_profiles")
      .select("full_name")
      .eq("user_id", context.userId)
      .maybeSingle();
    const email = typeof context.claims["email"] === "string" ? context.claims["email"] : "";
    const fullName = profile?.full_name?.trim() || email.split("@")[0] || "Customer";
    const parts = fullName.split(/\s+/);
    const authorName =
      parts.length > 1 ? `${parts[0]} ${parts[parts.length - 1]?.[0] ?? ""}.` : fullName;

    const { data: row, error } = await supabaseAdmin
      .from("product_reviews")
      .insert({
        product_id: data.productId,
        user_id: context.userId,
        order_id: result.orderId,
        rating: data.rating,
        title: data.title || null,
        body: data.body,
        author_name: authorName.slice(0, 60),
        status: "pending",
      })
      .select("id")
      .single();
    if (error || !row) throw new Error(error?.message ?? "Could not save review");

    const { data: product } = await supabaseAdmin
      .from("products")
      .select("name")
      .eq("id", data.productId)
      .maybeSingle();
    await notify({
      audience: "staff",
      type: "review_submitted",
      title: `New ${data.rating}★ review to approve`,
      body: `${authorName} reviewed ${product?.name ?? "a product"}.`,
      link: "/admin/products",
      entity: "product_review",
      entityId: row.id,
    });
    return { ok: true };
  });
