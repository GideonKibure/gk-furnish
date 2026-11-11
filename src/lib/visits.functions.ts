import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireAdmin } from "@/integrations/supabase/admin-auth";
import { optionalSupabaseAuth } from "@/integrations/supabase/customer-auth";
import { isMissingSchema, migrationNeeded, readOptional } from "@/lib/db-compat";

const MIGRATION = "0015_site_visits.sql";
const DAY = /^\d{4}-\d{2}-\d{2}$/;

function darDay(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Dar_es_Salaam",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function dayBounds(day: string) {
  const start = new Date(`${day}T00:00:00+03:00`);
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  return { start: start.toISOString(), end: end.toISOString() };
}

/** Record that this browser is still on the shop. Guests and signed-in customers both call it. */
export const beatSiteVisit = createServerFn({ method: "POST" })
  .middleware([optionalSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        visitId: z.string().uuid(),
        visitorId: z.string().uuid(),
        path: z.string().trim().max(180).regex(/^\/[A-Za-z0-9/_.=~%-]*$/),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    if (data.path.startsWith("/admin")) return { ok: true as const };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const now = new Date();
    const { data: existing, error: readError } = await supabaseAdmin
      .from("site_visits")
      .select("id,started_at,last_seen_at,duration_seconds,user_id,landing_path")
      .eq("id", data.visitId)
      .maybeSingle();
    if (readError) {
      if (isMissingSchema(readError)) return { ok: false as const };
      return { ok: false as const };
    }

    if (!existing) {
      const { error } = await supabaseAdmin.from("site_visits").insert({
        id: data.visitId,
        visitor_id: data.visitorId,
        user_id: context.userId,
        landing_path: data.path,
        last_path: data.path,
        started_at: now.toISOString(),
        last_seen_at: now.toISOString(),
        duration_seconds: 0,
      });
      if (error && !isMissingSchema(error)) return { ok: false as const };
      return { ok: true as const };
    }

    const elapsed = Math.round((now.getTime() - new Date(existing.last_seen_at).getTime()) / 1000);
    if (elapsed < 5) return { ok: true as const };
    const add = elapsed <= 60 ? elapsed : 0;
    const duration = Math.min(86400, Number(existing.duration_seconds) + add);
    const { error } = await supabaseAdmin
      .from("site_visits")
      .update({
        last_seen_at: now.toISOString(),
        last_path: data.path,
        duration_seconds: duration,
        user_id: existing.user_id ?? context.userId,
      })
      .eq("id", existing.id);
    if (error) return { ok: false as const };
    return { ok: true as const };
  });

export type VisitRow = {
  id: string;
  visitor: string;
  name: string | null;
  email: string | null;
  startedAt: string;
  lastSeenAt: string;
  durationSeconds: number;
  landingPath: string;
  lastPath: string;
};

/** Visits for one East Africa day. Admin only. */
export const listAdminVisits = createServerFn({ method: "GET" })
  .middleware([requireAdmin])
  .inputValidator((d) => z.object({ day: z.string().regex(DAY).optional() }).parse(d ?? {}))
  .handler(async ({ data }) => {
    const day = data.day && DAY.test(data.day) ? data.day : darDay();
    const { start, end } = dayBounds(day);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const listed = await readOptional(MIGRATION, [], () =>
      supabaseAdmin
        .from("site_visits")
        .select("id,visitor_id,user_id,landing_path,last_path,started_at,last_seen_at,duration_seconds")
        .gte("started_at", start)
        .lt("started_at", end)
        .order("started_at", { ascending: false })
        .limit(2000),
    );
    if (!listed.available) {
      return { available: false as const, reason: listed.reason || migrationNeeded(MIGRATION), day, visitors: 0, visits: 0, averageSeconds: 0, rows: [] as VisitRow[] };
    }
    const raw = listed.data;
    const userIds = [...new Set(raw.map((row) => row.user_id).filter((id): id is string => Boolean(id)))];
    const names = new Map<string, string | null>();
    if (userIds.length) {
      const { data: profiles } = await supabaseAdmin.from("customer_profiles").select("user_id,full_name").in("user_id", userIds);
      for (const profile of profiles ?? []) names.set(profile.user_id, profile.full_name);
    }
    const rows: VisitRow[] = raw.map((row) => {
      return {
        id: row.id,
        visitor: row.visitor_id.slice(0, 8),
        name: row.user_id ? names.get(row.user_id) ?? null : null,
        email: null,
        startedAt: row.started_at,
        lastSeenAt: row.last_seen_at,
        durationSeconds: Number(row.duration_seconds),
        landingPath: row.landing_path,
        lastPath: row.last_path,
      };
    });
    const visitors = new Set(raw.map((row) => row.visitor_id)).size;
    const total = rows.reduce((sum, row) => sum + row.durationSeconds, 0);
    return {
      available: true as const,
      reason: "",
      day,
      visitors,
      visits: rows.length,
      averageSeconds: rows.length ? Math.round(total / rows.length) : 0,
      rows,
    };
  });
