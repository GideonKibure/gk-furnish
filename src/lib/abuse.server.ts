import { createHash } from "node:crypto";
import { getRequest } from "@tanstack/react-start/server";
import { isMissingSchema } from "@/lib/db-compat";
import {
  FORM_IP_LIMIT,
  FORM_PHONE_LIMIT,
  honeypotTripped,
  phoneSubject,
  rateDecision,
  rateWindowStart,
  turnstileActive,
} from "@/lib/abuse";

type SupabaseAdmin = Awaited<typeof import("@/integrations/supabase/client.server")>["supabaseAdmin"];

function clientIp() {
  const request = getRequest();
  const forwarded = request?.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || request?.headers.get("x-real-ip")?.trim() || "unknown";
}

function subjectHash(value: string) {
  return createHash("sha256").update(value).digest("hex").slice(0, 32);
}

async function hits(supabaseAdmin: SupabaseAdmin, form: string, subject: string, windowStart: string) {
  const { data, error } = await supabaseAdmin
    .from("form_rate_buckets")
    .select("hits")
    .eq("form", form)
    .eq("subject", subject)
    .eq("window_start", windowStart)
    .maybeSingle();
  if (error) {
    if (isMissingSchema(error)) return null;
    throw new Error(error.message);
  }
  return data?.hits ?? 0;
}

async function record(supabaseAdmin: SupabaseAdmin, form: string, subject: string, windowStart: string, current: number) {
  const { error } = await supabaseAdmin.from("form_rate_buckets").upsert(
    { form, subject, window_start: windowStart, hits: current + 1 },
    { onConflict: "form,subject,window_start" },
  );
  if (error && !isMissingSchema(error)) console.warn("rate bucket:", error.message);
}

/**
 * Reject a bot field, then count this IP and phone for the current hour.
 * A missing table does not block the customer. Turnstile runs only when both keys are set.
 */
export async function guardPublicForm(
  supabaseAdmin: SupabaseAdmin,
  input: {
    form: string;
    phone?: string | null | undefined;
    companyWebsite?: string | null | undefined;
    turnstileToken?: string | null | undefined;
  },
) {
  if (honeypotTripped(input.companyWebsite)) throw new Error("Please wait a few minutes and try again.");
  if (turnstileActive({
    TURNSTILE_SECRET_KEY: process.env["TURNSTILE_SECRET_KEY"],
    VITE_TURNSTILE_SITE_KEY: process.env["VITE_TURNSTILE_SITE_KEY"],
  })) {
    const token = input.turnstileToken?.trim() ?? "";
    if (!token) throw new Error("Please wait a few minutes and try again.");
    const body = new URLSearchParams({
      secret: process.env["TURNSTILE_SECRET_KEY"]?.trim() ?? "",
      response: token,
    });
    const response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", { method: "POST", body });
    const json = (await response.json()) as { success?: boolean };
    if (!json.success) throw new Error("Please wait a few minutes and try again.");
  }
  const windowStart = rateWindowStart(new Date());
  const subjects = [`ip:${subjectHash(clientIp())}`];
  const phone = phoneSubject(input.phone ?? "");
  if (phone) subjects.push(`phone:${subjectHash(phone)}`);
  for (const subject of subjects) {
    const count = await hits(supabaseAdmin, input.form, subject, windowStart);
    if (count == null) return;
    const limit = subject.startsWith("phone:") ? FORM_PHONE_LIMIT : FORM_IP_LIMIT;
    if (rateDecision(count, limit) === "block") throw new Error("Please wait a few minutes and try again.");
  }
  for (const subject of subjects) {
    const count = await hits(supabaseAdmin, input.form, subject, windowStart);
    if (count == null) return;
    await record(supabaseAdmin, input.form, subject, windowStart, count);
  }
}
