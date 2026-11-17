import assert from "node:assert/strict";
import test from "node:test";
import { assertChatOrderAdmin, quoteChatOrder } from "./chat-order.ts";

test("a customer session cannot create a chat order", () => {
  assert.throws(() => assertChatOrderAdmin(false), /Forbidden/);
  assert.doesNotThrow(() => assertChatOrderAdmin(true));
});

test("a chat order uses the same advance tiers as checkout", () => {
  const standard = quoteChatOrder([{ quantity: 1, unitPrice: 999_999 }]);
  assert.equal(standard.percent, 50);
  assert.equal(standard.advanceRequired, 500_000);

  const custom = quoteChatOrder([{ quantity: 1, unitPrice: 1_000_000 }]);
  assert.equal(custom.percent, 60);
  assert.equal(custom.advanceRequired, 600_000);

  const large = quoteChatOrder([{ quantity: 10, unitPrice: 1_000 }]);
  assert.equal(large.percent, 70);
  assert.equal(large.advanceRequired, 7_000);
});

test("an unpriced custom line does not invent an advance", () => {
  const quote = quoteChatOrder([
    { quantity: 1, unitPrice: 80_000 },
    { quantity: 1, unitPrice: 0 },
  ]);
  assert.equal(quote.subtotal, 80_000);
  assert.equal(quote.advanceRequired, 40_000);
});
