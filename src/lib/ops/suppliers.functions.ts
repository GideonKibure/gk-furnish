import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireAdmin } from "@/integrations/supabase/admin-auth";
import { writeAudit } from "@/lib/audit.server";
import { isMissingSchema, migrationNeeded } from "@/lib/db-compat";
import { MIGRATION_0008 } from "@/lib/ops/inventory.server";

const missing = () => ({ available: false as const, reason: migrationNeeded(MIGRATION_0008) });

/** POs that count towards what we owe: sent or receiving (drafts are not commitments yet). */
const PAYABLE_PO_STATUSES: readonly string[] = ["sent", "partially_received", "received"];

function landedCost(po: { total: number | string; transport_cost: number | string; inspection_cost: number | string }) {
  return Number(po.total) + Number(po.transport_cost) + Number(po.inspection_cost);
}

/** Suppliers with what is still owed on their POs. Payables = Σ max(0, landed − paid on PO) − payments not tied to a PO. */
export const listSuppliers = createServerFn({ method: "GET" })
  .middleware([requireAdmin])
  .handler(async () => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("suppliers")
      .select(
        "*, purchase_orders(id,po_number,status,order_date,expected_date,total,transport_cost,inspection_cost), supplier_payments(id,po_id,amount,method,paid_at,reference,note)",
      )
      .order("name");
    if (error) {
      if (isMissingSchema(error)) return missing();
      throw new Error(error.message);
    }
    const rows = (data ?? []).map((s) => {
      const pos = [...(s.purchase_orders ?? [])].sort((a, b) => b.order_date.localeCompare(a.order_date));
      const payments = [...(s.supplier_payments ?? [])]
        .map((p) => ({ ...p, amount: Number(p.amount) }))
        .sort((a, b) => b.paid_at.localeCompare(a.paid_at));
      const paidByPo = new Map<string, number>();
      let unlinked = 0;
      for (const p of payments) {
        if (p.po_id) paidByPo.set(p.po_id, (paidByPo.get(p.po_id) ?? 0) + p.amount);
        else unlinked += p.amount;
      }
      const poRows = pos.map((po) => {
        const landed = landedCost(po);
        const paid = paidByPo.get(po.id) ?? 0;
        return { ...po, landed, paid, balance: Math.max(0, landed - paid) };
      });
      const owed = poRows.filter((po) => PAYABLE_PO_STATUSES.includes(po.status)).reduce((s, po) => s + po.balance, 0);
      return {
        ...s,
        purchase_orders: poRows,
        supplier_payments: payments,
        payable: Math.max(0, Math.round(owed - unlinked)),
        total_paid: payments.reduce((sum, p) => sum + p.amount, 0),
        open_po_count: poRows.filter((po) => ["draft", "sent", "partially_received"].includes(po.status)).length,
        last_order_date: pos[0]?.order_date ?? null,
      };
    });
    return { available: true as const, reason: null, rows };
  });

const SupplierInput = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(1).max(160),
  contact_person: z.string().trim().max(120).optional().or(z.literal("")),
  phone: z.string().trim().max(40).optional().or(z.literal("")),
  email: z.string().trim().email().max(200).optional().or(z.literal("")),
  location: z.string().trim().max(200).optional().or(z.literal("")),
  products_services: z.string().trim().max(1000).optional().or(z.literal("")),
  payment_terms: z.string().trim().max(300).optional().or(z.literal("")),
  status: z.enum(["active", "inactive"]),
  rating: z.number().int().min(1).max(5).nullable(),
  notes: z.string().trim().max(2000).optional().or(z.literal("")),
});

export const upsertSupplier = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .inputValidator((d) => SupplierInput.parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const body = {
      name: data.name,
      contact_person: data.contact_person || null,
      phone: data.phone || null,
      email: data.email || null,
      location: data.location || null,
      products_services: data.products_services || null,
      payment_terms: data.payment_terms || null,
      status: data.status,
      rating: data.rating,
      notes: data.notes || null,
      updated_at: new Date().toISOString(),
    };
    const result = data.id
      ? await supabaseAdmin.from("suppliers").update(body).eq("id", data.id).select("id").single()
      : await supabaseAdmin.from("suppliers").insert(body).select("id").single();
    if (result.error) {
      if (isMissingSchema(result.error)) throw new Error(migrationNeeded(MIGRATION_0008));
      throw new Error(result.error.message);
    }
    return { id: result.data.id };
  });

export const setSupplierStatus = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .inputValidator((d) => z.object({ id: z.string().uuid(), status: z.enum(["active", "inactive"]) }).parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("suppliers")
      .update({ status: data.status, updated_at: new Date().toISOString() })
      .eq("id", data.id);
    if (error) {
      if (isMissingSchema(error)) throw new Error(migrationNeeded(MIGRATION_0008));
      throw new Error(error.message);
    }
    return { ok: true };
  });

/** Delete a supplier that was never used. Suppliers with POs or payments must be deactivated instead. */
export const deleteSupplier = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [pos, payments] = await Promise.all([
      supabaseAdmin.from("purchase_orders").select("id", { count: "exact", head: true }).eq("supplier_id", data.id),
      supabaseAdmin.from("supplier_payments").select("id", { count: "exact", head: true }).eq("supplier_id", data.id),
    ]);
    if (pos.error && isMissingSchema(pos.error)) throw new Error(migrationNeeded(MIGRATION_0008));
    if ((pos.count ?? 0) > 0 || (payments.count ?? 0) > 0) {
      throw new Error("This supplier has purchase orders or payments. Mark it inactive instead of deleting it.");
    }
    const { data: before, error } = await supabaseAdmin.from("suppliers").delete().eq("id", data.id).select("*").maybeSingle();
    if (error) throw new Error(error.message);
    await writeAudit(supabaseAdmin, { actor: context.userId, action: "supplier.delete", entity: "supplier", entityId: data.id, before });
    return { ok: true };
  });
