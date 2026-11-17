/** A phone prompt stays open for five minutes. After that the site cancels it. */
export const PROMPT_WINDOW_MS = 5 * 60 * 1000;

export const PROMPT_TIMEOUT_REASON = "Payment was not confirmed within 5 minutes.";

/** Milliseconds left in the five-minute window. Null when the start time is not a date. */
export function promptRemainingMs(createdAt: string, nowMs: number) {
  const start = new Date(createdAt).getTime();
  if (!Number.isFinite(start)) return null;
  return PROMPT_WINDOW_MS - (nowMs - start);
}

export function promptWindowClosed(createdAt: string, nowMs: number) {
  const left = promptRemainingMs(createdAt, nowMs);
  return left != null && left <= 0;
}

/** Clock label such as 4:05. */
export function formatPromptClock(remainingMs: number) {
  const total = Math.max(0, Math.ceil(remainingMs / 1000));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}
