import assert from "node:assert/strict";
import test from "node:test";
import { CheckoutInput } from "./checkout-input.ts";
import {
  moneyStage,
  policiesAccepted,
  policyAcceptanceStamp,
  policyFigureMissing,
  policySettingsFrom,
  withoutPolicyStamp,
} from "./policy.ts";

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
};

test("checkout is blocked until the policies are accepted", () => {
  assert.equal(policiesAccepted(false), false);
  assert.throws(() => CheckoutInput.parse({ ...guest, policies_accepted: false }));
  const parsed = CheckoutInput.parse(guest);
  assert.equal(parsed.policies_accepted, true);
});

test("the accepted policy version is stored and is not part of a later update", () => {
  const stamp = policyAcceptanceStamp("2026-11", new Date("2026-11-17T09:00:00.000Z"));
  assert.equal(stamp.policy_version, "2026-11");
  assert.equal(stamp.policy_accepted_at, "2026-11-17T09:00:00.000Z");
  const update = withoutPolicyStamp({ status: "confirmed", ...stamp, policy_version: "changed" });
  assert.equal(update.status, "confirmed");
  assert.equal("policy_version" in update, false);
  assert.equal("policy_accepted_at" in update, false);
});

test("an empty policy setting stays empty", () => {
  const settings = policySettingsFrom({
    warranty_months_structure: null,
    warranty_months_finish: null,
    inspection_window_hours: null,
    refund_processing_days: null,
    ready_made_return_window_hours: null,
    unpaid_expiry_days: null,
    policy_version: "  ",
  });
  assert.equal(policyFigureMissing(settings.warrantyMonthsStructure), true);
  assert.equal(policyFigureMissing(settings.inspectionWindowHours), true);
  assert.equal(settings.readyMadeReturnWindowHours, null);
  assert.equal(settings.policyVersion, "");
});

test("a missing inspection column uses 48 hours, and zero means no ready-made returns", () => {
  const missing = policySettingsFrom({});
  assert.equal(missing.inspectionWindowHours, 48);
  const set = policySettingsFrom({ ready_made_return_window_hours: 0, inspection_window_hours: 24 });
  assert.equal(set.readyMadeReturnWindowHours, 0);
  assert.equal(policyFigureMissing(set.readyMadeReturnWindowHours), false);
  assert.equal(set.inspectionWindowHours, 24);
});

test("the money timeline follows payment, agreement, then handover", () => {
  assert.equal(moneyStage({ paid: 0, advanceRequired: 500, specsAgreed: false, status: "pending" }), 0);
  assert.equal(moneyStage({ paid: 500, advanceRequired: 500, specsAgreed: false, status: "pending" }), 1);
  assert.equal(moneyStage({ paid: 500, advanceRequired: 500, specsAgreed: true, status: "in_production" }), 2);
  assert.equal(moneyStage({ paid: 500, advanceRequired: 500, specsAgreed: true, status: "ready" }), 3);
});
