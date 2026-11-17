import { createServerFn } from "@tanstack/react-start";
import { isMissingSchema } from "@/lib/db-compat";
import { balanceDue } from "@/lib/payment-policy";
import type { CustomRequestView } from "@/lib/requests.server";
import { PublicTrackedOrder, savedCompletionHours, TrackingInput, type TrackedOrder } from "@/lib/track-next";

export type { TrackedOrder };

export type TrackingResult =
  | { kind: "order"; order: TrackedOrder }
  | { kind: "request"; request: CustomRequestView }
  | { kind: "none"; available: boolean };

function mask(phone: string) {
  return phone.length > 6 ? `${phone.slice(0, 4)}••••${phone.slice(-3)}` : "••••";
}

/**
 * Order or custom-request progress for a private tracking link (guest checkout).
 * Tokens are random UUIDs; no personal details beyond the first name and a masked phone are returned.
 */
export const getTracking = createServerFn({ method: "GET" })
  .inputValidator((d) => TrackingInput.parse(d))
  .handler(async ({ data }): Promise<TrackingResult> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { requestByToken } = await import("@/lib/requests.server");

    const { data: order, error } = await supabaseAdmin
      .from("orders")
      .select(
        "*, order_items(product_name,quantity,unit_price,material,size,color), payments(amount,status,purpose,receipt_number,provider,created_at,updated_at), order_status_history(status,created_at)",
      )
      .eq("tracking_token", data.token)
      .is("archived_at", null)
      .maybeSingle();
    if (error) {
      if (isMissingSchema(error)) return { kind: "none", available: false };
      throw new Error(error.message);
    }

    if (order) {
      const { reconcileOpenPalmPayments, reconcileOpenSnippePayments } = await import("@/lib/order-payments.server");
      await reconcileOpenPalmPayments(supabaseAdmin, { orderId: order.id });
      await reconcileOpenSnippePayments(supabaseAdmin, { orderId: order.id });
      const { expireUnconfirmedPrompt } = await import("@/lib/order-payments.server");
      const { promptWindowClosed } = await import("@/lib/prompt-window");
      const { data: openPayments } = await supabaseAdmin
        .from("payments")
        .select("id,created_at")
        .eq("order_id", order.id)
        .eq("status", "pending");
      for (const row of openPayments ?? []) {
        if (promptWindowClosed(row.created_at, Date.now())) await expireUnconfirmedPrompt(supabaseAdmin, row.id);
      }
      const { data: fresh } = await supabaseAdmin
        .from("orders")
        .select(
          "*, order_items(product_name,quantity,unit_price,material,size,color), payments(amount,status,purpose,receipt_number,provider,created_at,updated_at), order_status_history(status,created_at)",
        )
        .eq("id", order.id)
        .maybeSingle();
      const current = fresh ?? order;
      const total = Number(current.total_amount);
      const paid = Number(current.amount_paid);
      const full = await supabaseAdmin.from("site_settings").select("order_completion_hours, collection_address, location").eq("id", 1).maybeSingle();
      let completionHours: number | null = null;
      let collectionAddress: string | null = null;
      if (!full.error && full.data) {
        const place = (full.data.collection_address || full.data.location || "").trim();
        completionHours = savedCompletionHours(full.data.order_completion_hours);
        collectionAddress = place || null;
      } else if (full.error && isMissingSchema(full.error)) {
        const place = await supabaseAdmin.from("site_settings").select("location").eq("id", 1).maybeSingle();
        collectionAddress = place.data?.location?.trim() || null;
      }
      return {
        kind: "order",
        order: PublicTrackedOrder.parse({
          number: current.order_number,
          status: current.status,
          createdAt: current.created_at,
          customerName: current.customer_name.split(/\s+/)[0] ?? "",
          phoneMasked: mask(current.phone),
          fulfilmentMethod: current.fulfilment_method ?? "delivery",
          location: current.delivery_location,
          neededBy: current.needed_by,
          subtotal: Number(current.subtotal_amount ?? current.total_amount),
          deliveryFee: current.delivery_fee == null ? null : Number(current.delivery_fee),
          deliveryFeeStatus: current.delivery_fee_status ?? "confirmed",
          total,
          paid,
          balance: balanceDue(total, paid),
          advancePercent: current.advance_percent,
          advanceRequired: Number(current.advance_required),
          paymentStatus: current.payment_status,
          specsAgreed: Boolean(current.specs_agreed_at),
          items: (current.order_items ?? []).map((i) => ({
            product_name: i.product_name,
            quantity: i.quantity,
            unit_price: Number(i.unit_price),
            material: i.material,
            size: i.size,
            color: i.color,
          })),
          payments: (current.payments ?? [])
            .map((p) => ({
              amount: Number(p.amount),
              status: p.status,
              purpose: p.purpose,
              receipt_number: p.receipt_number,
              provider: p.provider,
              created_at: p.created_at,
              updated_at: p.updated_at,
            }))
            .sort((a, b) => a.created_at.localeCompare(b.created_at)),
          history: (current.order_status_history ?? [])
            .map((h) => ({ status: h.status, created_at: h.created_at }))
            .sort((a, b) => a.created_at.localeCompare(b.created_at)),
          collectionAddress,
          completionHours,
        }),
      };
    }

    const request = await requestByToken(supabaseAdmin, data.token);
    if (request) return { kind: "request", request };
    return { kind: "none", available: true };
  });
