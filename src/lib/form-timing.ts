import { honeypotTripped } from "./abuse.ts";

/** How long a person needs before a public form is accepted. */
export const MIN_SUBMIT_MS = 2_000;

export function formTooFast(startedAt: number | undefined, now: number) {
  if (startedAt == null || !Number.isFinite(startedAt)) return false;
  return now - startedAt < MIN_SUBMIT_MS;
}

/** A hidden field looks like success. A form sent too quickly does not. */
export function publicFormOutcome(website: string | undefined, startedAt: number | undefined, now: number) {
  if (honeypotTripped(website)) return "silent" as const;
  if (formTooFast(startedAt, now)) return "slow" as const;
  return "ok" as const;
}

export const PHOTO_MAX_EDGE = 1600;
export const PHOTO_QUALITY = 0.8;
export const REFERENCE_BYTE_LIMIT = 4_000_000;

export function referencePhotosFit(sizes: readonly number[]) {
  if (sizes.length > 3) return false;
  const total = sizes.reduce((sum, size) => sum + size, 0);
  return total <= REFERENCE_BYTE_LIMIT && sizes.every((size) => size > 0);
}
