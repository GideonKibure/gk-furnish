/** Reporting periods for the admin portal. Days are counted in Dar es Salaam time (UTC+3, no DST). */

export const DATE_RANGES = ["7d", "30d", "90d", "12m"] as const;
export type DateRange = (typeof DATE_RANGES)[number];

export const DATE_RANGE_LABELS: Record<DateRange, string> = {
  "7d": "Last 7 days",
  "30d": "Last 30 days",
  "90d": "Last 90 days",
  "12m": "Last 12 months",
};

export const TZ_OFFSET_MS = 3 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

export function isDateRange(value: unknown): value is DateRange {
  return typeof value === "string" && (DATE_RANGES as readonly string[]).includes(value);
}

/** `YYYY-MM-DD` of the instant in Dar es Salaam. */
export function darDayKey(value: string | number | Date) {
  return new Date(new Date(value).getTime() + TZ_OFFSET_MS).toISOString().slice(0, 10);
}

/** `YYYY-MM` of the instant in Dar es Salaam. */
export function darMonthKey(value: string | number | Date) {
  return darDayKey(value).slice(0, 7);
}

/** UTC instant of local midnight for a `YYYY-MM-DD` Dar es Salaam day. */
export function darMidnight(dayKey: string) {
  return new Date(`${dayKey}T00:00:00.000Z`).getTime() - TZ_OFFSET_MS;
}

/** Bounds for a custom `from`–`to` (inclusive Dar es Salaam days); day buckets up to 92 days, else months. */
export function customBounds(fromKey: string, toKey: string): RangeBounds {
  const [a, b] = fromKey <= toKey ? [fromKey, toKey] : [toKey, fromKey];
  const fromMs = darMidnight(a);
  const toMs = darMidnight(b) + DAY_MS;
  const days = Math.round((toMs - fromMs) / DAY_MS);
  const keys: string[] = [];
  let bucket: "day" | "month" = "day";
  if (days <= 92) {
    for (let i = 0; i < days; i++) keys.push(darDayKey(fromMs + i * DAY_MS + 1));
  } else {
    bucket = "month";
    for (let m = a.slice(0, 7); m <= b.slice(0, 7); ) {
      keys.push(m);
      const [y, mo] = m.split("-").map(Number) as [number, number];
      m = new Date(Date.UTC(y, mo, 1)).toISOString().slice(0, 7);
    }
  }
  return {
    from: new Date(fromMs),
    to: new Date(toMs - 1),
    prevFrom: new Date(fromMs - days * DAY_MS),
    prevTo: new Date(fromMs),
    bucket,
    keys,
  };
}

export type RangeBounds = {
  from: Date;
  to: Date;
  prevFrom: Date;
  prevTo: Date;
  bucket: "day" | "month";
  /** Bucket keys in order, `YYYY-MM-DD` or `YYYY-MM`. */
  keys: string[];
};

export function rangeBounds(range: DateRange, now = new Date()): RangeBounds {
  const todayKey = darDayKey(now);
  if (range === "12m") {
    const [y, m] = todayKey.split("-").map(Number) as [number, number];
    const keys: string[] = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date(Date.UTC(y, m - 1 - i, 1));
      keys.push(d.toISOString().slice(0, 7));
    }
    const from = new Date(darMidnight(`${keys[0]}-01`));
    const prevStart = new Date(Date.UTC(y, m - 1 - 23, 1)).toISOString().slice(0, 10);
    const prevFrom = new Date(darMidnight(prevStart));
    return { from, to: now, prevFrom, prevTo: from, bucket: "month", keys };
  }
  const days = range === "7d" ? 7 : range === "30d" ? 30 : 90;
  const todayStart = darMidnight(todayKey);
  const fromMs = todayStart - (days - 1) * DAY_MS;
  const keys: string[] = [];
  for (let i = 0; i < days; i++) keys.push(darDayKey(fromMs + i * DAY_MS + 1));
  const from = new Date(fromMs);
  return { from, to: now, prevFrom: new Date(fromMs - days * DAY_MS), prevTo: from, bucket: "day", keys };
}

export function inRange(value: string, from: Date, to: Date) {
  const t = new Date(value).getTime();
  return t >= from.getTime() && t < to.getTime() + 1;
}

/** Percent change against the previous period, or null when there is nothing to compare with. */
export function trendPercent(current: number, previous: number) {
  if (!previous) return current ? null : 0;
  return Math.round(((current - previous) / previous) * 1000) / 10;
}

export function bucketLabel(key: string, bucket: "day" | "month") {
  if (bucket === "month") {
    return new Date(`${key}-01T00:00:00Z`).toLocaleDateString("en-GB", { month: "short", timeZone: "UTC" });
  }
  return new Date(`${key}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
}
