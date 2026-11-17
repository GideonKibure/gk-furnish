import assert from "node:assert/strict";
import test from "node:test";
import { honeypotTripped } from "./abuse.ts";
import { parseCustomDraft, moveCustomStep, serialiseCustomDraft, type CustomDraft } from "./custom-draft.ts";
import { formTooFast, publicFormOutcome, referencePhotosFit } from "./form-timing.ts";
import { fittedSize } from "./image-size.ts";

const draft: CustomDraft = {
  step: 2,
  furnitureType: "Desk",
  description: "Twenty school desks",
  quantity: "20",
  dimensions: "",
  materialNote: "",
  colorNote: "",
  materials: [],
  colors: [],
  budget: "",
  neededBy: "",
  finish: "",
  requirements: "",
  fullName: "Asha",
  phone: "0692 713 993",
  email: "",
  location: "Mbeya",
  startedAt: 1_000,
};

test("custom steps move back and forward and stay inside 1 to 4", () => {
  assert.equal(moveCustomStep(1, "back"), 1);
  assert.equal(moveCustomStep(1, "next"), 2);
  assert.equal(moveCustomStep(4, "next"), 4);
  assert.equal(moveCustomStep(3, "back"), 2);
});

test("a custom draft survives a refresh and a bad copy is ignored", () => {
  const again = parseCustomDraft(serialiseCustomDraft(draft));
  assert.equal(again?.furnitureType, "Desk");
  assert.equal(again?.quantity, "20");
  assert.equal(again?.phone, "0692 713 993");
  assert.equal(parseCustomDraft("nope"), null);
  assert.equal(parseCustomDraft(null), null);
});

test("photos are fitted inside 1600 pixels and three compressed files must stay under the send limit", () => {
  assert.deepEqual(fittedSize(4000, 3000, 1600), { width: 1600, height: 1200 });
  assert.deepEqual(fittedSize(800, 600, 1600), { width: 800, height: 600 });
  assert.equal(referencePhotosFit([200_000, 200_000, 200_000]), true);
  assert.equal(referencePhotosFit([2_000_000, 2_000_000, 2_000_000]), false);
  assert.equal(referencePhotosFit([1, 1, 1, 1]), false);
});

test("a honeypot hit looks like success and a form sent too quickly does not", () => {
  assert.equal(honeypotTripped("http://spam"), true);
  assert.equal(honeypotTripped(""), false);
  assert.equal(publicFormOutcome("http://spam", 1_000, 9_000), "silent");
  assert.equal(publicFormOutcome("", 1_000, 1_500), "slow");
  assert.equal(publicFormOutcome("", undefined, 4_000), "ok");
  assert.equal(formTooFast(1_000, 4_000), false);
});
