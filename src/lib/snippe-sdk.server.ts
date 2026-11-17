import { createRequire } from "node:module";
import type { Snippe, SnippeWebhookVerificationError, verifyWebhook } from "@snippe/sdk";

const require = createRequire(import.meta.url);

type SnippeSdk = {
  Snippe: typeof Snippe;
  verifyWebhook: typeof verifyWebhook;
  SnippeWebhookVerificationError: typeof SnippeWebhookVerificationError;
};

/**
 * @snippe/sdk 1.0.0 points ESM imports at dist/esm/index.js, which imports "./client"
 * with no file extension. Node ESM does not add .js, so payment start fails.
 * The CommonJS build requires "./client" and finds client.js.
 */
export function loadSnippeSdk(): SnippeSdk {
  return require("@snippe/sdk");
}
