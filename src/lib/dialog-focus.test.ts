import assert from "node:assert/strict";
import test from "node:test";
import { cycleTab } from "./dialog-focus.ts";

test("dialog tabbing stays inside the open layer", () => {
  const items = ["close", "name", "send"];
  assert.equal(cycleTab(items, "send", false), "close");
  assert.equal(cycleTab(items, "close", true), "send");
  assert.equal(cycleTab(items, "name", false), "send");
  assert.equal(cycleTab(items, null, false), "close");
  assert.equal(cycleTab(items, null, true), "send");
  assert.equal(cycleTab([], "name", false), null);
});
