import assert from "node:assert/strict";
import test from "node:test";
import { orderBySeed } from "./shop-order.ts";
import {
  EMPTY_RESULT_ACTIONS,
  bandForLimits,
  bandsForPrices,
  normalizeSearchText,
  rankSearch,
  searchTier,
  textMatches,
  type SearchDoc,
} from "./shop-search.ts";

const doc = (name: string, category = "", description = ""): SearchDoc => ({ name, category, description });

test("search text is folded the same way in both languages", () => {
  assert.equal(normalizeSearchText("  Kíti   cha   Kusomea "), "kiti cha kusomea");
  assert.equal(normalizeSearchText("MEZA"), "meza");
});

test("synonyms match in both directions", () => {
  assert.equal(textMatches("Royal Bed", "kitanda"), true);
  assert.equal(textMatches("Kitanda cha mbao", "bed"), true);
  assert.equal(textMatches("Kiti cha kusomea", "study chair"), true);
  assert.equal(textMatches("Study table", "meza ya kusomea"), true);
  assert.equal(textMatches("Kabati", "wardrobe"), true);
  assert.equal(textMatches("Lamp", "meza"), false);
});

test("a one-letter slip counts only when the word has 5 letters or more", () => {
  assert.equal(textMatches("Office chair", "chais"), true);
  assert.equal(textMatches("Kitanda", "kitnda"), true);
  assert.equal(textMatches("Bed", "bad"), false);
  assert.equal(textMatches("Kiti", "ktii"), false);
});

test("name matches rank above category, then description, and ties keep their order", () => {
  const items = [
    { id: "desc", ...doc("Stool", "Seating", "placed beside the bed") },
    { id: "cat", ...doc("Royal", "Beds", "solid wood") },
    { id: "name", ...doc("Bed", "Sleep", "") },
    { id: "syn", ...doc("Kitanda", "Sleep", "") },
  ];
  assert.deepEqual(
    rankSearch(items, "bed", (item) => item).map((item) => item.id),
    ["name", "syn", "cat", "desc"],
  );
  assert.equal(searchTier("bed", doc("Bed")), 0);
  assert.equal(searchTier("kitanda", doc("Bed")), 1);
  assert.equal(searchTier("bed", doc("Royal", "Beds")), 2);
  assert.equal(searchTier("bed", doc("Stool", "Seating", "beside the bed")), 3);
});

test("an empty search keeps Discover order, and hiding items does not reshuffle the rest", () => {
  const items = [{ id: "c" }, { id: "a" }, { id: "b" }];
  const ordered = orderBySeed(items, 42);
  const hidden = new Set(["a"]);
  const filtered = ordered.filter((item) => !hidden.has(item.id));
  assert.deepEqual(
    rankSearch(ordered, "", () => doc("")),
    ordered,
  );
  assert.deepEqual(
    filtered.map((item) => item.id),
    ordered.filter((item) => item.id !== "a").map((item) => item.id),
  );
});

test("budget chips come from real prices and round-trip through min and max", () => {
  const bands = bandsForPrices([50_000, 0, null, 150_000, 800_000]);
  assert.deepEqual(
    bands.map((band) => band.id),
    ["under-100000", "100000-300000", "over-700000"],
  );
  const chosen = bands.find((band) => band.id === "100000-300000");
  assert.ok(chosen);
  const min = chosen.min ?? undefined;
  const max = chosen.max ?? undefined;
  assert.equal(bandForLimits(bands, min, max)?.id, "100000-300000");
  assert.equal(bandForLimits(bands, undefined, undefined), null);
});

test("an empty result offers clear, WhatsApp, and a custom request", () => {
  assert.deepEqual(EMPTY_RESULT_ACTIONS, ["clear", "whatsapp", "custom"]);
});
