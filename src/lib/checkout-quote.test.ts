import assert from "node:assert/strict";
import test from "node:test";
import { CheckoutInput } from "./checkout-input.ts";
import { DEFAULT_ADVANCE_SETTINGS } from "./payment-policy.ts";
import {
  existingOrderForRequest,
  orderAfterPromptFailure,
  quoteCheckout,
} from "./checkout-quote.ts";

const guest = {
  items: [
    {
      product_id: "11111111-1111-1111-1111-111111111111",
      quantity: 1,
      material: "",
      size: "",
      color: "",
    },
  ],
  customer_name: "Asha",
  phone: "0712345678",
  fulfilment_method: "collection" as const,
  payment_choice: "advance" as const,
  payment_method: "mobile" as const,
  specs_agreed: true as const,
  policies_accepted: true as const,
  client_request_id: "22222222-2222-2222-2222-222222222222",
};

test("a guest checkout does not require an account", () => {
  const parsed = CheckoutInput.parse(guest);
  assert.equal(parsed.customer_name, "Asha");
  assert.equal("user_id" in parsed, false);
});

test("the same idempotency key points at the order already saved", () => {
  assert.equal(existingOrderForRequest("order-1"), "order-1");
  assert.equal(existingOrderForRequest(null), null);
});

test("advance amounts follow the payment tiers", () => {
  const standard = quoteCheckout(999_999, 1, DEFAULT_ADVANCE_SETTINGS);
  assert.equal(standard.percent, 50);
  assert.equal(standard.advance, 500_000);
  const custom = quoteCheckout(1_000_000, 1, DEFAULT_ADVANCE_SETTINGS);
  assert.equal(custom.percent, 60);
  assert.equal(custom.advance, 600_000);
  const large = quoteCheckout(3_000_000, 1, DEFAULT_ADVANCE_SETTINGS);
  assert.equal(large.percent, 70);
  const ten = quoteCheckout(100_000, 10, DEFAULT_ADVANCE_SETTINGS);
  assert.equal(ten.percent, 70);
});

test("pay in full charges the whole total", () => {
  const quote = quoteCheckout(80_000, 1, DEFAULT_ADVANCE_SETTINGS);
  assert.equal(quote.full, 80_000);
  assert.equal(quote.balanceAfterAdvance, 80_000 - quote.advance);
});

test("a Snippe failure leaves a usable order", () => {
  const result = orderAfterPromptFailure("GK-100", "The network did not answer");
  assert.equal(result.usable, true);
  assert.equal(result.paymentId, null);
  assert.equal(result.orderNumber, "GK-100");
});
