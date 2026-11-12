import { SITE } from "@/config/site";

export const DEFAULT_OG_IMAGE = `${SITE.url}/brand/gk-furnish-logo.png`;

export function absoluteUrl(path: string) {
  if (/^https?:\/\//.test(path)) return path;
  return `${SITE.url}${path.startsWith("/") ? path : `/${path}`}`;
}

/** Title, description, canonical link and Open Graph / Twitter tags for a page. */
export function seo({
  title,
  description,
  path,
  image,
  type = "website",
  noindex = false,
}: {
  title: string;
  description?: string;
  path: string;
  image?: string | null;
  type?: "website" | "product" | "article";
  noindex?: boolean;
}) {
  const url = absoluteUrl(path);
  const img = image ? absoluteUrl(image) : DEFAULT_OG_IMAGE;
  const meta: Record<string, string>[] = [
    { title },
    { property: "og:title", content: title },
    { property: "og:type", content: type },
    { property: "og:url", content: url },
    { property: "og:image", content: img },
    { property: "og:site_name", content: SITE.name },
    { name: "twitter:card", content: "summary_large_image" },
    { name: "twitter:title", content: title },
    { name: "twitter:image", content: img },
  ];
  if (description) {
    const text = metaText(description, 160);
    meta.push(
      { name: "description", content: text },
      { property: "og:description", content: text },
      { name: "twitter:description", content: text },
    );
  }
  meta.push({ name: "robots", content: noindex ? "noindex, nofollow" : "index, follow" });
  meta.push({ name: "twitter:image:alt", content: title });
  return { meta, links: [{ rel: "canonical", href: url }] };
}

/** Collapse whitespace and keep a meta description within the usual length. */
export function metaText(value: string | null | undefined, max = 160) {
  const text = (value ?? "").replace(/\s+/g, " ").trim();
  if (text.length <= max) return text;
  const cut = text.slice(0, max - 1);
  const word = cut.lastIndexOf(" ");
  return `${(word > 80 ? cut.slice(0, word) : cut).trim()}…`;
}

export function breadcrumbLd(items: { name: string; path: string }[]) {
  return {
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: absoluteUrl(item.path),
    })),
  };
}

/** Product copy for search results. Uses the stored description, and a factual fallback when it is empty. */
export function productSeoCopy(input: {
  name: string;
  category: string | null;
  description: string | null;
  price: number;
}) {
  const own = metaText(input.description, 500);
  if (own) return own;
  const category = input.category ? ` ${input.category}.` : "";
  const price =
    input.price > 0
      ? ` From TZS ${new Intl.NumberFormat("en-US").format(Math.round(input.price))}.`
      : "";
  return `${input.name}.${category} Made by GK Furnish in Mbeya, Tanzania.${price} Delivery arranged, or collect from the workshop.`.replace(
    /\s+/g,
    " ",
  );
}
