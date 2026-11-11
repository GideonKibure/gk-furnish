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
    meta.push(
      { name: "description", content: description },
      { property: "og:description", content: description },
      { name: "twitter:description", content: description },
    );
  }
  if (noindex) meta.push({ name: "robots", content: "noindex" });
  return { meta, links: [{ rel: "canonical", href: url }] };
}
