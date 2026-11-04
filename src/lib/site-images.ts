import type { ImageKey } from "@/data/images";

/** Page images live in `page_sections` under this page key: one row per slot, value = image URL. */
export const SITE_IMAGES_PAGE = "site_images";
export const GALLERY_SLOT = "gallery_items";
/** Stored value that hides an image the admin removed. */
export const REMOVED_IMAGE = "none";
export const BUILTIN_PREFIX = "builtin:";
export const SITE_IMAGE_FOLDER = "site";

export type SitePage = "home" | "categories" | "gallery" | "about" | "custom-order";

export type SiteImageSlot = {
  id: string;
  page: SitePage;
  label: string;
  hint: string;
  fallback: ImageKey | null;
};

export const SITE_PAGES: { id: SitePage; label: string }[] = [
  { id: "home", label: "Home page" },
  { id: "categories", label: "Categories page" },
  { id: "gallery", label: "Gallery page" },
  { id: "about", label: "About page" },
  { id: "custom-order", label: "Custom order page" },
];

const HERO_SLIDE_HINT =
  "Home page hero slideshow. Use a wide landscape photo; the headline covers the left side (the top on phones), so keep the furniture on the right. Remove it to skip this slide.";

/** Slot ids are fixed: the storefront reads them by id (the `home.feature.*` ids now feed the hero slideshow). */
export const SITE_IMAGE_SLOTS: SiteImageSlot[] = [
  { id: "home.hero", page: "home", label: "Hero slide 1", hint: `First slide. ${HERO_SLIDE_HINT}`, fallback: "hero" },
  { id: "home.feature.homes", page: "home", label: "Hero slide 2", hint: HERO_SLIDE_HINT, fallback: "room" },
  { id: "home.feature.desks", page: "home", label: "Hero slide 3", hint: HERO_SLIDE_HINT, fallback: "tables" },
  { id: "home.feature.chairs", page: "home", label: "Hero slide 4", hint: HERO_SLIDE_HINT, fallback: "chairs" },
  { id: "home.feature.beds", page: "home", label: "Hero slide 5", hint: HERO_SLIDE_HINT, fallback: "beds" },
  {
    id: "home.custom",
    page: "home",
    label: "Custom order banner",
    hint: "Photo beside the gold “custom piece” section lower on the home page. Remove it to show the text only.",
    fallback: "custom",
  },
  { id: "header.categories", page: "categories", label: "Page header image", hint: "Optional image beside the page title.", fallback: null },
  { id: "header.gallery", page: "gallery", label: "Page header image", hint: "Optional image beside the page title.", fallback: null },
  { id: "about.story", page: "about", label: "Our story image", hint: "Beside the “Our story” text.", fallback: "workshop" },
  { id: "header.about", page: "about", label: "Page header image", hint: "Optional image beside the page title.", fallback: null },
  { id: "header.custom-order", page: "custom-order", label: "Page header image", hint: "Optional image beside the page title.", fallback: null },
];

export function categoryImageSlot(slug: string) {
  return `category.${slug}`;
}

export const GALLERY_GROUPS = ["chairs", "tables", "beds", "lamps", "custom", "workshop"] as const;
export type GalleryGroup = (typeof GALLERY_GROUPS)[number];

export type GalleryItem = {
  id: string;
  src: string;
  group: GalleryGroup;
  caption: string;
  caption_sw: string;
};

export const DEFAULT_GALLERY: GalleryItem[] = [
  { id: "default-1", src: "builtin:chairs", group: "chairs", caption: "Hand-finished wooden chair", caption_sw: "Kiti cha mbao kilichomaliziwa kwa mkono" },
  { id: "default-2", src: "builtin:tables", group: "tables", caption: "Wooden table with drawer", caption_sw: "Meza ya mbao yenye droo" },
  { id: "default-3", src: "builtin:beds", group: "beds", caption: "Single bed frame", caption_sw: "Fremu ya kitanda cha mtu mmoja" },
  { id: "default-4", src: "builtin:lamps", group: "lamps", caption: "Wooden table lamp", caption_sw: "Taa ya meza ya mbao" },
  { id: "default-5", src: "builtin:room", group: "custom", caption: "A finished furnished room", caption_sw: "Chumba kilichopambwa kikamilifu" },
  { id: "default-6", src: "builtin:hero", group: "custom", caption: "Desk, chair and lamp together", caption_sw: "Meza, kiti na taa pamoja" },
  { id: "default-7", src: "builtin:workshop", group: "workshop", caption: "Inside the workshop", caption_sw: "Ndani ya karakana" },
  { id: "default-8", src: "builtin:craft", group: "workshop", caption: "Sanding a chair joint", caption_sw: "Kupiga sandi kiungio cha kiti" },
  { id: "default-9", src: "builtin:custom", group: "custom", caption: "A custom desk, drawn to measure", caption_sw: "Meza maalum, imechorwa kwa vipimo" },
];

function isGroup(value: unknown): value is GalleryGroup {
  return typeof value === "string" && (GALLERY_GROUPS as readonly string[]).includes(value);
}

/** Returns null when nothing valid is saved, so callers fall back to the default gallery. */
export function parseGallery(raw: string | null | undefined): GalleryItem[] | null {
  if (!raw?.trim()) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return null;
    const items: GalleryItem[] = [];
    for (const entry of parsed) {
      if (!entry || typeof entry !== "object") continue;
      const row = entry as Record<string, unknown>;
      const id = row["id"];
      const src = row["src"];
      if (typeof id !== "string" || typeof src !== "string" || !src.trim()) continue;
      items.push({
        id,
        src,
        group: isGroup(row["group"]) ? row["group"] : "custom",
        caption: typeof row["caption"] === "string" ? row["caption"] : "",
        caption_sw: typeof row["caption_sw"] === "string" ? row["caption_sw"] : "",
      });
    }
    return items;
  } catch {
    return null;
  }
}

export function serializeGallery(items: GalleryItem[]) {
  return JSON.stringify(items);
}

type SectionRow = { page_key: string; section_key: string; content_en: string };

export function siteImageValues(sections: SectionRow[]) {
  const map = new Map<string, string>();
  for (const s of sections) {
    if (s.page_key === SITE_IMAGES_PAGE) map.set(s.section_key, s.content_en.trim());
  }
  return map;
}

/** Storage path inside the product-images bucket for images uploaded from Site images. */
export function siteImageStoragePath(url: string | null | undefined) {
  if (!url) return null;
  const marker = `/product-images/${SITE_IMAGE_FOLDER}/`;
  const idx = url.indexOf(marker);
  if (idx === -1) return null;
  const rest = url.slice(idx + marker.length).split("?")[0] ?? "";
  return rest ? `${SITE_IMAGE_FOLDER}/${decodeURIComponent(rest)}` : null;
}
