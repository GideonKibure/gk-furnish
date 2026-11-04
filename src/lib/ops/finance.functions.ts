import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireAdmin } from "@/integrations/supabase/admin-auth";
import { writeAudit } from "@/lib/audit.server";
import { isMissingSchema, migrationNeeded } from "@/lib/db-compat";
import { CAPITAL_SOURCES, darToday } from "@/lib/ops/business";
import { MIGRATION_0008 } from "@/lib/ops/inventory.server";

const DATE = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const optionalText = (max: number) => z.string().trim().max(max).optional().or(z.literal(""));

function fail(error: { code?: string | null; message?: string | null }): never {
  if (isMissingSchema(error)) throw new Error(migrationNeeded(MIGRATION_0008));
  throw new Error(error.message ?? "Database error");
}

/** Whole months from `from` to `to` (both `YYYY-MM-DD`), never negative. */
function monthsBetween(from: string, to: string) {
  const [fy, fm, fd] = from.split("-").map(Number) as [number, number, number];
  const [ty, tm, td] = to.split("-").map(Number) as [number, number, number];
  const months = (ty - fy) * 12 + (tm - fm) - (td < fd ? 1 : 0);
  return Math.max(0, months);
}

/** Straight-line depreciation: equal monthly amounts over the useful life, down to zero. */
export function assetBookValue(
  asset: {
    cost: number;
    purchase_date: string | null;
    useful_life_months: number | null;
    disposed_at: string | null;
  },
  today = darToday(),
) {
  const cost = Number(asset.cost);
  if (!asset.purchase_date || !asset.useful_life_months) {
    return { monthly: 0, monthsUsed: 0, depreciation: 0, bookValue: asset.disposed_at ? 0 : cost };
  }
  const monthly = cost / asset.useful_life_months;
  const end = asset.disposed_at && asset.disposed_at < today ? asset.disposed_at : today;
  const monthsUsed = Math.min(asset.useful_life_months, monthsBetween(asset.purchase_date, end));
  const depreciation = Math.round(monthly * monthsUsed);
  return {
    monthly: Math.round(monthly),
    monthsUsed,
    depreciation,
    bookValue: asset.disposed_at ? 0 : Math.max(0, cost - depreciation),
  };
}

/** Capital contributions and assets in one call for the Capital & assets page. */
export const listFinanceRegisters = createServerFn({ method: "GET" })
  .middleware([requireAdmin])
  .handler(async () => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [capital, assets] = await Promise.all([
      supabaseAdmin
        .from("capital_contributions")
        .select("*")
        .order("date", { ascending: false })
        .order("created_at", { ascending: false }),
      supabaseAdmin
        .from("assets")
        .select("*")
        .order("purchase_date", { ascending: false, nullsFirst: false }),
    ]);
    const missing = capital.error ?? assets.error;
    if (missing) {
      if (isMissingSchema(missing)) {
        return {
          available: false as const,
          reason: migrationNeeded(MIGRATION_0008),
          capital: [],
          assets: [],
          totals: null,
        };
      }
      throw new Error(missing.message);
    }

    const capitalRows = (capital.data ?? []).map((c) => ({ ...c, amount: Number(c.amount) }));
    const today = darToday();
    const assetRows = (assets.data ?? []).map((a) => {
      const row = { ...a, cost: Number(a.cost) };
      return { ...row, ...assetBookValue(row, today) };
    });
    const bySource = Object.fromEntries(CAPITAL_SOURCES.map((s) => [s, 0])) as Record<
      (typeof CAPITAL_SOURCES)[number],
      number
    >;
    for (const c of capitalRows) {
      if ((CAPITAL_SOURCES as readonly string[]).includes(c.source))
        bySource[c.source as (typeof CAPITAL_SOURCES)[number]] += c.amount;
    }
    const inUse = assetRows.filter((a) => !a.disposed_at);
    return {
      available: true as const,
      reason: null,
      capital: capitalRows,
      assets: assetRows,
      totals: {
        capital: capitalRows.reduce((s, c) => s + c.amount, 0),
        bySource,
        assetCost: inUse.reduce((s, a) => s + a.cost, 0),
        bookValue: inUse.reduce((s, a) => s + a.bookValue, 0),
        monthlyDepreciation: inUse.reduce(
          (s, a) => s + (a.monthsUsed < (a.useful_life_months ?? 0) ? a.monthly : 0),
          0,
        ),
      },
    };
  });

const CapitalInput = z.object({
  id: z.string().uuid().optional(),
  date: DATE,
  source: z.enum(CAPITAL_SOURCES),
  contributor: optionalText(200),
  amount: z.number().positive().max(10_000_000_000),
  terms: optionalText(1000),
  notes: optionalText(1000),
});

export const upsertCapitalContribution = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .inputValidator((d) => CapitalInput.parse(d))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const body = {
      date: data.date,
      source: data.source,
      contributor: data.contributor || null,
      amount: data.amount,
      terms: data.terms || null,
      notes: data.notes || null,
    };
    if (data.id) {
      const { data: before, error: loadErr } = await supabaseAdmin
        .from("capital_contributions")
        .select("*")
        .eq("id", data.id)
        .maybeSingle();
      if (loadErr) fail(loadErr);
      if (!before) throw new Error("Contribution not found");
      const { error } = await supabaseAdmin
        .from("capital_contributions")
        .update(body)
        .eq("id", data.id);
      if (error) fail(error);
      if (Number(before.amount) !== data.amount || before.source !== data.source) {
        await writeAudit(supabaseAdmin, {
          actor: context.userId,
          action: "capital_change",
          entity: "capital_contribution",
          entityId: data.id,
          before: { amount: Number(before.amount), source: before.source },
          after: { amount: data.amount, source: data.source },
        });
      }
      return { id: data.id };
    }
    const { data: row, error } = await supabaseAdmin
      .from("capital_contributions")
      .insert(body)
      .select("id")
      .single();
    if (error) fail(error);
    return { id: row.id };
  });

export const deleteCapitalContribution = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row, error } = await supabaseAdmin
      .from("capital_contributions")
      .delete()
      .eq("id", data.id)
      .select("*")
      .maybeSingle();
    if (error) fail(error);
    await writeAudit(supabaseAdmin, {
      actor: context.userId,
      action: "capital_delete",
      entity: "capital_contribution",
      entityId: data.id,
      before: row ? { ...row, amount: Number(row.amount) } : null,
    });
    return { ok: true };
  });

const AssetInput = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(1).max(200),
  category: optionalText(120),
  purchase_date: DATE.optional().or(z.literal("")),
  cost: z.number().min(0).max(10_000_000_000),
  useful_life_months: z.number().int().positive().max(1200).nullable(),
  notes: optionalText(1000),
  disposed_at: DATE.optional().or(z.literal("")),
});

export const upsertAsset = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .inputValidator((d) => AssetInput.parse(d))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const body = {
      name: data.name,
      category: data.category || null,
      purchase_date: data.purchase_date || null,
      cost: data.cost,
      useful_life_months: data.useful_life_months,
      notes: data.notes || null,
      disposed_at: data.disposed_at || null,
    };
    if (data.id) {
      const { data: before, error: loadErr } = await supabaseAdmin
        .from("assets")
        .select("*")
        .eq("id", data.id)
        .maybeSingle();
      if (loadErr) fail(loadErr);
      if (!before) throw new Error("Asset not found");
      const { error } = await supabaseAdmin.from("assets").update(body).eq("id", data.id);
      if (error) fail(error);
      if (Number(before.cost) !== data.cost || (before.disposed_at ?? null) !== body.disposed_at) {
        await writeAudit(supabaseAdmin, {
          actor: context.userId,
          action: body.disposed_at && !before.disposed_at ? "asset_dispose" : "asset_change",
          entity: "asset",
          entityId: data.id,
          before: { cost: Number(before.cost), disposed_at: before.disposed_at },
          after: { cost: data.cost, disposed_at: body.disposed_at },
        });
      }
      return { id: data.id };
    }
    const { data: row, error } = await supabaseAdmin
      .from("assets")
      .insert(body)
      .select("id")
      .single();
    if (error) fail(error);
    return { id: row.id };
  });

export const deleteAsset = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row, error } = await supabaseAdmin
      .from("assets")
      .delete()
      .eq("id", data.id)
      .select("*")
      .maybeSingle();
    if (error) fail(error);
    await writeAudit(supabaseAdmin, {
      actor: context.userId,
      action: "asset_delete",
      entity: "asset",
      entityId: data.id,
      before: row ? { ...row, cost: Number(row.cost) } : null,
    });
    return { ok: true };
  });
