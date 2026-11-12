/**
 * Central business configuration for GK furnish.
 * Change contact details, hours and copy here — nothing is hardcoded in components.
 */

/** Public Google Analytics 4 measurement ID. Safe to ship in the browser. */
export const GA_MEASUREMENT_ID = "G-J96RVDQSF1";

export const SITE = {
  name: "GK furnish",
  url: "https://gkfurnish.co.tz",
  tagline: "Locally made furniture from Mbeya, Tanzania",
  phoneDisplay: "+255 692 713 993",
  phoneDial: "+255692713993",
  whatsappNumber: "255692713993",
  email: "gideonkibure@gmail.com",
  location: "Mbeya, Tanzania",
  currency: "TZS",
  social: {
    instagram: "https://www.instagram.com/gkbottlebloom/",
    facebook: "https://facebook.com",
    tiktok: "https://tiktok.com",
  },
} as const;

export function waLink(message: string) {
  return `https://wa.me/${SITE.whatsappNumber}?text=${encodeURIComponent(message)}`;
}

export function telLink() {
  return `tel:${SITE.phoneDial}`;
}

export function formatPrice(price: number | null | undefined) {
  if (!price || price <= 0) return null;
  return `${SITE.currency} ${new Intl.NumberFormat("en-US").format(Math.round(price))}`;
}

/** Like formatPrice, but shows "TZS 0" instead of nothing. */
export function formatAmount(price: number | null | undefined) {
  return `${SITE.currency} ${new Intl.NumberFormat("en-US").format(Math.round(price ?? 0))}`;
}

export function formatPriceSpan(prices: number[]) {
  const amounts = prices.filter((price) => price > 0);
  if (!amounts.length) return null;
  const low = Math.min(...amounts);
  const high = Math.max(...amounts);
  const lowLabel = formatPrice(low);
  if (!lowLabel || low === high) return lowLabel;
  return `${lowLabel} – ${formatPrice(high)}`;
}
