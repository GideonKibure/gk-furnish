import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import test from "node:test";
import { balanceDue } from "./payment-policy.ts";
import {
  assertCashAmount,
  assertPayableAmount,
  canPayOrder,
  decideCallback,
  isRepeatAdminPayment,
  parsePalmCallback,
  toPalmPhone,
  verifyPalmSignature,
  type LocalPayment,
  type PalmCallback,
} from "./palmpesa.ts";

const ORDER = 100_000;

function payment(over: Partial<LocalPayment> = {}): LocalPayment {
  return {
    amount: ORDER,
    currency: "TZS",
    status: "pending",
    transactionId: "GK-pay-1",
    providerOrderId: "PALM-1",
    ...over,
  };
}

function event(over: Partial<PalmCallback> = {}): PalmCallback {
  return {
    event: "payment.completed",
    event_id: "evt-1",
    transaction_id: "GK-pay-1",
    order_id: "PALM-1",
    selcom_reference: "0289999288",
    status: "COMPLETED",
    amount: ORDER,
    currency: "TZS",
    channel: "TIGOPESATZ",
    phone: "255712345678",
    failure_reason: null,
    ...over,
  };
}

test("full mobile-money payment is accepted only when PalmPesa says COMPLETED", () => {
  assert.equal(assertPayableAmount(ORDER, ORDER), null);
  assert.equal(decideCallback({ alreadyProcessed: false, payment: payment(), event: event(), verifiedStatus: "COMPLETED" }).action, "complete");
  assert.equal(decideCallback({ alreadyProcessed: false, payment: payment(), event: event({ status: "INITIATING", event: "payment.pending" }), verifiedStatus: "INITIATING" }).action, "ignore");
});

test("deposit leaves a balance and does not count as the full order", () => {
  assert.equal(assertPayableAmount(40_000, ORDER), null);
  assert.equal(balanceDue(ORDER, 40_000), 60_000);
});

test("remaining balance can be paid after the deposit", () => {
  assert.equal(assertPayableAmount(60_000, balanceDue(ORDER, 40_000)), null);
  assert.equal(balanceDue(ORDER, 40_000 + 60_000), 0);
});

test("several payments on one order cannot exceed what is left", () => {
  assert.equal(assertPayableAmount(40_000, ORDER), null);
  assert.equal(assertPayableAmount(30_000, balanceDue(ORDER, 40_000)), null);
  assert.ok(assertPayableAmount(70_000, balanceDue(ORDER, 40_000)));
});

test("cash can be any positive amount up to the balance and is not a mobile-money charge", () => {
  assert.equal(assertCashAmount(15_000, ORDER), null);
  assert.ok(assertCashAmount(0, ORDER));
  assert.ok(assertCashAmount(-1, ORDER));
});

test("an administrator cannot record the same cash payment twice in two minutes", () => {
  const now = Date.now();
  const rows = [{ amount: 15_000, method: "Cash", createdAtMs: now - 30_000 }];
  assert.equal(isRepeatAdminPayment(rows, { amount: 15_000, method: "Cash", nowMs: now }), true);
  assert.equal(isRepeatAdminPayment(rows, { amount: 15_000, method: "Cash", nowMs: now + 120_000 }), false);
  assert.equal(isRepeatAdminPayment(rows, { amount: 10_000, method: "Cash", nowMs: now }), false);
});

test("a failed payment does not add money", () => {
  const decision = decideCallback({
    alreadyProcessed: false,
    payment: payment(),
    event: event({ event: "payment.initiation_failed", status: "INITIATION_FAILED", failure_reason: "PROVIDER_UNAVAILABLE" }),
    verifiedStatus: "INITIATION_FAILED",
  });
  assert.deepEqual(decision, { action: "fail", status: "failed", reason: "PROVIDER_UNAVAILABLE" });
});

test("a cancelled payment does not add money", () => {
  const decision = decideCallback({
    alreadyProcessed: false,
    payment: payment(),
    event: event({ event: "payment.cancelled", status: "CANCELLED" }),
    verifiedStatus: "CANCELLED",
  });
  assert.deepEqual(decision, { action: "fail", status: "failed", reason: "CANCELLED" });
});

test("an expired payment does not add money", () => {
  const decision = decideCallback({
    alreadyProcessed: false,
    payment: payment(),
    event: event({ event: "payment.expired", status: "EXPIRED" }),
    verifiedStatus: "EXPIRED",
  });
  assert.deepEqual(decision, { action: "fail", status: "expired", reason: "EXPIRED" });
});

test("the same callback is not applied twice", () => {
  assert.equal(decideCallback({ alreadyProcessed: true, payment: payment(), event: event() }).action, "duplicate");
  assert.equal(
    decideCallback({ alreadyProcessed: false, payment: payment({ status: "completed" }), event: event(), verifiedStatus: "COMPLETED" }).action,
    "duplicate",
  );
});

test("a late COMPLETED after EXPIRED is still paid once", () => {
  const decision = decideCallback({
    alreadyProcessed: false,
    payment: payment({ status: "expired" }),
    event: event({ event: "payment.completed", status: "COMPLETED" }),
    verifiedStatus: "COMPLETED",
  });
  assert.equal(decision.action, "complete");
  assert.equal(
    decideCallback({
      alreadyProcessed: false,
      payment: payment({ status: "completed" }),
      event: event({ event: "payment.expired", status: "EXPIRED" }),
      verifiedStatus: "EXPIRED",
    }).action,
    "ignore",
  );
});

test("an overpayment and a mismatched callback amount are refused", () => {
  assert.match(assertPayableAmount(ORDER + 1, ORDER) ?? "", /remaining balance/);
  assert.match(assertPayableAmount(0, ORDER) ?? "", /greater than zero/);
  assert.match(assertPayableAmount(50, ORDER) ?? "", /100/);
  assert.equal(
    decideCallback({ alreadyProcessed: false, payment: payment(), event: event({ amount: ORDER - 1 }), verifiedStatus: "COMPLETED" }).action,
    "mismatch",
  );
});

test("someone who does not own the order and has no payment link cannot pay it", () => {
  assert.equal(canPayOrder({ userId: "customer-a", orderUserId: "customer-b", hasPaymentLink: false }), false);
  assert.equal(canPayOrder({ userId: null, orderUserId: "customer-b", hasPaymentLink: false }), false);
});

test("a guest with the private payment link can pay, and a stranger with only an order number cannot", () => {
  assert.equal(canPayOrder({ userId: null, orderUserId: null, hasPaymentLink: true }), true);
  assert.equal(canPayOrder({ userId: "owner", orderUserId: "owner", hasPaymentLink: false }), true);
  assert.equal(canPayOrder({ userId: null, orderUserId: null, hasPaymentLink: false }), false);
});

test("a network or API failure is not treated as a payment", () => {
  assert.equal(parsePalmCallback(null), null);
  assert.equal(parsePalmCallback({ event: "payment.completed", status: "COMPLETED" }), null);
  assert.equal(toPalmPhone("not-a-phone"), null);
  assert.equal(toPalmPhone("0712345678"), "255712345678");
  assert.equal(toPalmPhone("+255 712 345 678"), "255712345678");
});

test("a signed callback matches the PalmPesa HMAC and rejects a stale one", async () => {
  const body = JSON.stringify(event());
  const timestamp = "1700000000";
  const secret = "test-secret";
  const signature = `sha256=${createHmac("sha256", secret).update(`${timestamp}.${body}`).digest("hex")}`;
  assert.equal(await verifyPalmSignature(body, timestamp, signature, secret, 1700000000 * 1000), true);
  assert.equal(await verifyPalmSignature(body, timestamp, signature, secret, 1700000000 * 1000 + 301_000), false);
  assert.equal(await verifyPalmSignature(body, timestamp, "sha256=dead", secret, 1700000000 * 1000), false);
});
