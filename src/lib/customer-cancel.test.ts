import assert from "node:assert/strict";
import test from "node:test";
import { customerCancelDecision } from "./customer-cancel.ts";

test("a customer can cancel only a payment that is still waiting", () => {
  assert.equal(customerCancelDecision("pending"), "cancel");
  assert.equal(customerCancelDecision("completed"), "paid");
  assert.equal(customerCancelDecision("needs_review"), "review");
  assert.equal(customerCancelDecision("failed"), "closed");
  assert.equal(customerCancelDecision("expired"), "closed");
});
