import assert from "node:assert/strict";
import test from "node:test";
import { en } from "./en.ts";
import { sw } from "./sw.ts";

function paths(value: unknown, prefix: string, out: string[]) {
  if (Array.isArray(value)) {
    value.forEach((item, index) => paths(item, `${prefix}[${index}]`, out));
    return;
  }
  if (value !== null && typeof value === "object") {
    for (const key of Object.keys(value).sort()) {
      const next = prefix ? `${prefix}.${key}` : key;
      paths((value as Record<string, unknown>)[key], next, out);
    }
    return;
  }
  out.push(prefix);
}

function keySet(value: unknown) {
  const out: string[] = [];
  paths(value, "", out);
  return out;
}

test("English and Kiswahili dictionaries have the same keys", () => {
  const english = keySet(en);
  const swahili = keySet(sw);
  const missingInSwahili = english.filter((key) => !swahili.includes(key));
  const missingInEnglish = swahili.filter((key) => !english.includes(key));
  assert.deepEqual(missingInSwahili, []);
  assert.deepEqual(missingInEnglish, []);
});
