export const FORM_WINDOW_MS = 60 * 60 * 1000;
export const FORM_IP_LIMIT = 8;
export const FORM_PHONE_LIMIT = 5;

export function honeypotTripped(value: string | null | undefined) {
  return Boolean(value?.trim());
}

export function rateWindowStart(now: Date) {
  return new Date(Math.floor(now.getTime() / FORM_WINDOW_MS) * FORM_WINDOW_MS).toISOString();
}

/** Block when this window already has `limit` hits. The current attempt is not counted yet. */
export function rateDecision(hits: number, limit: number) {
  return hits >= limit ? ("block" as const) : ("allow" as const);
}

export function phoneSubject(phone: string) {
  const digits = phone.replace(/\D/g, "");
  return digits ? `phone:${digits}` : "";
}

/** Turnstile stays off until both the site key and the secret are set. */
export function turnstileActive(env: { TURNSTILE_SECRET_KEY?: string | undefined; VITE_TURNSTILE_SITE_KEY?: string | undefined }) {
  return Boolean(env.TURNSTILE_SECRET_KEY?.trim() && env.VITE_TURNSTILE_SITE_KEY?.trim());
}

const SECRET_KEY = /api[_-]?key|secret|token|authorization|password|signature/i;

/** Hide secrets, and shorten emails and phone numbers, before a log line is written. */
export function maskLogValue(key: string, value: unknown): unknown {
  if (typeof value !== "string") return value;
  if (SECRET_KEY.test(key)) return "[redacted]";
  if (value.includes("@")) return value.replace(/^(.{1}).*(@.*)$/, "$1***$2");
  const digits = value.replace(/\D/g, "");
  if (digits.length >= 7 && digits.length <= 15) return value.replace(/\d(?=\d{3})/g, "*");
  return value;
}

export function maskLogFields(fields: Record<string, unknown>) {
  const safe: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(fields)) safe[key] = maskLogValue(key, value);
  return safe;
}
