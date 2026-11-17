import { PROMPT_TIMEOUT_REASON } from "./prompt-window.ts";
import { buildWhatsAppLink } from "./whatsapp.ts";

/** Shop orders use 3 days only when the column is not in the database yet. Blank or 0 stays off. */
export const ORDER_EXPIRY_DAYS_WHEN_MISSING = 3;
/** Quotations use 7 days only when the column is not in the database yet. Blank or 0 stays off. */
export const QUOTE_EXPIRY_DAYS_WHEN_MISSING = 7;
export const UNPAID_EXPIRED_REASON = "Unpaid: expired";

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;
/** Africa/Dar_es_Salaam is UTC+3 all year. */
const DAR_OFFSET_MS = 3 * HOUR_MS;
const BUSINESS_OPEN = 7;
const BUSINESS_CLOSE = 20;

export type ReminderKind =
  | "custom_unanswered_2h"
  | "custom_unanswered_24h"
  | "manual_payment_1h"
  | "manual_payment_4h"
  | "order_unpaid_24h"
  | "order_unpaid_last_day"
  | "quote_unaccepted_3d"
  | "partial_paid_hold"
  | "cancel_unpaid_order"
  | "cancel_unpaid_quote";

export type ReminderEffect = "notify_owner" | "email_customer" | "cancel_order" | "cancel_quote" | "flag_owner";

export type ReminderAction = {
  key: string;
  kind: ReminderKind;
  effect: ReminderEffect;
  entity: "custom_order" | "payment" | "order" | "quotation";
  entityId: string;
  title: string;
  body: string;
  link: string;
  email: string | null;
  whatsappUrl: string | null;
  /** Calendar date in Dar es Salaam, included only when a real expiry is set. */
  cancelOn: string | null;
};

export type ReminderConfig = {
  enabled: boolean;
  /** Undefined means the column is missing. Null or 0 means auto-cancel is off. */
  orderExpiryDays: number | null | undefined;
  quoteExpiryDays: number | null | undefined;
};

export type ReminderOrder = {
  id: string;
  number: string;
  status: string;
  createdAt: string;
  paid: number;
  email: string | null;
  phone: string;
  name: string;
  trackingUrl: string | null;
  autoCancelDisabled: boolean;
  payments: { id: string; status: string; createdAt: string; manual: boolean }[];
};

export type ReminderRequest = {
  id: string;
  number: string;
  status: string;
  createdAt: string;
  phone: string;
  name: string;
};

export type ReminderQuote = {
  id: string;
  number: string;
  status: string;
  createdAt: string;
  email: string | null;
  phone: string;
  name: string;
  requestStatus: string;
  requestId: string;
};

export type ReminderSnapshot = {
  config: ReminderConfig;
  now: Date;
  sent: readonly string[];
  orders: readonly ReminderOrder[];
  requests: readonly ReminderRequest[];
  quotes: readonly ReminderQuote[];
};

const OPEN_PAYMENT = new Set(["pending", "needs_review"]);
const UNANSWERED_REQUEST = new Set(["pending", "changes_requested"]);
const PAYABLE_ORDER = new Set(["pending", "awaiting_payment"]);

/** Resolved day count. Null means do not auto-cancel. */
export function expiryDays(value: number | null | undefined, whenMissing: number): number | null {
  if (value === undefined) return whenMissing;
  if (value === null || !Number.isFinite(value) || value <= 0) return null;
  return Math.round(value);
}

/** Milliseconds between two instants that fall inside 07:00–20:00 in Dar es Salaam. */
export function businessMillis(from: Date, to: Date): number {
  const start = from.getTime();
  const end = to.getTime();
  if (end <= start) return 0;
  const startLocal = start + DAR_OFFSET_MS;
  const endLocal = end + DAR_OFFSET_MS;
  const dayStart = Date.UTC(
    new Date(startLocal).getUTCFullYear(),
    new Date(startLocal).getUTCMonth(),
    new Date(startLocal).getUTCDate(),
  );
  let total = 0;
  for (let day = dayStart; day < endLocal; day += DAY_MS) {
    const open = day + BUSINESS_OPEN * HOUR_MS;
    const close = day + BUSINESS_CLOSE * HOUR_MS;
    const overlap = Math.min(endLocal, close) - Math.max(startLocal, open);
    if (overlap > 0) total += overlap;
  }
  return total;
}

export function formatDarDate(date: Date): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Africa/Dar_es_Salaam",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
}

export function reopenDecision(input: {
  status: string;
  cancelReason: string | null;
  paid: number;
  stockOk: boolean;
}): "reopen" | "flag" | "ignore" {
  if (input.status !== "cancelled") return "ignore";
  if (input.cancelReason !== UNPAID_EXPIRED_REASON && input.cancelReason !== PROMPT_TIMEOUT_REASON) {
    return "ignore";
  }
  if (Math.round(input.paid) <= 0) return "ignore";
  return input.stockOk ? "reopen" : "flag";
}

function sentKey(kind: ReminderKind, entity: ReminderAction["entity"], entityId: string) {
  return `${kind}:${entity}:${entityId}`;
}

function ownerWhatsApp(phone: string, text: string) {
  const url = buildWhatsAppLink({ number: phone, text });
  return url.includes("wa.me/") && !url.endsWith("wa.me/") ? url : null;
}

function push(actions: ReminderAction[], sent: Set<string>, action: ReminderAction) {
  if (sent.has(action.key)) return;
  actions.push(action);
}

/**
 * What this run would send or cancel. Already-sent keys are skipped.
 * A disabled feature returns nothing, including cancellations.
 */
export function planReminders(snapshot: ReminderSnapshot): ReminderAction[] {
  if (!snapshot.config.enabled) return [];
  const now = snapshot.now.getTime();
  const sent = new Set(snapshot.sent);
  const actions: ReminderAction[] = [];
  const orderDays = expiryDays(snapshot.config.orderExpiryDays, ORDER_EXPIRY_DAYS_WHEN_MISSING);
  const quoteDays = expiryDays(snapshot.config.quoteExpiryDays, QUOTE_EXPIRY_DAYS_WHEN_MISSING);

  for (const request of snapshot.requests) {
    if (!UNANSWERED_REQUEST.has(request.status)) continue;
    const created = new Date(request.createdAt).getTime();
    if (!Number.isFinite(created)) continue;
    const waiting = `Request ${request.number} from ${request.name} is still waiting for a reply.`;
    const text = `Hello ${request.name}, this is GK Furnish about request ${request.number}.`;
    if (businessMillis(new Date(created), snapshot.now) >= 2 * HOUR_MS) {
      push(actions, sent, {
        key: sentKey("custom_unanswered_2h", "custom_order", request.id),
        kind: "custom_unanswered_2h",
        effect: "notify_owner",
        entity: "custom_order",
        entityId: request.id,
        title: `Unanswered for 2 hours: ${request.number}`,
        body: waiting,
        link: "/admin/custom-orders",
        email: null,
        whatsappUrl: ownerWhatsApp(request.phone, text),
        cancelOn: null,
      });
    }
    if (now - created >= DAY_MS) {
      push(actions, sent, {
        key: sentKey("custom_unanswered_24h", "custom_order", request.id),
        kind: "custom_unanswered_24h",
        effect: "notify_owner",
        entity: "custom_order",
        entityId: request.id,
        title: `Unanswered for 24 hours: ${request.number}`,
        body: waiting,
        link: "/admin/custom-orders",
        email: null,
        whatsappUrl: ownerWhatsApp(request.phone, text),
        cancelOn: null,
      });
    }
  }

  for (const order of snapshot.orders) {
    const created = new Date(order.createdAt).getTime();
    if (!Number.isFinite(created)) continue;
    const age = now - created;
    for (const payment of order.payments) {
      if (!payment.manual) continue;
      const waiting = new Date(payment.createdAt).getTime();
      if (!Number.isFinite(waiting)) continue;
      const elapsed = now - waiting;
      const body = `Payment on order ${order.number} is waiting for you to confirm it.`;
      if (elapsed >= HOUR_MS) {
        push(actions, sent, {
          key: sentKey("manual_payment_1h", "payment", payment.id),
          kind: "manual_payment_1h",
          effect: "notify_owner",
          entity: "payment",
          entityId: payment.id,
          title: `Confirm payment: ${order.number}`,
          body,
          link: "/admin/payments",
          email: null,
          whatsappUrl: null,
          cancelOn: null,
        });
      }
      if (elapsed >= 4 * HOUR_MS) {
        push(actions, sent, {
          key: sentKey("manual_payment_4h", "payment", payment.id),
          kind: "manual_payment_4h",
          effect: "notify_owner",
          entity: "payment",
          entityId: payment.id,
          title: `Payment still unconfirmed: ${order.number}`,
          body,
          link: "/admin/payments",
          email: null,
          whatsappUrl: null,
          cancelOn: null,
        });
      }
    }

    if (!PAYABLE_ORDER.has(order.status)) continue;
    const paid = Math.round(order.paid);
    const openPayment = order.payments.some((payment) => OPEN_PAYMENT.has(payment.status));
    const cancelAt = orderDays == null ? null : created + orderDays * DAY_MS;
    const cancelOn = cancelAt == null ? null : formatDarDate(new Date(cancelAt));

    if (order.email && age >= DAY_MS && (cancelAt == null || now < cancelAt)) {
      push(actions, sent, {
        key: sentKey("order_unpaid_24h", "order", order.id),
        kind: "order_unpaid_24h",
        effect: "email_customer",
        entity: "order",
        entityId: order.id,
        title: `Payment not confirmed for ${order.number}`,
        body: cancelOn
          ? `No payment is confirmed yet. This order will be cancelled on ${cancelOn} if it stays unpaid.`
          : "No payment is confirmed yet. Open your order page to pay, or tell us if you still want this piece.",
        link: order.trackingUrl ?? "/track",
        email: order.email,
        whatsappUrl: null,
        cancelOn,
      });
    }
    if (order.email && cancelAt != null && now >= cancelAt - DAY_MS && now < cancelAt) {
      push(actions, sent, {
        key: sentKey("order_unpaid_last_day", "order", order.id),
        kind: "order_unpaid_last_day",
        effect: "email_customer",
        entity: "order",
        entityId: order.id,
        title: `Last day to pay for ${order.number}`,
        body: `No payment is confirmed yet. This order will be cancelled on ${cancelOn} if it stays unpaid.`,
        link: order.trackingUrl ?? "/track",
        email: order.email,
        whatsappUrl: null,
        cancelOn,
      });
    }

    if (cancelAt == null || now < cancelAt) continue;
    if (paid > 0) {
      push(actions, sent, {
        key: sentKey("partial_paid_hold", "order", order.id),
        kind: "partial_paid_hold",
        effect: "flag_owner",
        entity: "order",
        entityId: order.id,
        title: `Part-paid order was not cancelled: ${order.number}`,
        body: `${order.number} is past the unpaid window but money has been confirmed. It was not cancelled.`,
        link: "/admin/orders",
        email: null,
        whatsappUrl: null,
        cancelOn,
      });
      continue;
    }
    if (openPayment || order.autoCancelDisabled) continue;
    push(actions, sent, {
      key: sentKey("cancel_unpaid_order", "order", order.id),
      kind: "cancel_unpaid_order",
      effect: "cancel_order",
      entity: "order",
      entityId: order.id,
      title: `Cancel unpaid order ${order.number}`,
      body: UNPAID_EXPIRED_REASON,
      link: "/admin/orders",
      email: order.email,
      whatsappUrl: null,
      cancelOn,
    });
  }

  for (const quote of snapshot.quotes) {
    if (quote.status !== "sent") continue;
    if (["cancelled", "rejected", "accepted", "completed", "in_progress"].includes(quote.requestStatus)) continue;
    const created = new Date(quote.createdAt).getTime();
    if (!Number.isFinite(created)) continue;
    const age = now - created;
    if (quote.email && age >= 3 * DAY_MS && (quoteDays == null || age < quoteDays * DAY_MS)) {
      push(actions, sent, {
        key: sentKey("quote_unaccepted_3d", "quotation", quote.id),
        kind: "quote_unaccepted_3d",
        effect: "email_customer",
        entity: "quotation",
        entityId: quote.id,
        title: `Quotation ${quote.number} is waiting`,
        body: "Your quotation has been waiting for three days. Tell us if you want to go ahead.",
        link: "/custom-order",
        email: quote.email,
        whatsappUrl: null,
        cancelOn: quoteDays == null ? null : formatDarDate(new Date(created + quoteDays * DAY_MS)),
      });
    }
    if (quoteDays != null && age >= quoteDays * DAY_MS && ["quoted", "pending"].includes(quote.requestStatus)) {
      push(actions, sent, {
        key: sentKey("cancel_unpaid_quote", "quotation", quote.id),
        kind: "cancel_unpaid_quote",
        effect: "cancel_quote",
        entity: "quotation",
        entityId: quote.id,
        title: `Cancel unanswered quotation ${quote.number}`,
        body: UNPAID_EXPIRED_REASON,
        link: "/admin/custom-orders",
        email: quote.email,
        whatsappUrl: null,
        cancelOn: formatDarDate(new Date(created + quoteDays * DAY_MS)),
      });
    }
  }

  return actions;
}
