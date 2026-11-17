import assert from "node:assert/strict";
import test from "node:test";
import { developmentUsesProductionDatabase } from "./dev-safety.server.ts";

const PRODUCTION = "https://live-project.supabase.co";
const STAGING = "https://staging-project.supabase.co";

test("development against the production Supabase host warns", () => {
  assert.equal(
    developmentUsesProductionDatabase({
      NODE_ENV: "development",
      APP_ENV: "development",
      SUPABASE_URL: PRODUCTION,
      SUPABASE_PRODUCTION_URL: PRODUCTION,
    }),
    true,
  );
});

test("development against a staging host does not warn", () => {
  assert.equal(
    developmentUsesProductionDatabase({
      NODE_ENV: "development",
      APP_ENV: "staging",
      SUPABASE_URL: STAGING,
      SUPABASE_PRODUCTION_URL: PRODUCTION,
    }),
    false,
  );
});

test("a production server does not warn", () => {
  assert.equal(
    developmentUsesProductionDatabase({
      NODE_ENV: "production",
      APP_ENV: "production",
      SUPABASE_URL: PRODUCTION,
      SUPABASE_PRODUCTION_URL: PRODUCTION,
    }),
    false,
  );
});

test("development with no APP_ENV and no production URL warns", () => {
  assert.equal(
    developmentUsesProductionDatabase({
      NODE_ENV: "development",
      SUPABASE_URL: PRODUCTION,
    }),
    true,
  );
});

test("APP_ENV=staging without a production URL to compare does not warn", () => {
  assert.equal(
    developmentUsesProductionDatabase({
      NODE_ENV: "development",
      APP_ENV: "staging",
      SUPABASE_URL: STAGING,
    }),
    false,
  );
});
