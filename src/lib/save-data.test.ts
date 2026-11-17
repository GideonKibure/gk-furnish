import assert from "node:assert/strict";
import test from "node:test";
import { cardSrcSet, cardVariantUrl } from "./image-size.ts";
import { saveDataChoice } from "./save-data.ts";

test("save data stays off unless the customer or the browser asks for it", () => {
  assert.equal(saveDataChoice(null, undefined), false);
  assert.equal(saveDataChoice(null, false), false);
  assert.equal(saveDataChoice(null, true), true);
  assert.equal(saveDataChoice("1", false), true);
  assert.equal(saveDataChoice("0", true), false);
});

test("a stored WebP offers the 800px sibling and the full file", () => {
  const full = "https://cdn.example/product-images/chair.webp";
  assert.equal(cardVariantUrl(full), "https://cdn.example/product-images/chair-w800.webp");
  assert.equal(cardSrcSet(full), `${cardVariantUrl(full)} 800w, ${full} 1600w`);
  assert.equal(cardSrcSet("https://cdn.example/other/chair.jpg"), null);
  assert.equal(cardSrcSet(cardVariantUrl(full)), null);
});
