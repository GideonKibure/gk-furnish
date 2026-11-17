/** Digits only, with Tanzania's country code. Local 0… numbers become 255…. */
export function normaliseWhatsAppNumber(raw: string) {
  const digits = raw.replace(/\D/g, "");
  if (!digits) return "";
  if (digits.startsWith("255")) return digits;
  if (digits.startsWith("0")) return `255${digits.slice(1)}`;
  if (digits.length === 9) return `255${digits}`;
  return digits;
}

/** Opens a chat. The message is only in the link; nothing is stored. */
export function buildWhatsAppLink(input: { number: string; text?: string }) {
  const digits = normaliseWhatsAppNumber(input.number);
  const base = `https://wa.me/${digits}`;
  const text = input.text?.trim();
  if (!text) return base;
  return `${base}?text=${encodeURIComponent(text)}`;
}

/** Product, cart, custom, or price-ask text. Each line is already in the customer's language. */
export function whatsAppOrderText(lines: Array<string | null | undefined>) {
  return lines
    .map((line) => line?.trim() ?? "")
    .filter((line) => line.length > 0)
    .join("\n");
}
