/**
 * Central image registry.
 * Swap demo photography for GK furnish's real photos by changing only this file.
 */
import heroStudy from "@/assets/hero-study.jpg";
import catChairs from "@/assets/cat-chairs.jpg";
import catTables from "@/assets/cat-tables.jpg";
import catBeds from "@/assets/bed-double.jpg";
import catLamps from "@/assets/cat-lamps.jpg";
import workshop1 from "@/assets/workshop-1.jpg";
import workshop2 from "@/assets/workshop-2.jpg";
import lifestyleRoom from "@/assets/lifestyle-room.jpg";
import customSketch from "@/assets/custom-sketch.jpg";

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

/** Hero background video. Drop a file at this path to enable it. */
export const HERO_VIDEO_SRC = "/src/data/videos/gk-furniture-hero.mp4";

/** Resolve a database `image_key` to a bundled image, with a safe fallback. */
export function imageFor(key: string | null | undefined): string {
  if (key && key in IMAGES) return IMAGES[key as ImageKey];
  return IMAGES.room;
}

export const GALLERY = [
  { key: "chairs" as ImageKey, group: "chairs", caption: "Study chair, hand-finished" },
  { key: "tables" as ImageKey, group: "tables", caption: "Study table with drawer" },
  { key: "beds" as ImageKey, group: "beds", caption: "Single bed frame" },
  { key: "lamps" as ImageKey, group: "lamps", caption: "Wooden table lamp" },
  { key: "room" as ImageKey, group: "custom", caption: "A finished student room" },
  { key: "hero" as ImageKey, group: "custom", caption: "Desk, chair and lamp together" },
  { key: "workshop" as ImageKey, group: "workshop", caption: "Inside the workshop" },
  { key: "craft" as ImageKey, group: "workshop", caption: "Sanding a chair joint" },
  { key: "custom" as ImageKey, group: "custom", caption: "A custom desk, drawn to measure" },
];
