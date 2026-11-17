import assert from "node:assert/strict";
import test from "node:test";
import { PROMPT_TIMEOUT_REASON } from "./prompt-window.ts";
import {
  businessMillis,
  expiryDays,
  planReminders,
  reopenDecision,
  UNPAID_EXPIRED_REASON,
  type ReminderSnapshot,
} from "./reminders.ts";

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

function snapshot(over: Partial<ReminderSnapshot> & Pick<ReminderSnapshot, "now">): ReminderSnapshot {
  return {
    config: { enabled: true, orderExpiryDays: 3, quoteExpiryDays: 7 },
    sent: [],
    orders: [],
    requests: [],
    quotes: [],
    ...over,
  };
}

test("business hours count only 07:00 to 20:00 in Dar es Salaam", () => {
  const from = new Date("2026-11-16T16:00:00.000Z");
  const to = new Date("2026-11-17T05:00:00.000Z");
  assert.equal(businessMillis(from, to), 2 * HOUR);
  assert.equal(businessMillis(to, from), 0);
});

test("an unanswered request is reminded once at 2 business hours and again at 24 hours", () => {
  const createdAt = "2026-11-16T16:00:00.000Z";
  const request = {
    id: "req-1",
    number: "CR-1",
    status: "pending",
    createdAt,
    phone: "0692713993",
    name: "Asha",
  };
  const first = planReminders(snapshot({ now: new Date("2026-11-17T05:00:00.000Z"), requests: [request] }));
  assert.deepEqual(first.map((action) => action.kind), ["custom_unanswered_2h"]);
  assert.match(first[0]?.whatsappUrl ?? "", /^https:\/\/wa\.me\/255692713993\?text=/);

  const later = planReminders(snapshot({ now: new Date("2026-11-17T16:00:00.000Z"), requests: [request] }));
  assert.deepEqual(later.map((action) => action.kind), ["custom_unanswered_2h", "custom_unanswered_24h"]);

  const again = planReminders(
    snapshot({
      now: new Date("2026-11-17T16:00:00.000Z"),
      requests: [request],
      sent: later.map((action) => action.key),
    }),
  );
  assert.deepEqual(again, []);
});

test("a manual payment is reminded at 1 hour and 4 hours, once each", () => {
  const order = {
    id: "ord-1",
    number: "GK1",
    status: "pending",
    createdAt: "2026-11-17T06:00:00.000Z",
    paid: 0,
    email: null,
    phone: "255692713993",
    name: "Asha",
    trackingUrl: "https://gkfurnish.co.tz/track/token",
    autoCancelDisabled: false,
    payments: [{ id: "pay-1", status: "pending", createdAt: "2026-11-17T06:00:00.000Z", manual: true }],
  };
  const atOne = planReminders(snapshot({ now: new Date("2026-11-17T07:00:00.000Z"), orders: [order] }));
  assert.deepEqual(atOne.map((action) => action.kind), ["manual_payment_1h"]);
  const atFour = planReminders(snapshot({ now: new Date("2026-11-17T10:00:00.000Z"), orders: [order] }));
  assert.deepEqual(atFour.map((action) => action.kind), ["manual_payment_1h", "manual_payment_4h"]);
  const twice = planReminders(
    snapshot({ now: new Date("2026-11-17T10:00:00.000Z"), orders: [order], sent: atFour.map((action) => action.key) }),
  );
  assert.deepEqual(twice, []);
});

test("an unpaid order emails at 24 hours and on the last day, with the cancellation date", () => {
  const order = {
    id: "ord-2",
    number: "GK2",
    status: "awaiting_payment",
    createdAt: "2026-11-14T09:00:00.000Z",
    paid: 0,
    email: "asha@example.com",
    phone: "255692713993",
    name: "Asha",
    trackingUrl: "https://gkfurnish.co.tz/track/abc",
    autoCancelDisabled: false,
    payments: [],
  };
  const day = planReminders(snapshot({ now: new Date("2026-11-15T09:00:00.000Z"), orders: [order] }));
  assert.equal(day.length, 1);
  assert.equal(day[0]?.kind, "order_unpaid_24h");
  assert.equal(day[0]?.cancelOn, "17 November 2026");
  assert.match(day[0]?.body ?? "", /17 November 2026/);
  const last = planReminders(snapshot({ now: new Date("2026-11-16T09:00:00.000Z"), orders: [order] }));
  assert.deepEqual(last.map((action) => action.kind), ["order_unpaid_24h", "order_unpaid_last_day"]);
});

test("a pending or needs-review payment prevents cancel", () => {
  const base = {
    id: "ord-3",
    number: "GK3",
    status: "pending",
    createdAt: "2026-11-13T09:00:00.000Z",
    paid: 0,
    email: "asha@example.com",
    phone: "255692713993",
    name: "Asha",
    trackingUrl: null,
    autoCancelDisabled: false,
    payments: [{ id: "pay-2", status: "pending", createdAt: "2026-11-16T08:00:00.000Z", manual: false }],
  };
  const now = new Date("2026-11-16T09:00:00.000Z");
  assert.equal(planReminders(snapshot({ now, orders: [base] })).some((action) => action.effect === "cancel_order"), false);
  const review = {
    ...base,
    payments: [{ id: "pay-3", status: "needs_review", createdAt: "2026-11-16T08:00:00.000Z", manual: false }],
  };
  assert.equal(planReminders(snapshot({ now, orders: [review] })).some((action) => action.effect === "cancel_order"), false);
});

test("a part-paid order is flagged and not cancelled", () => {
  const actions = planReminders(
    snapshot({
      now: new Date("2026-11-16T09:00:00.000Z"),
      orders: [
        {
          id: "ord-4",
          number: "GK4",
          status: "pending",
          createdAt: "2026-11-13T09:00:00.000Z",
          paid: 1000,
          email: null,
          phone: "255692713993",
          name: "Asha",
          trackingUrl: null,
          autoCancelDisabled: false,
          payments: [],
        },
      ],
    }),
  );
  assert.deepEqual(actions.map((action) => action.effect), ["flag_owner"]);
});

test("auto-cancel stays off when the feature or the day count is off, and a held order is kept", () => {
  const order = {
    id: "ord-5",
    number: "GK5",
    status: "pending",
    createdAt: "2026-11-13T09:00:00.000Z",
    paid: 0,
    email: null,
    phone: "255692713993",
    name: "Asha",
    trackingUrl: null,
    autoCancelDisabled: false,
    payments: [],
  };
  const now = new Date("2026-11-16T09:00:00.000Z");
  const due = planReminders(snapshot({ now, orders: [order] }));
  assert.equal(due[0]?.effect, "cancel_order");
  assert.equal(due[0]?.body, UNPAID_EXPIRED_REASON);
  assert.deepEqual(planReminders(snapshot({ now, orders: [order], config: { enabled: false, orderExpiryDays: 3, quoteExpiryDays: 7 } })), []);
  assert.equal(
    planReminders(snapshot({ now, orders: [order], config: { enabled: true, orderExpiryDays: 0, quoteExpiryDays: 7 } })).some(
      (action) => action.effect === "cancel_order",
    ),
    false,
  );
  assert.equal(
    planReminders(snapshot({ now, orders: [order], config: { enabled: true, orderExpiryDays: null, quoteExpiryDays: 7 } })).some(
      (action) => action.effect === "cancel_order",
    ),
    false,
  );
  assert.equal(
    planReminders(snapshot({ now, orders: [{ ...order, autoCancelDisabled: true }] })).some((action) => action.effect === "cancel_order"),
    false,
  );
});

test("a second plan with the cancel already sent does nothing", () => {
  const order = {
    id: "ord-6",
    number: "GK6",
    status: "pending",
    createdAt: "2026-11-13T09:00:00.000Z",
    paid: 0,
    email: null,
    phone: "255692713993",
    name: "Asha",
    trackingUrl: null,
    autoCancelDisabled: false,
    payments: [],
  };
  const now = new Date("2026-11-16T09:00:00.000Z");
  const first = planReminders(snapshot({ now, orders: [order] }));
  const second = planReminders(snapshot({ now, orders: [order], sent: first.map((action) => action.key) }));
  assert.equal(first.length, 1);
  assert.deepEqual(second, []);
});

test("a quotation is reminded on day 3 and cancelled on day 7", () => {
  const quote = {
    id: "q-1",
    number: "QT-1",
    status: "sent",
    createdAt: "2026-11-10T09:00:00.000Z",
    email: "asha@example.com",
    phone: "255692713993",
    name: "Asha",
    requestStatus: "quoted",
    requestId: "req-9",
  };
  const day3 = planReminders(snapshot({ now: new Date("2026-11-13T09:00:00.000Z"), quotes: [quote] }));
  assert.deepEqual(day3.map((action) => action.kind), ["quote_unaccepted_3d"]);
  const day7 = planReminders(snapshot({ now: new Date("2026-11-17T09:00:00.000Z"), quotes: [quote] }));
  assert.deepEqual(day7.map((action) => action.kind), ["cancel_unpaid_quote"]);
});

test("blank expiry disables cancel and a missing column uses 3 and 7", () => {
  assert.equal(expiryDays(null, 3), null);
  assert.equal(expiryDays(0, 3), null);
  assert.equal(expiryDays(undefined, 3), 3);
  assert.equal(expiryDays(undefined, 7), 7);
});

test("a late confirmed payment reopens only when stock can cover it", () => {
  const base = { status: "cancelled", cancelReason: UNPAID_EXPIRED_REASON, paid: 5000 };
  assert.equal(reopenDecision({ ...base, stockOk: true }), "reopen");
  assert.equal(reopenDecision({ ...base, stockOk: false }), "flag");
  assert.equal(reopenDecision({ ...base, paid: 0, stockOk: true }), "ignore");
  assert.equal(reopenDecision({ ...base, cancelReason: "Customer changed their mind", stockOk: true }), "ignore");
  assert.equal(
    reopenDecision({ ...base, cancelReason: PROMPT_TIMEOUT_REASON, stockOk: true }),
    "reopen",
  );
});
