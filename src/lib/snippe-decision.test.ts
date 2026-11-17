import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { createRequire } from "node:module";
import test from "node:test";
import {
  completionAudit,
  decideVerifiedSnippe,
  maskProviderReference,
  moneyMatches,
  shouldReduceStock,
  snippeReconcileDue,
  snippeWebhookEnabled,
  stockReductionForSale,
} from "./snippe-decision.ts";

const require = createRequire(import.meta.url);
const { computeWebhookSignature, verifyWebhook, SnippeWebhookVerificationError } =
  require("@snippe/sdk") as {
    computeWebhookSignature: (rawBody: string, timestamp: string, signingKey: string) => string;
    verifyWebhook: (options: {
      rawBody: string;
      signature: string;
      timestamp: string;
      signingKey: string;
    }) => { id: string; type: string };
    SnippeWebhookVerificationError: new (message?: string) => Error;
  };

const SECRET = "test-webhook-secret";

function signed(body: string) {
  const timestamp = String(Math.floor(Date.now() / 1000));
  const signature = computeWebhookSignature(body, timestamp, SECRET);
  return { timestamp, signature };
}

test("a valid Snippe signature verifies the raw body", () => {
  const body = JSON.stringify({
    id: "evt_1",
    type: "payment.completed",
    data: { reference: "pay_123456", amount: { value: 500, currency: "TZS" }, status: "completed" },
  });
  const { timestamp, signature } = signed(body);
  const event = verifyWebhook({ rawBody: body, signature, timestamp, signingKey: SECRET });
  assert.equal(event.id, "evt_1");
  assert.equal(event.type, "payment.completed");
});

test("a bad Snippe signature is rejected", () => {
  const body = '{"id":"evt_1","type":"payment.completed"}';
  const { timestamp } = signed(body);
  const forged = createHmac("sha256", "other-secret").update(`${timestamp}.${body}`).digest("hex");
  assert.throws(
    () => verifyWebhook({ rawBody: body, signature: forged, timestamp, signingKey: SECRET }),
    SnippeWebhookVerificationError,
  );
});

test("the webhook stays closed unless the flag, API key, and webhook secret are set", () => {
  assert.equal(
    snippeWebhookEnabled({
      SNIPPE_ENABLED: "true",
      SNIPPE_API_KEY: "k",
      SNIPPE_WEBHOOK_SECRET: "s",
    }),
    true,
  );
  assert.equal(
    snippeWebhookEnabled({
      SNIPPE_ENABLED: "false",
      SNIPPE_API_KEY: "k",
      SNIPPE_WEBHOOK_SECRET: "s",
    }),
    false,
  );
  assert.equal(snippeWebhookEnabled({ SNIPPE_API_KEY: "k", SNIPPE_WEBHOOK_SECRET: "s" }), false);
});

test("amount and currency must match as integer TZS", () => {
  assert.equal(moneyMatches(500, "TZS", 500, "tzs"), true);
  assert.equal(moneyMatches(500, "TZS", 600, "TZS"), false);
  assert.equal(moneyMatches(500, "TZS", 500, "USD"), false);
  assert.equal(moneyMatches(500.5, "TZS", 501, "TZS"), false);
});

test("a completed payment whose amount does not match is not confirmed", () => {
  assert.deepEqual(
    decideVerifiedSnippe({
      eventType: "payment.completed",
      remoteStatus: "completed",
      localAmount: 500,
      localCurrency: "TZS",
      webhookAmount: 600,
      webhookCurrency: "TZS",
      remoteAmount: 600,
      remoteCurrency: "TZS",
    }),
    { action: "review" },
  );
});

test("a verified completed payment can be confirmed", () => {
  assert.deepEqual(
    decideVerifiedSnippe({
      eventType: "payment.completed",
      remoteStatus: "completed",
      localAmount: 500,
      localCurrency: "TZS",
      webhookAmount: 500,
      webhookCurrency: "TZS",
      remoteAmount: 500,
      remoteCurrency: "TZS",
    }),
    { action: "complete" },
  );
});

test("a failed payment does not confirm", () => {
  assert.deepEqual(
    decideVerifiedSnippe({
      eventType: "payment.failed",
      remoteStatus: "failed",
      localAmount: 500,
      localCurrency: "TZS",
      webhookAmount: 500,
      webhookCurrency: "TZS",
      remoteAmount: 500,
      remoteCurrency: "TZS",
    }),
    { action: "fail", status: "failed" },
  );
});

test("an expired payment is marked expired", () => {
  assert.equal(
    decideVerifiedSnippe({
      eventType: "payment.expired",
      remoteStatus: "expired",
      localAmount: 500,
      localCurrency: "TZS",
      webhookAmount: 500,
      webhookCurrency: "TZS",
      remoteAmount: 500,
      remoteCurrency: "TZS",
    }).action,
    "fail",
  );
});

test("the status endpoint must say completed before a completed webhook is trusted", () => {
  assert.deepEqual(
    decideVerifiedSnippe({
      eventType: "payment.completed",
      remoteStatus: "pending",
      localAmount: 500,
      localCurrency: "TZS",
      webhookAmount: 500,
      webhookCurrency: "TZS",
      remoteAmount: 500,
      remoteCurrency: "TZS",
    }),
    { action: "retry" },
  );
});

test("a missed webhook is confirmed from the status endpoint when the amount matches", () => {
  assert.deepEqual(
    decideVerifiedSnippe({
      eventType: null,
      remoteStatus: "completed",
      localAmount: 700,
      localCurrency: "TZS",
      webhookAmount: null,
      webhookCurrency: null,
      remoteAmount: 700,
      remoteCurrency: "TZS",
    }),
    { action: "complete" },
  );
});

test("owner confirmation does not add Snippe audit fields", () => {
  const patch = completionAudit({ provider: "Confirmed by GK furnish" });
  assert.deepEqual(patch, { provider: "Confirmed by GK furnish" });
  assert.equal("confirmed_via" in patch, false);
  assert.equal("provider_reference" in patch, false);
});

test("an automatic confirmation records snippe, the reference, and how it was confirmed", () => {
  assert.deepEqual(
    completionAudit({
      provider: "snippe",
      confirmedVia: "webhook",
      providerReference: "pay_123456",
    }),
    { provider: "snippe", confirmed_via: "webhook", provider_reference: "pay_123456" },
  );
});

test("references are masked in logs", () => {
  const masked = maskProviderReference("pay_123456789");
  assert.equal(masked.includes("123456789"), false);
  assert.equal(masked.startsWith("pay"), true);
});

test("reconcile waits 2 minutes and ignores payments older than 48 hours", () => {
  const now = Date.parse("2026-11-17T12:00:00.000Z");
  assert.equal(snippeReconcileDue(now - 60_000, now), false);
  assert.equal(snippeReconcileDue(now - 2 * 60_000, now), true);
  assert.equal(snippeReconcileDue(now - 49 * 60 * 60_000, now), false);
});

test("stock is not reduced below zero, and a shortfall is flagged instead", () => {
  assert.deepEqual(stockReductionForSale(4, 2), { deduct: 2, insufficient: false });
  assert.deepEqual(stockReductionForSale(2, 5), { deduct: 0, insufficient: true });
  assert.deepEqual(stockReductionForSale(0, 1), { deduct: 0, insufficient: false });
});

test("confirming the advance reduces stock once, and a replay does not", () => {
  assert.equal(shouldReduceStock({ stockApplied: false, advanceCovered: true }), true);
  assert.equal(shouldReduceStock({ stockApplied: true, advanceCovered: true }), false);
  assert.equal(shouldReduceStock({ stockApplied: false, advanceCovered: false }), false);
});
