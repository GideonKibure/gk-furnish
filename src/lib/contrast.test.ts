import assert from "node:assert/strict";
import test from "node:test";
import { contrastRatio } from "./contrast.ts";

const white = [255, 255, 255] as const;
const navy = [20, 33, 61] as const;
const gold = [252, 163, 17] as const;
const goldInk = [184, 106, 0] as const;
const muted = [91, 100, 115] as const;
const sand = [245, 246, 248] as const;

test("brand pairs meet the body or large-text contrast they are used for", () => {
  assert.ok(contrastRatio(navy, white) >= 4.5);
  assert.ok(contrastRatio(navy, gold) >= 4.5);
  assert.ok(contrastRatio(gold, navy) >= 4.5);
  assert.ok(contrastRatio(muted, white) >= 4.5);
  assert.ok(contrastRatio(muted, sand) >= 4.5);
  assert.ok(contrastRatio(gold, white) < 3);
  assert.ok(contrastRatio(goldInk, white) >= 3);
  assert.ok(contrastRatio(goldInk, white) < 4.5);
  assert.ok(contrastRatio(goldInk, navy) >= 3);
});
