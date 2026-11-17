import assert from "node:assert/strict";
import test from "node:test";
import { processSnippeEvent, type SnippeFlowDeps, type SnippePaymentRow } from "./snippe-flow.ts";

function memory(payment: SnippePaymentRow | null) {
  const seen = new Set<string>();
  const calls: string[] = [];
  const deps: SnippeFlowDeps = {
    claim: async (eventId) => {
      if (seen.has(eventId)) return "duplicate";
      seen.add(eventId);
      return "new";
    },
    findByReference: async () => payment,
    getStatus: async () => ({ status: "completed", amount: payment?.amount ?? 0, currency: "TZS" }),
    complete: async (_id, via) => {
      calls.push(`complete:${via}`);
    },
    fail: async (_id, status) => {
      calls.push(`fail:${status}`);
    },
    review: async () => {
      calls.push("review");
    },
  };
  return { deps, calls, seen };
}

test("a duplicate event changes nothing", async () => {
  const { deps, calls } = memory({
    id: "p1",
    amount: 500,
    currency: "TZS",
    status: "pending",
    reference: "pay_abcdef",
    needsReview: false,
  });
  const event = {
    id: "evt_1",
    type: "payment.completed",
    reference: "pay_abcdef",
    amount: 500,
    currency: "TZS",
  };
  assert.equal(await processSnippeEvent(event, "webhook", deps), "ok");
  assert.equal(await processSnippeEvent(event, "webhook", deps), "duplicate");
  assert.deepEqual(calls, ["complete:webhook"]);
});

test("an unknown reference changes nothing", async () => {
  const { deps, calls } = memory(null);
  const result = await processSnippeEvent(
    {
      id: "evt_2",
      type: "payment.completed",
      reference: "pay_missing",
      amount: 500,
      currency: "TZS",
    },
    "webhook",
    deps,
  );
  assert.equal(result, "unknown");
  assert.deepEqual(calls, []);
});

test("an amount mismatch is marked for review and is not completed", async () => {
  const { deps, calls } = memory({
    id: "p1",
    amount: 500,
    currency: "TZS",
    status: "pending",
    reference: "pay_abcdef",
    needsReview: false,
  });
  deps.getStatus = async () => ({ status: "completed", amount: 900, currency: "TZS" });
  const result = await processSnippeEvent(
    {
      id: "evt_3",
      type: "payment.completed",
      reference: "pay_abcdef",
      amount: 900,
      currency: "TZS",
    },
    "webhook",
    deps,
  );
  assert.equal(result, "ok");
  assert.deepEqual(calls, ["review"]);
});

test("a failed payment is failed without a completion", async () => {
  const { deps, calls } = memory({
    id: "p1",
    amount: 500,
    currency: "TZS",
    status: "pending",
    reference: "pay_abcdef",
    needsReview: false,
  });
  deps.getStatus = async () => ({ status: "failed", amount: 500, currency: "TZS" });
  const result = await processSnippeEvent(
    { id: "evt_4", type: "payment.failed", reference: "pay_abcdef", amount: 500, currency: "TZS" },
    "webhook",
    deps,
  );
  assert.equal(result, "ok");
  assert.deepEqual(calls, ["fail:failed"]);
});

test("a missed webhook is completed by reconcile", async () => {
  const { deps, calls } = memory({
    id: "p1",
    amount: 700,
    currency: "TZS",
    status: "pending",
    reference: "pay_abcdef",
    needsReview: false,
  });
  const result = await processSnippeEvent(
    {
      id: "reconcile-pay_abcdef",
      type: null,
      reference: "pay_abcdef",
      amount: null,
      currency: null,
    },
    "reconcile",
    deps,
  );
  assert.equal(result, "ok");
  assert.deepEqual(calls, ["complete:reconcile"]);
});

test("a status lookup failure asks the provider to retry", async () => {
  const { deps, calls } = memory({
    id: "p1",
    amount: 500,
    currency: "TZS",
    status: "pending",
    reference: "pay_abcdef",
    needsReview: false,
  });
  deps.getStatus = async () => {
    throw new Error("network");
  };
  const result = await processSnippeEvent(
    {
      id: "evt_5",
      type: "payment.completed",
      reference: "pay_abcdef",
      amount: 500,
      currency: "TZS",
    },
    "webhook",
    deps,
  );
  assert.equal(result, "retry");
  assert.deepEqual(calls, []);
});
