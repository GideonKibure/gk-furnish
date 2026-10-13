import { imageFor } from "@/data/images";

export type ProductImageLike = {
  image_url?: string | null;
  image_key?: string | null;
  sort_order?: number | null;
  alt_text?: string | null;
};

export type ProductGalleryItem = {
  src: string;
  label: string;
  slot: number;
};

function resolveImageSrc(row: { image_url?: string | null; image_key?: string | null }) {
  if (row.image_url?.trim()) return row.image_url.trim();
  if (row.image_key?.trim()) return imageFor(row.image_key);
  return null;
}

export const PRODUCT_ANGLE_SLOTS = [
  { order: 0, label: "Product photo", hint: "Main catalogue photo" },
  { order: 1, label: "Extra photo", hint: "Second photo of this product" },
] as const;

export const PRODUCT_VIDEO_SLOT = 2;

export function angleLabel(slot: number, fallback?: string | null) {
  const stored = fallback?.trim() ?? "";
  if (/detail/i.test(stored)) return PRODUCT_ANGLE_SLOTS[slot as 0 | 1]?.label ?? "Photo";
  if (stored) return stored;
  return PRODUCT_ANGLE_SLOTS[slot as 0 | 1]?.label ?? "Photo";
}

export function sortedProductImages(rows?: ProductImageLike[] | null) {
  return [...(rows ?? [])].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
}

/** Prefer uploaded image_url; fall back to bundled image_key. */
export function productImageSrc(product: {
  image_url?: string | null;
  image_key?: string | null;
  product_images?: ProductImageLike[] | null;
}) {
  const gallery = productGalleryItems(product);
  return gallery[0]?.src ?? imageFor(null);
}

/** Up to two product photos. Labels never use the words "detailed view". */
export function productGalleryItems(product: {
  image_url?: string | null;
  image_key?: string | null;
  product_images?: ProductImageLike[] | null;
}): ProductGalleryItem[] {
  const bySlot = new Map<number, ProductGalleryItem>();

  for (const row of sortedProductImages(product.product_images)) {
    const slot = row.sort_order ?? 0;
    if (slot < 0 || slot > 1) continue;
    const src = resolveImageSrc(row);
    if (!src || bySlot.has(slot)) continue;
    bySlot.set(slot, {
      src,
      slot,
      label: "",
    });
  }

  if (bySlot.size === 0) {
    const primary = resolveImageSrc(product);
    if (primary) {
      bySlot.set(0, { src: primary, slot: 0, label: "" });
    }
  } else if (!bySlot.has(0)) {
    const primary = resolveImageSrc(product);
    if (primary) bySlot.set(0, { src: primary, slot: 0, label: "" });
  }

  return [0, 1].map((slot) => bySlot.get(slot)).filter((item): item is ProductGalleryItem => Boolean(item));
}

export function productVideoSrc(product: { product_images?: ProductImageLike[] | null }) {
  const row = sortedProductImages(product.product_images).find((item) => (item.sort_order ?? 0) === PRODUCT_VIDEO_SLOT);
  const src = row?.image_url?.trim();
  return src || null;
}

/** Convenience: src strings only (max 2). */
export function productGallerySrcs(product: {
  image_url?: string | null;
  image_key?: string | null;
  product_images?: ProductImageLike[] | null;
}): string[] {
  const items = productGalleryItems(product);
  return items.length ? items.map((i) => i.src) : [imageFor(null)];
}
