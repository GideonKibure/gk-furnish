import assert from "node:assert/strict";
import test from "node:test";
import { assertAdminMember } from "./admin-gate.ts";
import { quickAddPayload } from "./quick-add.ts";
import {
  buildTodayQueue,
  confirmPaymentCopy,
  groupNotifications,
  isPriceAsk,
  orderBlockedWhy,
  orderNeedsAdvance,
  queueAgeLabel,
} from "./today-queue.ts";
import { applyTemplate, templatesFrom } from "./wa-template.ts";

const hour = 3_600_000;
const now = Date.parse("2026-11-17T12:00:00.000Z");

test("the Today queue counts real rows, oldest age, and stays empty when nothing is waiting", () => {
  assert.deepEqual(
    buildTodayQueue({
      paymentsWaiting: [],
      priceRequests: [],
      customRequests: [],
      needingAdvance: [],
      blocked: [],
      lowStockCount: 0,
      lowStockHref: "/admin/inventory",
    }),
    [],
  );
  const rows = buildTodayQueue({
    paymentsWaiting: [
      { createdAt: "2026-11-17T08:00:00.000Z" },
      { createdAt: "2026-11-16T12:00:00.000Z" },
    ],
    priceRequests: [{ createdAt: "2026-11-17T11:00:00.000Z" }],
    customRequests: [],
    needingAdvance: [{ createdAt: "2026-11-15T12:00:00.000Z" }],
    blocked: [
      {
        createdAt: "2026-11-17T01:00:00.000Z",
        why: "The design and specifications have not been marked as agreed.",
      },
      {
        createdAt: "2026-11-17T02:00:00.000Z",
        why: "The design and specifications have not been marked as agreed.",
      },
    ],
    lowStockCount: 3,
    lowStockHref: "/admin/inventory",
  });
  assert.deepEqual(
    rows.map((row) => row.id),
    ["payments", "price", "advance", "blocked", "stock"],
  );
  assert.equal(rows[0]?.count, 2);
  assert.equal(rows[0]?.oldestAt, "2026-11-16T12:00:00.000Z");
  assert.equal(queueAgeLabel(rows[0]?.oldestAt ?? null, now), "24 hours");
  assert.equal(rows[3]?.why, "The design and specifications have not been marked as agreed.");
  assert.equal(queueAgeLabel("2026-11-17T11:30:00.000Z", now), "Less than an hour");
  assert.equal(Math.floor((now - Date.parse("2026-11-17T09:00:00.000Z")) / hour), 3);
});

test("advance and production blocks use the existing payment rules", () => {
  const open = {
    status: "pending",
    total_amount: 100_000,
    amount_paid: 0,
    advance_required: 50_000,
    specs_agreed_at: null,
    fulfilment_method: "collection",
    delivery_fee_status: null,
  };
  assert.equal(orderNeedsAdvance(open), true);
  assert.equal(
    orderBlockedWhy(open),
    "The design and specifications have not been marked as agreed.",
  );
  assert.equal(orderNeedsAdvance({ ...open, status: "cancelled" }), false);
  assert.equal(isPriceAsk("Customer is asking for the price of a chair."), true);
  assert.equal(isPriceAsk("Mteja anauliza bei ya meza."), true);
  assert.equal(isPriceAsk("A bed with a drawer."), false);
});

test("a payment confirmation names the amount and the order", () => {
  const copy = confirmPaymentCopy("TZS 50,000", "GK-2026-12");
  assert.match(copy, /TZS 50,000/);
  assert.match(copy, /GK-2026-12/);
  assert.match(copy, /adds the money/);
});

test("a visitor who is not an admin is refused", () => {
  assert.throws(() => assertAdminMember(false), /Forbidden/);
  assert.doesNotThrow(() => assertAdminMember(true));
});

test("WhatsApp templates fill known placeholders and leave missing ones untouched", () => {
  const filled = applyTemplate("Hello {name}, order {order_number} is {amount}. {tracking_link}", {
    name: "Asha",
    order_number: "GK-1",
    tracking_link: "https://gkfurnish.co.tz/track/abc",
  });
  assert.equal(
    filled.text,
    "Hello Asha, order GK-1 is {amount}. https://gkfurnish.co.tz/track/abc",
  );
  assert.deepEqual(filled.missing, ["amount"]);
  assert.equal(filled.text.includes("%20"), false);
  const book = templatesFrom({ quote_ready: { en: "Bei {amount}", sw: "" } });
  assert.equal(book.quote_ready.en, "Bei {amount}");
  assert.match(book.quote_ready.sw, /Habari/);
  assert.match(book.need_details.en, /more details/);
});

test("quick add keeps an empty price as ask-for-price and a draft off the shop", () => {
  const empty = quickAddPayload({
    name: "Chair",
    nameSw: "",
    categoryId: "cat",
    price: "",
    stock: "2",
  });
  assert.equal(empty.ok, true);
  if (empty.ok) {
    assert.equal(empty.data.price, 0);
    assert.equal(empty.data.is_available, false);
    assert.equal(empty.data.extended.status, "draft");
  }
  assert.equal(
    quickAddPayload({ name: " ", nameSw: "", categoryId: "cat", price: "", stock: "0" }).ok,
    false,
  );
  assert.equal(
    quickAddPayload({ name: "Chair", nameSw: "", categoryId: "", price: "1000", stock: "1" }).ok,
    false,
  );
  assert.equal(
    quickAddPayload({ name: "Chair", nameSw: "", categoryId: "cat", price: "-1", stock: "1" }).ok,
    false,
  );
});

test("notifications group by type", () => {
  const groups = groupNotifications([
    { type: "payment_pending", id: "a" },
    { type: "order_new", id: "b" },
    { type: "payment_confirmed", id: "c" },
  ]);
  assert.equal(groups[0]?.label, "Payments");
  assert.equal(groups[0]?.items.length, 2);
  assert.equal(groups[1]?.label, "Orders");
});
