import { advanceAmount, advanceTierFor, type AdvanceSettings, DEFAULT_ADVANCE_SETTINGS } from "./payment-policy.ts";

export type ChatQuoteLine = { quantity: number; unitPrice: number };

/** Same advance tiers as checkout. A custom line with no price adds nothing to the advance. */
export function quoteChatOrder(lines: ChatQuoteLine[], settings?: AdvanceSettings) {
  const subtotal = lines.reduce((sum, line) => sum + Math.max(0, Math.round(line.unitPrice)) * line.quantity, 0);
  const itemCount = lines.reduce((sum, line) => sum + line.quantity, 0);
  const { percent } = advanceTierFor({ total: subtotal, itemCount }, settings ?? DEFAULT_ADVANCE_SETTINGS);
  return { subtotal, itemCount, percent, advanceRequired: advanceAmount(subtotal, percent) };
}

/** Customer sessions stop here. The admin server function also uses requireAdmin. */
export function assertChatOrderAdmin(isAdmin: boolean) {
  if (!isAdmin) throw new Error("Forbidden: admin access required");
}
