import { createFileRoute } from "@tanstack/react-router";
import { SITE } from "@/config/site";

const STATIC_PATHS = [
  { path: "/", priority: "1.0", changefreq: "weekly" },
  { path: "/products", priority: "0.9", changefreq: "daily" },
  { path: "/categories", priority: "0.8", changefreq: "weekly" },
  { path: "/services", priority: "0.6", changefreq: "monthly" },
  { path: "/custom-order", priority: "0.8", changefreq: "monthly" },
  { path: "/gallery", priority: "0.6", changefreq: "monthly" },
  { path: "/about", priority: "0.5", changefreq: "monthly" },
  { path: "/process", priority: "0.5", changefreq: "monthly" },
  { path: "/faq", priority: "0.5", changefreq: "monthly" },
  { path: "/contact", priority: "0.6", changefreq: "monthly" },
  { path: "/privacy", priority: "0.2", changefreq: "yearly" },
];

function escapeXml(value: string) {
  return value.replace(
    /[<>&'"]/g,
    (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;" })[c] ?? c,
  );
}

function url(path: string, opts: { lastmod?: string; changefreq?: string; priority?: string }) {
  return [
    "  <url>",
    `    <loc>${escapeXml(`${SITE.url}${path}`)}</loc>`,
    opts.lastmod ? `    <lastmod>${opts.lastmod.slice(0, 10)}</lastmod>` : "",
    opts.changefreq ? `    <changefreq>${opts.changefreq}</changefreq>` : "",
    opts.priority ? `    <priority>${opts.priority}</priority>` : "",
    "  </url>",
  ]
    .filter(Boolean)
    .join("\n");
}

export const Route = createFileRoute("/sitemap.xml")({
  server: {
    handlers: {
      GET: async () => {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const [products, categories] = await Promise.all([
          supabaseAdmin.from("products").select("*"),
          supabaseAdmin.from("categories").select("*"),
        ]);
        const entries = STATIC_PATHS.map((p) => url(p.path, p));
        for (const c of categories.data ?? []) {
          if (c.is_active === false) continue;
          entries.push(url(`/categories/${c.slug}`, { changefreq: "weekly", priority: "0.7" }));
        }
        for (const p of products.data ?? []) {
          if (!p.slug || (p.status ?? "active") !== "active") continue;
          entries.push(
            url(`/products/${p.slug}`, {
              lastmod: p.updated_at,
              changefreq: "weekly",
              priority: "0.8",
            }),
          );
        }
        const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${entries.join("\n")}\n</urlset>\n`;
        return new Response(xml, {
          headers: {
            "content-type": "application/xml; charset=utf-8",
            "cache-control": "public, max-age=3600, s-maxage=3600",
          },
        });
      },
    },
  },
});
