import assert from "node:assert/strict";
import test from "node:test";
import {
  customerStageIndex,
  nextTrackStep,
  paymentCustomerState,
  PublicTrackedOrder,
  receiptRequiredLines,
  savedCompletionHours,
  TrackingInput,
} from "./track-next.ts";

const base = {
  status: "pending",
  paid: 0,
  advanceRequired: 50_000,
  balance: 100_000,
  specsAgreed: false,
  deliveryFeeStatus: "pending",
  deliveryFee: null as number | null,
  fulfilmentMethod: "delivery",
};

test("the next step follows the real order state", () => {
  assert.deepEqual(nextTrackStep(base), { id: "advance", amount: 50_000 });
  assert.equal(nextTrackStep({ ...base, paid: 50_000, balance: 50_000, status: "confirmed" }).id, "design");
  assert.equal(
    nextTrackStep({ ...base, paid: 50_000, balance: 50_000, specsAgreed: true, status: "in_production" }).id,
    "building",
  );
  const balance = nextTrackStep({ ...base, paid: 50_000, balance: 50_000, specsAgreed: true, status: "ready" });
  assert.equal(balance.id, "balance");
  if (balance.id === "balance") {
    assert.equal(balance.amount, 50_000);
    assert.equal(balance.delivery, "pending");
    assert.equal(balance.fee, null);
  }
  assert.deepEqual(
    nextTrackStep({
      ...base,
      paid: 100_000,
      balance: 0,
      specsAgreed: true,
      status: "ready",
      deliveryFeeStatus: "free",
      fulfilmentMethod: "collection",
    }),
    { id: "ready", method: "collection" },
  );
  assert.equal(nextTrackStep({ ...base, status: "cancelled" }).id, "cancelled");
  assert.equal(nextTrackStep({ ...base, status: "refunded" }).id, "refunded");
});

test("a customer-submitted payment stays unconfirmed", () => {
  assert.equal(paymentCustomerState("pending"), "pending");
  assert.equal(paymentCustomerState("needs_review"), "pending");
  assert.equal(paymentCustomerState("completed"), "confirmed");
  assert.equal(paymentCustomerState("rejected"), "rejected");
  assert.notEqual(paymentCustomerState("pending"), "confirmed");
});

test("the public tracking payload refuses private fields and requires a token", () => {
  assert.equal(TrackingInput.safeParse({}).success, false);
  assert.equal(TrackingInput.safeParse({ token: "GK-1042" }).success, false);
  assert.equal(TrackingInput.safeParse({ token: "123e4567-e89b-12d3-a456-426614174000" }).success, true);
  const order = {
    number: "GK-1042",
    status: "pending",
    createdAt: "2026-11-17T00:00:00.000Z",
    customerName: "Asha",
    phoneMasked: "+255••••993",
    fulfilmentMethod: "delivery",
    location: "Mbeya",
    neededBy: null,
    subtotal: 100_000,
    deliveryFee: null,
    deliveryFeeStatus: "pending",
    total: 100_000,
    paid: 0,
    balance: 100_000,
    advancePercent: 50,
    advanceRequired: 50_000,
    paymentStatus: "unpaid",
    specsAgreed: false,
    items: [],
    payments: [],
    history: [],
    collectionAddress: null,
    completionHours: null,
  };
  assert.equal(PublicTrackedOrder.parse(order).number, "GK-1042");
  assert.equal(PublicTrackedOrder.safeParse({ ...order, notes: "supplier cost", internal_cost: 20 }).success, false);
  assert.equal(savedCompletionHours(undefined), null);
  assert.equal(savedCompletionHours(72), 72);
});

test("a receipt names the business, order, RCT number, amount, method and date", () => {
  const lines = receiptRequiredLines({
    business: "GK Furnish",
    address: "Mbeya, Tanzania",
    orderNumber: "GK-1042",
    receiptNumber: "RCT-1042",
    amount: "TZS 50,000",
    method: "M-Pesa",
    date: "17 Nov 2026",
  });
  assert.ok(lines.includes("GK Furnish"));
  assert.ok(lines.includes("Mbeya, Tanzania"));
  assert.ok(lines.includes("GK-1042"));
  assert.ok(lines.includes("RCT-1042"));
  assert.ok(lines.includes("TZS 50,000"));
  assert.ok(lines.includes("M-Pesa"));
  assert.ok(lines.includes("17 Nov 2026"));
});

test("customer stages stay in order and name a stop", () => {
  assert.equal(customerStageIndex("pending"), 0);
  assert.equal(customerStageIndex("confirmed"), 1);
  assert.equal(customerStageIndex("in_production"), 2);
  assert.equal(customerStageIndex("completed"), 3);
  assert.equal(customerStageIndex("cancelled"), "cancelled");
});
