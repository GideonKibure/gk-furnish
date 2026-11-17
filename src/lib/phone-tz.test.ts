import assert from "node:assert/strict";
import test from "node:test";
import { normaliseTzMobile } from "./phone-tz.ts";

test("Tanzanian mobiles become +255 and keep what was typed out of the stored value", () => {
  assert.equal(normaliseTzMobile("0692 713 993"), "+255692713993");
  assert.equal(normaliseTzMobile("(0692) 713-993"), "+255692713993");
  assert.equal(normaliseTzMobile("+255692713993"), "+255692713993");
  assert.equal(normaliseTzMobile("255692713993"), "+255692713993");
  assert.equal(normaliseTzMobile("692713993"), "+255692713993");
  assert.equal(normaliseTzMobile("  +255 692 713 993  "), "+255692713993");
});

test("a number that is not a 9-digit Tanzanian mobile is refused", () => {
  assert.equal(normaliseTzMobile(""), null);
  assert.equal(normaliseTzMobile("12345"), null);
  assert.equal(normaliseTzMobile("+254692713993"), null);
  assert.equal(normaliseTzMobile("06927139"), null);
  assert.equal(normaliseTzMobile("call me"), null);
  assert.equal(normaliseTzMobile("06927139931"), null);
});
