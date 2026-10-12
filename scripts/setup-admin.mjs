import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";

const env = Object.fromEntries(
  readFileSync(".env", "utf8")
    .split(/\r?\n/)
    .filter((l) => l && !l.startsWith("#"))
    .map((l) => {
      const i = l.indexOf("=");
      const k = l.slice(0, i);
      const v = l.slice(i + 1).replace(/^["']|["']$/g, "");
      return [k, v];
    }),
);

const url = env.SUPABASE_URL;
const key = env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env");
  process.exit(1);
}

const supabase = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const userId = "8670107e-c8af-4922-be51-c18f42692bba";

const { data: existing, error: e1 } = await supabase
  .from("admin_users")
  .select("user_id")
  .eq("user_id", userId)
  .maybeSingle();

if (e1) {
  console.error("CHECK_ERROR:", e1.message, e1.code, e1.details);
  process.exit(1);
}

if (existing) {
  console.log("ALREADY_ADMIN:", existing.user_id);
  process.exit(0);
}

const { data, error } = await supabase
  .from("admin_users")
  .insert({ user_id: userId })
  .select("user_id")
  .single();

if (error) {
  console.error("INSERT_ERROR:", error.message, error.code, error.details);
  process.exit(1);
}

console.log("ADMIN_OK:", data.user_id);
