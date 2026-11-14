/**
 * One arrangement per browser page load. A refresh gets a new seed from the
 * route loader. Moving between shop pages keeps the first seed, so the order
 * stays put. The server never stores the seed, so visitors do not share one.
 */
let remembered: number | null = null;

export function freshShopSeed() {
  return Math.floor(Math.random() * 0x7fffffff) || 1;
}

export function stableShopSeed(requestSeed: number) {
  if (typeof window === "undefined") return requestSeed;
  if (remembered == null) remembered = requestSeed;
  return remembered;
}

/** Stable rank for a product id and seed. Same id always lands in the same place. */
function rank(id: string, seed: number) {
  let hash = seed >>> 0;
  for (let i = 0; i < id.length; i++) {
    hash = Math.imul(hash ^ id.charCodeAt(i), 0x01000193) >>> 0;
  }
  return hash;
}

/**
 * Order the full catalogue before filters. Ranking by id keeps the same
 * relative order when a filter hides some products, and a new product slots
 * in without moving the others. The shop has no page controls; this order is
 * the list those pages would slice.
 */
export function orderBySeed<T extends { id: string }>(items: readonly T[], seed: number): T[] {
  if (!seed) return [...items];
  return [...items].sort((a, b) => rank(a.id, seed) - rank(b.id, seed) || a.id.localeCompare(b.id));
}
