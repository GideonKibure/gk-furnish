import { isMissingSchema } from "@/lib/db-compat";
import { SITE } from "@/config/site";
import type { Json } from "@/integrations/supabase/types";
import {
  planReminders,
  type ReminderAction,
  type ReminderConfig,
  type ReminderOrder,
  type ReminderQuote,
  type ReminderRequest,
} from "@/lib/reminders";

type SupabaseAdmin = Awaited<typeof import("@/integrations/supabase/client.server")>["supabaseAdmin"];

const MIGRATION = "0028_reminders.sql";

function manualPayment(status: string, metadata: Json) {
  if (status !== "pending" && status !== "needs_review") return false;
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return false;
  return metadata["source"] === "manual";
}

function configFrom(row: { reminders_enabled?: boolean | null; unpaid_expiry_days?: number | null; quote_unpaid_expiry_days?: number | null } | null): ReminderConfig {
  return {
    enabled: row?.reminders_enabled === true,
    orderExpiryDays: row && "unpaid_expiry_days" in row ? row.unpaid_expiry_days : undefined,
    quoteExpiryDays: row && "quote_unpaid_expiry_days" in row ? row.quote_unpaid_expiry_days : undefined,
  };
}

async function loadSnapshot(supabaseAdmin: SupabaseAdmin, now: Date) {
  const settings = await supabaseAdmin
    .from("site_settings")
    .select("reminders_enabled, unpaid_expiry_days, quote_unpaid_expiry_days")
    .eq("id", 1)
    .maybeSingle();
  let config: ReminderConfig = { enabled: false, orderExpiryDays: undefined, quoteExpiryDays: undefined };
  if (settings.error && isMissingSchema(settings.error)) {
    const fallback = await supabaseAdmin.from("site_settings").select("unpaid_expiry_days").eq("id", 1).maybeSingle();
    config = {
      enabled: false,
      orderExpiryDays: fallback.error ? undefined : fallback.data?.unpaid_expiry_days,
      quoteExpiryDays: undefined,
    };
  } else if (settings.error) {
    throw new Error(settings.error.message);
  } else {
    config = configFrom(settings.data);
  }

  const withHold = await supabaseAdmin
    .from("orders")
    .select("id,order_number,status,created_at,amount_paid,email,phone,customer_name,tracking_token,auto_cancel_disabled")
    .in("status", ["pending", "awaiting_payment"]);
  type LoadedOrder = {
    id: string;
    order_number: string;
    status: string;
    created_at: string;
    amount_paid: number;
    email: string | null;
    phone: string;
    customer_name: string;
    tracking_token: string;
    auto_cancel_disabled?: boolean;
  };
  let orderRows: LoadedOrder[] = [];
  if (!withHold.error) {
    orderRows = withHold.data ?? [];
  } else if (isMissingSchema(withHold.error)) {
    const fallback = await supabaseAdmin
      .from("orders")
      .select("id,order_number,status,created_at,amount_paid,email,phone,customer_name,tracking_token")
      .in("status", ["pending", "awaiting_payment"]);
    if (fallback.error) throw new Error(fallback.error.message);
    orderRows = fallback.data ?? [];
  } else {
    throw new Error(withHold.error.message);
  }

  const orderIds = orderRows.map((order) => order.id);
  const paymentsResult = orderIds.length
    ? await supabaseAdmin.from("payments").select("id,order_id,status,created_at,metadata").in("order_id", orderIds)
    : { data: [], error: null };
  if (paymentsResult.error) throw new Error(paymentsResult.error.message);

  const requestsResult = await supabaseAdmin
    .from("custom_orders")
    .select("id,request_number,status,created_at,phone,full_name")
    .in("status", ["pending", "changes_requested", "quoted"]);
  if (requestsResult.error) throw new Error(requestsResult.error.message);

  const quotesResult = await supabaseAdmin
    .from("quotations")
    .select("id,quote_number,status,created_at,details,custom_order_id")
    .eq("status", "sent");
  const quotes = quotesResult.error && isMissingSchema(quotesResult.error) ? [] : quotesResult.data ?? [];
  if (quotesResult.error && !isMissingSchema(quotesResult.error)) throw new Error(quotesResult.error.message);

  const requestById = new Map((requestsResult.data ?? []).map((request) => [request.id, request]));
  const orders: ReminderOrder[] = orderRows.map((order) => ({
    id: order.id,
    number: order.order_number,
    status: order.status,
    createdAt: order.created_at,
    paid: Number(order.amount_paid),
    email: order.email,
    phone: order.phone,
    name: order.customer_name,
    trackingUrl: order.tracking_token ? `${SITE.url}/track/${order.tracking_token}` : null,
    autoCancelDisabled: order.auto_cancel_disabled === true,
    payments: (paymentsResult.data ?? [])
      .filter((payment) => payment.order_id === order.id)
      .map((payment) => ({
        id: payment.id,
        status: payment.status,
        createdAt: payment.created_at,
        manual: manualPayment(payment.status, payment.metadata),
      })),
  }));
  const requests: ReminderRequest[] = (requestsResult.data ?? [])
    .filter((request) => request.status === "pending" || request.status === "changes_requested")
    .map((request) => ({
      id: request.id,
      number: request.request_number,
      status: request.status,
      createdAt: request.created_at,
      phone: request.phone,
      name: request.full_name,
    }));
  const quoteRows: ReminderQuote[] = quotes.flatMap((quote) => {
    const request = requestById.get(quote.custom_order_id);
    const details = quote.details && typeof quote.details === "object" && !Array.isArray(quote.details) ? quote.details : {};
    const email = typeof details["email"] === "string" ? details["email"] : null;
    const phone = typeof details["phone"] === "string" ? details["phone"] : request?.phone ?? "";
    const name = typeof details["customerName"] === "string" ? details["customerName"] : request?.full_name ?? "";
    return [
      {
        id: quote.id,
        number: quote.quote_number,
        status: quote.status,
        createdAt: quote.created_at,
        email,
        phone,
        name,
        requestStatus: request?.status ?? "quoted",
        requestId: quote.custom_order_id,
      },
    ];
  });

  const sentResult = await supabaseAdmin.from("reminder_sends").select("kind,entity,entity_id");
  return {
    config,
    now,
    orders,
    requests,
    quotes: quoteRows,
    sentReady: !sentResult.error,
    sent: (sentResult.data ?? []).map((row) => `${row.kind}:${row.entity}:${row.entity_id}`),
    sentError: sentResult.error,
  };
}

async function claim(supabaseAdmin: SupabaseAdmin, action: ReminderAction) {
  const { error } = await supabaseAdmin.from("reminder_sends").insert({
    kind: action.kind,
    entity: action.entity,
    entity_id: action.entityId,
  });
  if (!error) return true;
  if (error.code === "23505") return false;
  throw error;
}

async function releaseClaim(supabaseAdmin: SupabaseAdmin, action: ReminderAction) {
  await supabaseAdmin.from("reminder_sends").delete().eq("kind", action.kind).eq("entity", action.entity).eq("entity_id", action.entityId);
}

async function perform(supabaseAdmin: SupabaseAdmin, action: ReminderAction) {
  if (action.effect === "notify_owner") {
    const { notify } = await import("@/lib/notify.server");
    const body = action.whatsappUrl ? `${action.body} WhatsApp: ${action.whatsappUrl}` : action.body;
    return notify({
      audience: "staff",
      type: action.kind,
      title: action.title,
      body,
      link: action.link,
      entity: action.entity,
      entityId: action.entityId,
    });
  }
  if (action.effect === "email_customer") {
    const { sendCustomerMessage } = await import("@/lib/customer-message.server");
    const result = await sendCustomerMessage({
      email: action.email,
      subject: action.title,
      paragraphs: [action.body],
      link: action.link,
    });
    return result.sent;
  }
  if (action.effect === "flag_owner") {
    const { flagOrderNeedsAttention } = await import("@/lib/order-payments.server");
    await flagOrderNeedsAttention(supabaseAdmin, action.entityId, action.body);
    return true;
  }
  if (action.effect === "cancel_order") {
    const { data: order } = await supabaseAdmin
      .from("orders")
      .select("id,order_number,status,amount_paid,user_id")
      .eq("id", action.entityId)
      .maybeSingle();
    if (!order) return false;
    const { data: payments } = await supabaseAdmin.from("payments").select("status").eq("order_id", order.id);
    const blocked = (payments ?? []).some((payment) => payment.status === "pending" || payment.status === "needs_review");
    if (blocked || Math.round(Number(order.amount_paid)) > 0) return false;
    if (!["pending", "awaiting_payment"].includes(order.status)) return false;
    const { releaseReservedStock } = await import("@/lib/order-payments.server");
    await releaseReservedStock(supabaseAdmin, order.id);
    const { cancelOrderRecord } = await import("@/lib/order-cancel.server");
    const result = await cancelOrderRecord(supabaseAdmin, order, action.body, { userId: null, label: "System" });
    return result.ok;
  }
  const { data: quote } = await supabaseAdmin.from("quotations").select("custom_order_id").eq("id", action.entityId).maybeSingle();
  if (!quote) return false;
  const { error } = await supabaseAdmin
    .from("custom_orders")
    .update({ status: "cancelled", cancel_reason: action.body })
    .eq("id", quote.custom_order_id)
    .in("status", ["quoted", "pending"]);
  if (error) return false;
  await supabaseAdmin.from("quotations").update({ status: "expired" }).eq("id", action.entityId).eq("status", "sent");
  const { notify } = await import("@/lib/notify.server");
  await notify({
    audience: "staff",
    type: "quote_expired",
    title: action.title,
    body: action.body,
    link: action.link,
    entity: "quotation",
    entityId: action.entityId,
  });
  return true;
}

/** Plan, and unless this is a dry run, carry out each new action once. */
export async function runReminders(supabaseAdmin: SupabaseAdmin, input: { dryRun: boolean; now?: Date }) {
  const now = input.now ?? new Date();
  const loaded = await loadSnapshot(supabaseAdmin, now);
  if (!input.dryRun && loaded.sentError) {
    if (isMissingSchema(loaded.sentError)) return { ok: true as const, skipped: true as const, reason: MIGRATION, actions: [] };
    throw new Error(loaded.sentError.message);
  }
  const actions = planReminders({
    config: loaded.config,
    now,
    sent: loaded.sent,
    orders: loaded.orders,
    requests: loaded.requests,
    quotes: loaded.quotes,
  });
  if (input.dryRun || !loaded.config.enabled) {
    return { ok: true as const, dryRun: input.dryRun, skipped: !loaded.config.enabled, actions };
  }
  const done: string[] = [];
  for (const action of actions) {
    let claimed = false;
    try {
      claimed = await claim(supabaseAdmin, action);
      if (!claimed) continue;
      const worked = await perform(supabaseAdmin, action);
      if (!worked) {
        await releaseClaim(supabaseAdmin, action);
        continue;
      }
      done.push(action.key);
    } catch (err) {
      if (claimed) await releaseClaim(supabaseAdmin, action);
      if (isMissingSchema(err as { code?: string; message?: string })) {
        return { ok: true as const, skipped: true as const, reason: MIGRATION, actions: done };
      }
      throw err;
    }
  }
  return { ok: true as const, dryRun: false as const, skipped: false, actions: done };
}

/** Owner follow-ups that are already late, for the dashboard badge. */
export async function overdueFollowUps(supabaseAdmin: SupabaseAdmin) {
  const loaded = await loadSnapshot(supabaseAdmin, new Date());
  const actions = planReminders({
    config: { ...loaded.config, enabled: true },
    now: loaded.now,
    sent: [],
    orders: loaded.orders,
    requests: loaded.requests,
    quotes: loaded.quotes,
  }).filter((action) => action.effect === "notify_owner");
  return {
    count: actions.length,
    rows: actions.slice(0, 6).map((action) => ({
      id: action.key,
      title: action.title,
      link: action.link,
    })),
  };
}
