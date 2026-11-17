export const TEMPLATE_KEYS = [
  "quote_ready",
  "need_details",
  "payment_confirmed",
  "ready_collection",
  "balance_due",
] as const;
export type TemplateKey = (typeof TEMPLATE_KEYS)[number];

export const TEMPLATE_LABELS: Record<TemplateKey, string> = {
  quote_ready: "Your quote is ready",
  need_details: "We need more details",
  payment_confirmed: "Your payment is confirmed",
  ready_collection: "Your order is ready for collection",
  balance_due: "Your balance is due",
};

export type TemplatePair = { en: string; sw: string };
export type TemplateBook = Record<TemplateKey, TemplatePair>;

export const DEFAULT_TEMPLATES: TemplateBook = {
  quote_ready: {
    en: "Hello {name}, your quote for {order_number} is ready. The amount is {amount}.",
    sw: "Habari {name}, bei yako ya {order_number} iko tayari. Kiasi ni {amount}.",
  },
  need_details: {
    en: "Hello {name}, we need a few more details about {order_number} before we can continue.",
    sw: "Habari {name}, tunahitaji maelezo zaidi kuhusu {order_number} kabla ya kuendelea.",
  },
  payment_confirmed: {
    en: "Hello {name}, your payment of {amount} for order {order_number} is confirmed. Follow it here: {tracking_link}",
    sw: "Habari {name}, malipo yako ya {amount} kwa oda {order_number} yamethibitishwa. Fuatilia hapa: {tracking_link}",
  },
  ready_collection: {
    en: "Hello {name}, order {order_number} is ready for collection.",
    sw: "Habari {name}, oda {order_number} iko tayari kuchukuliwa.",
  },
  balance_due: {
    en: "Hello {name}, the balance of {amount} for order {order_number} is due before we hand it over.",
    sw: "Habari {name}, salio la {amount} kwa oda {order_number} linadaiwa kabla ya kukabidhiwa.",
  },
};

export function applyTemplate(template: string, values: Partial<Record<string, string>>) {
  const missing: string[] = [];
  const text = template.replace(/\{([a-z_]+)\}/g, (token, key: string) => {
    const value = values[key];
    if (!value) {
      missing.push(key);
      return token;
    }
    return value;
  });
  return { text, missing };
}

/** Fill a saved book with the defaults for any missing or blank line. */
function recordOf(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const record: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value)) record[key] = item;
  return record;
}

export function templatesFrom(stored: unknown): TemplateBook {
  const source = recordOf(stored);
  const book: Partial<TemplateBook> = {};
  for (const key of TEMPLATE_KEYS) {
    const pair = recordOf(source[key]);
    const en =
      typeof pair["en"] === "string" && pair["en"].trim() ? pair["en"] : DEFAULT_TEMPLATES[key].en;
    const sw =
      typeof pair["sw"] === "string" && pair["sw"].trim() ? pair["sw"] : DEFAULT_TEMPLATES[key].sw;
    book[key] = { en, sw };
  }
  return {
    quote_ready: book.quote_ready ?? DEFAULT_TEMPLATES.quote_ready,
    need_details: book.need_details ?? DEFAULT_TEMPLATES.need_details,
    payment_confirmed: book.payment_confirmed ?? DEFAULT_TEMPLATES.payment_confirmed,
    ready_collection: book.ready_collection ?? DEFAULT_TEMPLATES.ready_collection,
    balance_due: book.balance_due ?? DEFAULT_TEMPLATES.balance_due,
  };
}
