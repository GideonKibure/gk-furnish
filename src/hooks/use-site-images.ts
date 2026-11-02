import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { IMAGES, type ImageKey } from "@/data/images";
import { pageSectionsQuery } from "@/lib/site-content";
import {
  BUILTIN_PREFIX,
  DEFAULT_GALLERY,
  GALLERY_SLOT,
  parseGallery,
  REMOVED_IMAGE,
  siteImageValues,
  type GalleryItem,
} from "@/lib/site-images";

export function resolveSiteImage(src: string): string {
  if (src.startsWith(BUILTIN_PREFIX)) {
    const key = src.slice(BUILTIN_PREFIX.length);
    return key in IMAGES ? IMAGES[key as ImageKey] : IMAGES.room;
  }
  return src;
}

export type ResolvedGalleryItem = GalleryItem & { url: string };

/** Admin-managed page images. `image()` returns null when the admin removed that image. */
export function useSiteImages() {
  const { data: sections = [] } = useQuery(pageSectionsQuery);
  return useMemo(() => {
    const values = siteImageValues(sections);
    const image = (slot: string, fallback: string | null): string | null => {
      const value = values.get(slot);
      if (!value) return fallback;
      if (value === REMOVED_IMAGE) return null;
      return resolveSiteImage(value);
    };
    const items = parseGallery(values.get(GALLERY_SLOT)) ?? DEFAULT_GALLERY;
    const gallery: ResolvedGalleryItem[] = items.map((item) => ({ ...item, url: resolveSiteImage(item.src) }));
    return { image, gallery };
  }, [sections]);
}
