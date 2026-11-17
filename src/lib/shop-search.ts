import { SEARCH_SYNONYM_GROUPS } from "./search-synonyms.ts";

export function normalizeSearchText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{M}+/gu, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Insert, delete, or replace count. Stops once the distance is already over 1. */
export function editDistance(a: string, b: string): number {
  if (a === b) return 0;
  const width = b.length;
  if (Math.abs(a.length - width) > 1) return 2;
  let prev = Array.from({ length: width + 1 }, (_, index) => index);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    let rowMin = i;
    for (let j = 1; j <= width; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      const next = Math.min((prev[j] ?? 0) + 1, (cur[j - 1] ?? 0) + 1, (prev[j - 1] ?? 0) + cost);
      cur[j] = next;
      if (next < rowMin) rowMin = next;
    }
    if (rowMin > 1) return 2;
    prev = cur;
  }
  return prev[width] ?? 2;
}

function groupsFor(token: string): string[][] {
  const found: string[][] = [];
  for (const group of SEARCH_SYNONYM_GROUPS) {
    const members = group.map((item) => normalizeSearchText(item));
    const matched = members.some((member) => {
      if (member === token) return true;
      if (token.length >= 5 && member.length >= 5 && !member.includes(" ") && editDistance(member, token) <= 1) return true;
      return member.split(" ").some((word) => word.length >= 4 && word === token);
    });
    if (matched) found.push(members);
  }
  return found;
}

function optionsFor(token: string): string[] {
  const options = new Set<string>([token]);
  for (const members of groupsFor(token)) {
    for (const member of members) options.add(member);
  }
  return [...options];
}

function phraseOptions(query: string): string[] {
  const options = new Set<string>([query]);
  for (const group of SEARCH_SYNONYM_GROUPS) {
    const members = group.map((item) => normalizeSearchText(item));
    if (members.includes(query)) {
      for (const member of members) options.add(member);
    }
  }
  return [...options];
}

function tokenMatches(text: string, token: string): boolean {
  const words = text.split(" ").filter((word) => word.length > 0);
  for (const option of optionsFor(token)) {
    if (!option) continue;
    if (text.includes(option)) return true;
    if (option.length < 5 || option.includes(" ")) continue;
    for (const word of words) {
      if (word.length >= 5 && editDistance(word, option) <= 1) return true;
    }
  }
  return false;
}

export function textMatches(text: string, query: string): boolean {
  const norm = normalizeSearchText(text);
  const q = normalizeSearchText(query);
  if (!q || !norm) return false;
  if (phraseOptions(q).some((phrase) => phrase.length > 0 && norm.includes(phrase))) return true;
  return q.split(" ").every((token) => tokenMatches(norm, token));
}

export type SearchDoc = { name: string; category: string; description: string };

/** 0 exact name, 1 name through a synonym or typo, 2 category, 3 description. */
export function searchTier(query: string, doc: SearchDoc): 0 | 1 | 2 | 3 | null {
  const q = normalizeSearchText(query);
  if (!q) return null;
  if (normalizeSearchText(doc.name).includes(q)) return 0;
  if (textMatches(doc.name, q)) return 1;
  if (textMatches(doc.category, q)) return 2;
  if (textMatches(doc.description, q)) return 3;
  return null;
}

export function rankSearch<T>(items: readonly T[], query: string, toDoc: (item: T) => SearchDoc): T[] {
  const q = normalizeSearchText(query);
  if (!q) return [...items];
  const ranked: { item: T; tier: number; index: number }[] = [];
  items.forEach((item, index) => {
    const tier = searchTier(q, toDoc(item));
    if (tier == null) return;
    ranked.push({ item, tier, index });
  });
  ranked.sort((a, b) => a.tier - b.tier || a.index - b.index);
  return ranked.map((row) => row.item);
}

export type BudgetBand = {
  id: "under-100000" | "100000-300000" | "300000-700000" | "over-700000";
  min: number | null;
  max: number | null;
};

const BUDGET_BANDS: readonly BudgetBand[] = [
  { id: "under-100000", min: null, max: 99_999 },
  { id: "100000-300000", min: 100_000, max: 300_000 },
  { id: "300000-700000", min: 300_001, max: 700_000 },
  { id: "over-700000", min: 700_001, max: null },
];

export function priceInBand(price: number, band: BudgetBand): boolean {
  if (!(price > 0)) return false;
  if (band.min != null && price < band.min) return false;
  if (band.max != null && price > band.max) return false;
  return true;
}

/** Bands that contain at least one real positive price. Unpriced values are ignored. */
export function bandsForPrices(prices: readonly (number | null | undefined)[]): BudgetBand[] {
  const usable = prices.filter((price): price is number => typeof price === "number" && price > 0);
  return BUDGET_BANDS.filter((band) => usable.some((price) => priceInBand(price, band)));
}

export function bandForLimits(
  bands: readonly BudgetBand[],
  min: number | undefined,
  max: number | undefined,
): BudgetBand | null {
  return bands.find((band) => (band.min ?? undefined) === min && (band.max ?? undefined) === max) ?? null;
}

export const EMPTY_RESULT_ACTIONS = ["clear", "whatsapp", "custom"] as const;
