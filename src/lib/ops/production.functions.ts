import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireAdmin } from "@/integrations/supabase/admin-auth";
import { actorLabel, writeAudit } from "@/lib/audit.server";
import { isMissingSchema, migrationNeeded } from "@/lib/db-compat";
import { darToday, JOB_STARTED_STATUSES, JOB_STATUSES, JOB_STATUS_LABELS, QC_RESULTS } from "@/lib/ops/business";
import { finishedItemFor, MIGRATION_0008, recordMovement } from "@/lib/ops/inventory.server";
import { statusBlockers } from "@/lib/payment-policy";

type SupabaseAdmin = Awaited<typeof import("@/integrations/supabase/client.server")>["supabaseAdmin"];

const notReady = () => ({ available: false as const, reason: migrationNeeded(MIGRATION_0008) });

function fail(error: { code?: string | null; message: string }): never {
  if (isMissingSchema(error)) throw new Error(migrationNeeded(MIGRATION_0008));
  throw new Error(error.message);
}

const money = z.number().min(0).max(1_000_000_000);
const dateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

type MaterialRow = { quantity: number; unit_cost: number };
const materialTotal = (rows: MaterialRow[]) =>
  Math.round(rows.reduce((s, m) => s + Number(m.quantity) * Number(m.unit_cost), 0) * 100) / 100;

/** Jobs with their order, product, supplier, materials and quality checks. */
export const listJobs = createServerFn({ method: "GET" })
  .middleware([requireAdmin])
  .handler(async () => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("production_jobs")
      .select(
        "*, orders(order_number,customer_name,status), products(name), suppliers(name), production_materials(id,inventory_item_id,quantity,unit_cost,created_at,inventory_items(name,unit)), quality_checks(id,result,notes,checked_by,checked_at)",
      )
      .order("created_at", { ascending: false });
    if (error) {
      if (isMissingSchema(error)) return notReady();
      throw new Error(error.message);
    }
    const today = darToday();
    return {
      available: true as const,
      reason: null,
      today,
      jobs: (data ?? []).map((j) => {
        const order = j.orders as { order_number: string; customer_name: string; status: string } | null;
        const est = Number(j.est_material_cost) + Number(j.est_labour_cost) + Number(j.est_overhead_cost);
        const act = Number(j.act_material_cost) + Number(j.act_labour_cost) + Number(j.act_overhead_cost);
        return {
          ...j,
          est_material_cost: Number(j.est_material_cost),
          est_labour_cost: Number(j.est_labour_cost),
          est_overhead_cost: Number(j.est_overhead_cost),
          act_material_cost: Number(j.act_material_cost),
          act_labour_cost: Number(j.act_labour_cost),
          act_overhead_cost: Number(j.act_overhead_cost),
          est_total: est,
          act_total: act,
          order_number: order?.order_number ?? null,
          customer_name: order?.customer_name ?? null,
          order_status: order?.status ?? null,
          product_name: (j.products as { name: string } | null)?.name ?? null,
          supplier_name: (j.suppliers as { name: string } | null)?.name ?? null,
          materials: (j.production_materials ?? [])
            .map((m) => {
              const item = m.inventory_items as { name: string; unit: string } | null;
              return {
                id: m.id,
                inventory_item_id: m.inventory_item_id,
                quantity: Number(m.quantity),
                unit_cost: Number(m.unit_cost),
                created_at: m.created_at,
                item_name: item?.name ?? "Removed item",
                item_unit: item?.unit ?? "",
              };
            })
            .sort((a, b) => a.created_at.localeCompare(b.created_at)),
          checks: [...(j.quality_checks ?? [])].sort((a, b) => b.checked_at.localeCompare(a.checked_at)),
          overdue: Boolean(j.target_date && j.target_date < today && j.status !== "completed"),
        };
      }),
    };
  });

/** Pick lists for the job forms: suppliers, products, stock items and open order lines. */
export const listProductionOptions = createServerFn({ method: "GET" })
  .middleware([requireAdmin])
  .handler(async () => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [suppliers, products, items, orders] = await Promise.all([
      supabaseAdmin.from("suppliers").select("id,name,status").order("name"),
      supabaseAdmin.from("products").select("id,name").order("name"),
      supabaseAdmin
        .from("inventory_items")
        .select("id,name,unit,kind,quantity,unit_cost,product_id")
        .is("archived_at", null)
        .order("name"),
      supabaseAdmin
        .from("orders")
        .select("id,order_number,customer_name,status,created_at,order_items(id,product_id,product_name,quantity,material,size,color)")
        .not("status", "in", "(cancelled,completed,refunded,delivered)")
        .order("created_at", { ascending: false })
        .limit(200),
    ]);
    return {
      suppliers: suppliers.error ? [] : (suppliers.data ?? []).filter((s) => s.status === "active"),
      products: products.data ?? [],
      items: items.error
        ? []
        : (items.data ?? []).map((i) => ({ ...i, quantity: Number(i.quantity), unit_cost: Number(i.unit_cost) })),
      orders: (orders.data ?? []).map((o) => ({
        id: o.id,
        order_number: o.order_number,
        customer_name: o.customer_name,
        status: o.status,
        items: o.order_items ?? [],
      })),
    };
  });

async function estimateFromProduct(supabaseAdmin: SupabaseAdmin, productId: string | null | undefined, quantity: number) {
  if (!productId) return null;
  const { data } = await supabaseAdmin.from("product_costs").select("*").eq("product_id", productId).maybeSingle();
  if (!data) return null;
  return {
    est_material_cost: Number(data.material_cost) * quantity,
    est_labour_cost: Number(data.labour_cost) * quantity,
    est_overhead_cost: Number(data.overhead_cost) * quantity,
  };
}

const JobFields = z.object({
  description: z.string().trim().min(1).max(500),
  quantity: z.number().int().min(1).max(10_000),
  route: z.enum(["in_house", "partner"]),
  assignee: z.string().trim().max(120).optional().or(z.literal("")),
  supplier_id: z.string().uuid().nullable().optional(),
  target_date: dateStr.nullable().optional().or(z.literal("")),
  est_material_cost: money.optional(),
  est_labour_cost: money.optional(),
  est_overhead_cost: money.optional(),
  notes: z.string().trim().max(2000).optional().or(z.literal("")),
});

export const createJob = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .inputValidator((d) =>
    JobFields.extend({
      order_id: z.string().uuid().nullable().optional(),
      order_item_id: z.string().uuid().nullable().optional(),
      product_id: z.string().uuid().nullable().optional(),
    })
      .refine((v) => v.route !== "partner" || v.supplier_id, { message: "Choose the partner supplier", path: ["supplier_id"] })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let orderId = data.order_id ?? null;
    let productId = data.product_id ?? null;
    if (data.order_item_id) {
      const { data: line } = await supabaseAdmin
        .from("order_items")
        .select("order_id,product_id")
        .eq("id", data.order_item_id)
        .maybeSingle();
      if (!line) throw new Error("Order line not found");
      orderId = line.order_id;
      productId = productId ?? line.product_id;
    }
    const estimate =
      data.est_material_cost == null && data.est_labour_cost == null && data.est_overhead_cost == null
        ? await estimateFromProduct(supabaseAdmin, productId, data.quantity)
        : null;
    const { data: row, error } = await supabaseAdmin
      .from("production_jobs")
      .insert({
        order_id: orderId,
        order_item_id: data.order_item_id ?? null,
        product_id: productId,
        description: data.description,
        quantity: data.quantity,
        route: data.route,
        assignee: data.assignee || null,
        supplier_id: data.route === "partner" ? (data.supplier_id ?? null) : null,
        target_date: data.target_date || null,
        est_material_cost: estimate?.est_material_cost ?? data.est_material_cost ?? 0,
        est_labour_cost: estimate?.est_labour_cost ?? data.est_labour_cost ?? 0,
        est_overhead_cost: estimate?.est_overhead_cost ?? data.est_overhead_cost ?? 0,
        notes: data.notes || null,
      })
      .select("id,job_number")
      .single();
    if (error || !row) fail(error ?? { message: "Could not create the job" });
    return row;
  });

export const updateJob = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .inputValidator((d) =>
    JobFields.extend({ id: z.string().uuid(), completed_qty: z.number().int().min(0).max(10_000).optional() })
      .refine((v) => v.route !== "partner" || v.supplier_id, { message: "Choose the partner supplier", path: ["supplier_id"] })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("production_jobs")
      .update({
        description: data.description,
        quantity: data.quantity,
        route: data.route,
        assignee: data.assignee || null,
        supplier_id: data.route === "partner" ? (data.supplier_id ?? null) : null,
        target_date: data.target_date || null,
        ...(data.est_material_cost != null ? { est_material_cost: data.est_material_cost } : {}),
        ...(data.est_labour_cost != null ? { est_labour_cost: data.est_labour_cost } : {}),
        ...(data.est_overhead_cost != null ? { est_overhead_cost: data.est_overhead_cost } : {}),
        ...(data.completed_qty != null ? { completed_qty: data.completed_qty } : {}),
        notes: data.notes || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", data.id);
    if (error) fail(error);
    return { ok: true };
  });

/**
 * Move a job to a new status. Starting work on a customer order needs the advance and agreed
 * specifications (the production policy) unless an exception reason is recorded.
 */
export const setJobStatus = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .inputValidator((d) =>
    z
      .object({
        id: z.string().uuid(),
        status: z.enum(JOB_STATUSES),
        exception_reason: z.string().trim().max(500).optional().or(z.literal("")),
        completed_qty: z.number().int().min(0).max(10_000).optional(),
        finished_item_id: z.string().uuid().nullable().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: job, error } = await supabaseAdmin.from("production_jobs").select("*").eq("id", data.id).maybeSingle();
    if (error) fail(error);
    if (!job) throw new Error("Job not found");
    if (job.status === data.status) return { ok: true };
    if (job.status === "completed") throw new Error("This job is already completed");

    const starting = JOB_STARTED_STATUSES.includes(data.status);
    let exceptionUsed = false;
    if (starting && job.order_id && !job.exception_reason) {
      const { data: order } = await supabaseAdmin
        .from("orders")
        .select("total_amount,amount_paid,advance_required,specs_agreed_at,status")
        .eq("id", job.order_id)
        .maybeSingle();
      if (order) {
        const blockers = statusBlockers(
          {
            total_amount: Number(order.total_amount),
            amount_paid: Number(order.amount_paid),
            advance_required: Number(order.advance_required),
            specs_agreed_at: order.specs_agreed_at,
          },
          "in_production",
        );
        if (blockers.length) {
          const reason = data.exception_reason?.trim() ?? "";
          if (reason.length < 5) {
            throw new Error(`${blockers.join(" ")} Record an exception reason to start anyway.`);
          }
          exceptionUsed = true;
        }
      }
    }

    const now = new Date().toISOString();
    const completedQty = data.status === "completed" ? (data.completed_qty ?? (job.completed_qty || job.quantity)) : 0;
    const exceptionReason = exceptionUsed ? (data.exception_reason?.trim() ?? null) : null;
    const { error: upErr } = await supabaseAdmin
      .from("production_jobs")
      .update({
        status: data.status,
        ...(starting && !job.started_at ? { started_at: now } : {}),
        ...(data.status === "completed" ? { completed_at: now, completed_qty: completedQty } : {}),
        ...(exceptionReason ? { exception_reason: exceptionReason } : {}),
        updated_at: now,
      })
      .eq("id", job.id);
    if (upErr) fail(upErr);

    if (exceptionUsed) {
      await writeAudit(supabaseAdmin, {
        actor: context.userId,
        action: "production_exception",
        entity: "production_job",
        entityId: job.id,
        before: { status: job.status },
        after: { status: data.status, exception_reason: data.exception_reason, order_id: job.order_id },
      });
    }

    let stockedItem: string | null = null;
    if (data.status === "completed" && completedQty > 0) {
      const target =
        data.finished_item_id ?? (job.product_id ? ((await finishedItemFor(supabaseAdmin, job.product_id))?.id ?? null) : null);
      if (target) {
        const actual = Number(job.act_material_cost) + Number(job.act_labour_cost) + Number(job.act_overhead_cost);
        await recordMovement(supabaseAdmin, {
          itemId: target,
          type: "production_out",
          quantityChange: completedQty,
          unitCost: actual > 0 ? Math.round((actual / completedQty) * 100) / 100 : null,
          refEntity: "production_job",
          refId: job.id,
          note: `Completed ${job.job_number}`,
          actor: await actorLabel(supabaseAdmin, context.userId),
        });
        stockedItem = target;
      }
    }
    return { ok: true, label: JOB_STATUS_LABELS[data.status], stockedItem };
  });

/** Take material out of stock for a job and add it to the job's actual material cost. */
export const consumeMaterial = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .inputValidator((d) =>
    z
      .object({
        jobId: z.string().uuid(),
        inventoryItemId: z.string().uuid(),
        quantity: z.number().positive().max(1_000_000),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [{ data: job }, { data: item, error }] = await Promise.all([
      supabaseAdmin.from("production_jobs").select("id,job_number,status").eq("id", data.jobId).maybeSingle(),
      supabaseAdmin.from("inventory_items").select("id,name,unit_cost").eq("id", data.inventoryItemId).maybeSingle(),
    ]);
    if (error) fail(error);
    if (!job) throw new Error("Job not found");
    if (!item) throw new Error("Stock item not found");
    if (job.status === "completed") throw new Error("This job is already completed");

    await recordMovement(supabaseAdmin, {
      itemId: item.id,
      type: "production_use",
      quantityChange: -data.quantity,
      unitCost: Number(item.unit_cost),
      refEntity: "production_job",
      refId: job.id,
      note: `Used for ${job.job_number}`,
      actor: await actorLabel(supabaseAdmin, context.userId),
    });
    const { error: insErr } = await supabaseAdmin.from("production_materials").insert({
      job_id: job.id,
      inventory_item_id: item.id,
      quantity: data.quantity,
      unit_cost: Number(item.unit_cost),
    });
    if (insErr) fail(insErr);

    const { data: rows } = await supabaseAdmin.from("production_materials").select("quantity,unit_cost").eq("job_id", job.id);
    const total = materialTotal(rows ?? []);
    await supabaseAdmin
      .from("production_jobs")
      .update({ act_material_cost: total, updated_at: new Date().toISOString() })
      .eq("id", job.id);
    return { ok: true, act_material_cost: total };
  });

export const setActualCosts = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .inputValidator((d) =>
    z.object({ id: z.string().uuid(), act_labour_cost: money, act_overhead_cost: money }).parse(d),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("production_jobs")
      .update({
        act_labour_cost: data.act_labour_cost,
        act_overhead_cost: data.act_overhead_cost,
        updated_at: new Date().toISOString(),
      })
      .eq("id", data.id);
    if (error) fail(error);
    return { ok: true };
  });

/** Record a quality check. Rework sends the job back to finishing; a fail puts it on hold. */
export const addQualityCheck = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .inputValidator((d) =>
    z
      .object({
        job_id: z.string().uuid(),
        result: z.enum(QC_RESULTS),
        notes: z.string().trim().max(1000).optional().or(z.literal("")),
      })
      .refine((v) => v.result === "pass" || (v.notes ?? "").trim().length >= 3, {
        message: "Describe what failed or needs rework",
        path: ["notes"],
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: job } = await supabaseAdmin.from("production_jobs").select("id,status,notes").eq("id", data.job_id).maybeSingle();
    if (!job) throw new Error("Job not found");
    const { error } = await supabaseAdmin.from("quality_checks").insert({
      job_id: job.id,
      result: data.result,
      notes: data.notes || null,
      checked_by: await actorLabel(supabaseAdmin, context.userId),
    });
    if (error) fail(error);
    if (data.result !== "pass" && job.status !== "completed") {
      const next = data.result === "rework" ? "finishing" : "on_hold";
      const stamp = `[QC ${data.result}] ${data.notes ?? ""}`.trim();
      await supabaseAdmin
        .from("production_jobs")
        .update({
          status: next,
          notes: job.notes ? `${job.notes}\n${stamp}` : stamp,
          updated_at: new Date().toISOString(),
        })
        .eq("id", job.id);
    }
    return { ok: true };
  });

/** Only a queued job with no materials used can be deleted. */
export const deleteJob = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: job, error } = await supabaseAdmin.from("production_jobs").select("*").eq("id", data.id).maybeSingle();
    if (error) fail(error);
    if (!job) throw new Error("Job not found");
    if (job.status !== "queued") throw new Error("Only queued jobs can be deleted. Put the job on hold instead.");
    const { count } = await supabaseAdmin
      .from("production_materials")
      .select("id", { count: "exact", head: true })
      .eq("job_id", job.id);
    if (count) throw new Error("Materials were already used for this job; it cannot be deleted.");
    const { error: delErr } = await supabaseAdmin.from("production_jobs").delete().eq("id", job.id);
    if (delErr) fail(delErr);
    await writeAudit(supabaseAdmin, {
      actor: context.userId,
      action: "production_job_delete",
      entity: "production_job",
      entityId: job.id,
      before: job,
    });
    return { ok: true };
  });
