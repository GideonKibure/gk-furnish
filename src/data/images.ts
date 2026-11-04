/**
 * Central image registry.
 * Swap demo photography for GK furnish's real photos by changing only this file.
 */
import heroStudy from "@/assets/hero-study.webp";
import catChairs from "@/assets/cat-chairs.webp";
import catTables from "@/assets/cat-tables.webp";
import catBeds from "@/assets/bed-double.webp";
import catLamps from "@/assets/cat-lamps.webp";
import workshop1 from "@/assets/workshop-1.webp";
import workshop2 from "@/assets/workshop-2.webp";
import lifestyleRoom from "@/assets/lifestyle-room.webp";
import customSketch from "@/assets/custom-sketch.webp";
import heroVideo from "@/data/videos/gk-furniture-hero.mp4";

export const IMAGES = {
  hero: heroStudy,
  chairs: catChairs,
  tables: catTables,
  beds: catBeds,
  lamps: catLamps,
  workshop: workshop1,
  craft: workshop2,
  room: lifestyleRoom,
  custom: customSketch,
} as const;

export type ImageKey = keyof typeof IMAGES;

/** Bundled so the production build includes the file. A raw /src path only works in dev. */
export const HERO_VIDEO_SRC = heroVideo;

/** Resolve a database `image_key` to a bundled image, with a safe fallback. */
export function imageFor(key: string | null | undefined): string {
  if (key && key in IMAGES) return IMAGES[key as ImageKey];
  return IMAGES.room;
}
