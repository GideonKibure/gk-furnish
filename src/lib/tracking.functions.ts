import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { isMissingSchema } from "@/lib/db-compat";
import { balanceDue } from "@/lib/payment-policy";
import type { CustomRequestView } from "@/lib/requests.server";

export type TrackedOrder = {
  number: string;
  status: string;
  createdAt: string;
  customerName: string;
  phoneMasked: string;
  fulfilmentMethod: string;
  location: string;
  neededBy: string | null;
  subtotal: number;
  deliveryFee: number | null;
  deliveryFeeStatus: string;
  total: number;
  paid: number;
  balance: number;
  advancePercent: number;
  advanceRequired: number;
  paymentStatus: string;
  specsAgreed: boolean;
  items: {
    product_name: string;
    quantity: number;
    unit_price: number;
    material: string | null;
    size: string | null;
    color: string | null;
  }[];
  payments: {
    amount: number;
    status: string;
    purpose: string;
    receipt_number: string | null;
    provider: string | null;
    created_at: string;
    updated_at: string;
  }[];
  history: { status: string; created_at: string }[];
};

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
  .inputValidator((d) => z.object({ token: z.string().uuid() }).parse(d))
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
      const total = Number(order.total_amount);
      const paid = Number(order.amount_paid);
      return {
        kind: "order",
        order: {
          number: order.order_number,
          status: order.status,
          createdAt: order.created_at,
          customerName: order.customer_name.split(/\s+/)[0] ?? "",
          phoneMasked: mask(order.phone),
          fulfilmentMethod: order.fulfilment_method ?? "delivery",
          location: order.delivery_location,
          neededBy: order.needed_by,
          subtotal: Number(order.subtotal_amount ?? order.total_amount),
          deliveryFee: order.delivery_fee == null ? null : Number(order.delivery_fee),
          deliveryFeeStatus: order.delivery_fee_status ?? "confirmed",
          total,
          paid,
          balance: balanceDue(total, paid),
          advancePercent: order.advance_percent,
          advanceRequired: Number(order.advance_required),
          paymentStatus: order.payment_status,
          specsAgreed: Boolean(order.specs_agreed_at),
          items: (order.order_items ?? []).map((i) => ({ ...i, unit_price: Number(i.unit_price) })),
          payments: (order.payments ?? [])
            .filter((p) => p.status === "completed")
            .map((p) => ({ ...p, amount: Number(p.amount) }))
            .sort((a, b) => a.created_at.localeCompare(b.created_at)),
          history: (order.order_status_history ?? [])
            .map((h) => ({ status: h.status, created_at: h.created_at }))
            .sort((a, b) => a.created_at.localeCompare(b.created_at)),
        },
      };
    }

    const request = await requestByToken(supabaseAdmin, data.token);
    if (request) return { kind: "request", request };
    return { kind: "none", available: true };
  });
