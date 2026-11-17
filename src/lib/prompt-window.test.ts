import assert from "node:assert/strict";
import test from "node:test";
import {
  formatPromptClock,
  promptRemainingMs,
  promptWindowClosed,
  PROMPT_WINDOW_MS,
} from "./prompt-window.ts";

const start = "2026-11-17T12:00:00.000Z";
const startMs = Date.parse(start);

test("a phone prompt lasts five minutes and then closes", () => {
  assert.equal(promptRemainingMs(start, startMs), PROMPT_WINDOW_MS);
  assert.equal(promptWindowClosed(start, startMs + PROMPT_WINDOW_MS - 1), false);
  assert.equal(promptWindowClosed(start, startMs + PROMPT_WINDOW_MS), true);
  assert.equal(promptRemainingMs("not-a-date", startMs), null);
  assert.equal(formatPromptClock(65_000), "1:05");
  assert.equal(formatPromptClock(0), "0:00");
});
