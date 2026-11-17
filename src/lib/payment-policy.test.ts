import assert from "node:assert/strict";
import test from "node:test";
import {
  DEFAULT_ADVANCE_SETTINGS,
  advanceAmount,
  advanceTierFor,
  statusBlockers,
} from "./payment-policy.ts";

const settings = DEFAULT_ADVANCE_SETTINGS;

test("advance tier is standard just below TZS 1,000,000", () => {
  assert.deepEqual(advanceTierFor({ total: 999_999, itemCount: 1 }, settings), {
    tier: "standard",
    percent: 50,
  });
});

test("advance tier is custom at exactly TZS 1,000,000", () => {
  assert.deepEqual(advanceTierFor({ total: 1_000_000, itemCount: 1 }, settings), {
    tier: "custom",
    percent: 60,
  });
});

test("advance tier stays custom just below TZS 3,000,000", () => {
  assert.deepEqual(advanceTierFor({ total: 2_999_999, itemCount: 1 }, settings), {
    tier: "custom",
    percent: 60,
  });
});

test("advance tier is large at exactly TZS 3,000,000", () => {
  assert.deepEqual(advanceTierFor({ total: 3_000_000, itemCount: 1 }, settings), {
    tier: "large",
    percent: 70,
  });
});

test("nine items below the money thresholds stay on the standard tier", () => {
  assert.deepEqual(advanceTierFor({ total: 100_000, itemCount: 9 }, settings), {
    tier: "standard",
    percent: 50,
  });
});

test("ten items use the large tier even when the total is small", () => {
  assert.deepEqual(advanceTierFor({ total: 100_000, itemCount: 10 }, settings), {
    tier: "large",
    percent: 70,
  });
});

test("a custom order below the large threshold uses the custom tier", () => {
  assert.deepEqual(advanceTierFor({ total: 100_000, itemCount: 1, isCustom: true }, settings), {
    tier: "custom",
    percent: 60,
  });
});

test("a custom order at TZS 3,000,000 still uses the large tier", () => {
  assert.equal(
    advanceTierFor({ total: 3_000_000, itemCount: 1, isCustom: true }, settings).tier,
    "large",
  );
});

test("advance amount rounds up", () => {
  assert.equal(advanceAmount(100_001, 50), 50_001);
});

function order(overrides: Partial<Parameters<typeof statusBlockers>[0]>) {
  return {
    total_amount: 100_000,
    amount_paid: 0,
    advance_required: 50_000,
    specs_agreed_at: null,
    fulfilment_method: "collection",
    delivery_fee_status: "free",
    ...overrides,
  };
}

test("production is blocked without a confirmed advance", () => {
  const blockers = statusBlockers(
    order({ amount_paid: 49_999, specs_agreed_at: "2026-01-01T00:00:00.000Z" }),
    "in_production",
  );
  assert.ok(blockers.some((line) => line.includes("advance")));
});

test("production is blocked without agreed specifications", () => {
  const blockers = statusBlockers(
    order({ amount_paid: 50_000, specs_agreed_at: null }),
    "in_production",
  );
  assert.ok(blockers.some((line) => line.includes("specifications")));
});

test("production is allowed when the advance is covered and specifications are agreed", () => {
  assert.deepEqual(
    statusBlockers(
      order({ amount_paid: 50_000, specs_agreed_at: "2026-01-01T00:00:00.000Z" }),
      "in_production",
    ),
    [],
  );
});

test("handover is blocked while a balance remains", () => {
  const blockers = statusBlockers(
    order({
      amount_paid: 50_000,
      specs_agreed_at: "2026-01-01T00:00:00.000Z",
    }),
    "delivered",
  );
  assert.ok(blockers.some((line) => line.includes("balance")));
});

test("handover is blocked while a delivery fee is unconfirmed", () => {
  const blockers = statusBlockers(
    order({
      amount_paid: 100_000,
      specs_agreed_at: "2026-01-01T00:00:00.000Z",
      fulfilment_method: "delivery",
      delivery_fee_status: "pending",
    }),
    "delivered",
  );
  assert.ok(blockers.some((line) => line.includes("delivery fee")));
});

test("handover is allowed when the balance is clear and the delivery fee is confirmed", () => {
  assert.deepEqual(
    statusBlockers(
      order({
        total_amount: 110_000,
        amount_paid: 110_000,
        advance_required: 50_000,
        specs_agreed_at: "2026-01-01T00:00:00.000Z",
        fulfilment_method: "delivery",
        delivery_fee_status: "confirmed",
      }),
      "delivered",
    ),
    [],
  );
});
