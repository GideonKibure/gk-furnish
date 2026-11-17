import assert from "node:assert/strict";
import test from "node:test";
import { honeypotTripped, maskLogValue, rateDecision, rateWindowStart, turnstileActive } from "./abuse.ts";
import { cardVariantUrl, fittedSize, securityHeaders } from "./image-size.ts";
import { passwordMeetsPolicy } from "./password-rules.ts";

test("a photo is fitted inside 1600 pixels and is not enlarged", () => {
  assert.deepEqual(fittedSize(3200, 1600, 1600), { width: 1600, height: 800 });
  assert.deepEqual(fittedSize(400, 300, 1600), { width: 400, height: 300 });
});

test("only a product WebP gets a grid variant", () => {
  const full = "https://example.supabase.co/storage/v1/object/public/product-images/abc.webp";
  assert.equal(cardVariantUrl(full), full.replace(".webp", "-w800.webp"));
  assert.equal(cardVariantUrl(full.replace(".webp", ".jpg")), full.replace(".webp", ".jpg"));
  assert.equal(cardVariantUrl("https://example.com/other.webp"), "https://example.com/other.webp");
});

test("a filled honeypot is rejected and an empty one is not", () => {
  assert.equal(honeypotTripped("http://spam"), true);
  assert.equal(honeypotTripped("  "), false);
  assert.equal(honeypotTripped(undefined), false);
});

test("the rate limit blocks on the next hit after the cap", () => {
  assert.equal(rateDecision(7, 8), "allow");
  assert.equal(rateDecision(8, 8), "block");
  const start = rateWindowStart(new Date("2026-11-17T10:59:00.000Z"));
  assert.equal(start, "2026-11-17T10:00:00.000Z");
});

test("logs hide secrets, emails and phone numbers", () => {
  assert.equal(maskLogValue("api_key", "sk_live_abc"), "[redacted]");
  assert.equal(maskLogValue("email", "asha@example.com"), "a***@example.com");
  assert.equal(maskLogValue("phone", "+255692713993"), "+*********993");
  assert.equal(maskLogValue("order", "GK-100"), "GK-100");
});

test("Turnstile is off until both keys exist", () => {
  assert.equal(turnstileActive({}), false);
  assert.equal(turnstileActive({ TURNSTILE_SECRET_KEY: "secret" }), false);
  assert.equal(turnstileActive({ TURNSTILE_SECRET_KEY: "secret", VITE_TURNSTILE_SITE_KEY: "site" }), true);
});

test("the owner password rule can be switched off without rejecting a short recovery password", () => {
  assert.equal(passwordMeetsPolicy("short", true), false);
  assert.equal(passwordMeetsPolicy("Correct-Horse-1", true), true);
  assert.equal(passwordMeetsPolicy("longenough", false), true);
  assert.equal(passwordMeetsPolicy("short", false), false);
});

test("security headers do not set HSTS on a local host", () => {
  const local = securityHeaders("127.0.0.1:8080");
  assert.equal(local["X-Content-Type-Options"], "nosniff");
  assert.equal(local["Content-Security-Policy"], "frame-ancestors 'self'");
  assert.equal(local["Strict-Transport-Security"], undefined);
  assert.match(securityHeaders("gkfurnish.co.tz")["Strict-Transport-Security"] ?? "", /max-age=31536000/);
});
