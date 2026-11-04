import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireAdmin } from "@/integrations/supabase/admin-auth";
import { actorLabel, writeAudit } from "@/lib/audit.server";
import { isMissingSchema, migrationNeeded } from "@/lib/db-compat";
import { EXPENSE_CATEGORIES } from "@/lib/ops/business";
import { MIGRATION_0008 } from "@/lib/ops/inventory.server";

type SupabaseAdmin = Awaited<
  typeof import("@/integrations/supabase/client.server")
>["supabaseAdmin"];

const RECEIPTS_BUCKET = "business-receipts";

const RECEIPT_TYPES = ["image/jpeg", "image/png", "image/webp", "application/pdf"] as const;
const RECEIPT_EXT: Record<(typeof RECEIPT_TYPES)[number], string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "application/pdf": "pdf",
};

const ReceiptUpload = z.object({
  name: z.string().max(200),
  type: z.enum(RECEIPT_TYPES),
  base64: z.string().min(1).max(7_000_000),
});

function fail(error: { code?: string | null; message?: string | null }): never {
  if (isMissingSchema(error)) throw new Error(migrationNeeded(MIGRATION_0008));
  throw new Error(error.message ?? "Database error");
}

async function uploadReceipt(supabaseAdmin: SupabaseAdmin, file: z.infer<typeof ReceiptUpload>) {
  const path = `expenses/${crypto.randomUUID()}.${RECEIPT_EXT[file.type]}`;
  const bytes = Uint8Array.from(atob(file.base64), (c) => c.charCodeAt(0));
  const { error } = await supabaseAdmin.storage
    .from(RECEIPTS_BUCKET)
    .upload(path, bytes, { contentType: file.type, upsert: false });
  if (error) throw new Error(`Receipt upload failed: ${error.message}`);
  return path;
}

async function removeReceipt(supabaseAdmin: SupabaseAdmin, path: string | null | undefined) {
  if (path) await supabaseAdmin.storage.from(RECEIPTS_BUCKET).remove([path]);
}

/** Expense register, newest first, with supplier and order references. */
export const listExpenses = createServerFn({ method: "GET" })
  .middleware([requireAdmin])
  .handler(async () => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("expenses")
      .select("*, suppliers(name), orders(order_number)")
      .order("expense_date", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(5000);
    if (error) {
      if (isMissingSchema(error))
        return { available: false as const, reason: migrationNeeded(MIGRATION_0008), rows: [] };
      throw new Error(error.message);
    }
    return {
      available: true as const,
      reason: null,
      rows: (data ?? []).map((e) => ({
        id: e.id,
        expense_date: e.expense_date,
        category: e.category,
        description: e.description,
        amount: Number(e.amount),
        payment_method: e.payment_method,
        supplier_id: e.supplier_id,
        supplier_name: (e.suppliers as { name: string } | null)?.name ?? null,
        order_id: e.order_id,
        order_number: (e.orders as { order_number: string } | null)?.order_number ?? null,
        has_receipt: Boolean(e.receipt_path),
        receipt_name: e.receipt_path ? (e.receipt_path.split("/").pop() ?? null) : null,
        archived: Boolean(e.archived_at),
        archived_at: e.archived_at,
        created_by: e.created_by,
        created_at: e.created_at,
      })),
    };
  });

/** Suppliers and recent orders for the expense form's link pickers. */
export const listExpenseFormOptions = createServerFn({ method: "GET" })
  .middleware([requireAdmin])
  .handler(async () => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [suppliers, orders] = await Promise.all([
      supabaseAdmin.from("suppliers").select("id,name,status").order("name"),
      supabaseAdmin
        .from("orders")
        .select("id,order_number,customer_name")
        .order("created_at", { ascending: false })
        .limit(200),
    ]);
    return {
      suppliers: suppliers.error
        ? []
        : (suppliers.data ?? []).map((s) => ({
            id: s.id,
            name: s.name,
            active: s.status === "active",
          })),
      orders: orders.data ?? [],
    };
  });

const ExpenseInput = z.object({
  id: z.string().uuid().optional(),
  expense_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  category: z.enum(EXPENSE_CATEGORIES),
  description: z.string().trim().min(2).max(500),
  amount: z.number().positive().max(1_000_000_000),
  payment_method: z.string().trim().max(60).optional().or(z.literal("")),
  supplier_id: z.string().uuid().optional().or(z.literal("")),
  order_id: z.string().uuid().optional().or(z.literal("")),
  receipt: ReceiptUpload.optional(),
  clear_receipt: z.boolean().optional(),
});

export const upsertExpense = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .inputValidator((d) => ExpenseInput.parse(d))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    let previous: {
      amount: number;
      category: string;
      description: string;
      receipt_path: string | null;
    } | null = null;
    if (data.id) {
      const { data: row, error } = await supabaseAdmin
        .from("expenses")
        .select("amount,category,description,receipt_path")
        .eq("id", data.id)
        .maybeSingle();
      if (error) fail(error);
      if (!row) throw new Error("Expense not found");
      previous = { ...row, amount: Number(row.amount) };
    }

    const newReceipt = data.receipt ? await uploadReceipt(supabaseAdmin, data.receipt) : null;
    const receiptPath =
      newReceipt ?? (data.clear_receipt ? null : (previous?.receipt_path ?? null));

    const body = {
      expense_date: data.expense_date,
      category: data.category,
      description: data.description,
      amount: data.amount,
      payment_method: data.payment_method || null,
      supplier_id: data.supplier_id || null,
      order_id: data.order_id || null,
      receipt_path: receiptPath,
      updated_at: new Date().toISOString(),
    };

    const result = data.id
      ? await supabaseAdmin.from("expenses").update(body).eq("id", data.id).select("id").single()
      : await supabaseAdmin
          .from("expenses")
          .insert({ ...body, created_by: await actorLabel(supabaseAdmin, context.userId) })
          .select("id")
          .single();
    if (result.error || !result.data) {
      await removeReceipt(supabaseAdmin, newReceipt);
      if (result.error) fail(result.error);
      throw new Error("Could not save the expense");
    }

    if (previous && previous.receipt_path && previous.receipt_path !== receiptPath) {
      await removeReceipt(supabaseAdmin, previous.receipt_path);
    }
    if (previous && (previous.amount !== data.amount || previous.category !== data.category)) {
      await writeAudit(supabaseAdmin, {
        actor: context.userId,
        action: "expense_change",
        entity: "expense",
        entityId: result.data.id,
        before: {
          amount: previous.amount,
          category: previous.category,
          description: previous.description,
        },
        after: { amount: data.amount, category: data.category, description: data.description },
      });
    }
    return { id: result.data.id };
  });

export const setExpenseArchived = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .inputValidator((d) => z.object({ id: z.string().uuid(), archived: z.boolean() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row, error } = await supabaseAdmin
      .from("expenses")
      .update({
        archived_at: data.archived ? new Date().toISOString() : null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", data.id)
      .select("id,expense_date,category,description,amount")
      .single();
    if (error) fail(error);
    await writeAudit(supabaseAdmin, {
      actor: context.userId,
      action: data.archived ? "expense_archive" : "expense_restore",
      entity: "expense",
      entityId: data.id,
      before: data.archived ? { ...row, amount: Number(row.amount) } : null,
      after: data.archived ? null : { ...row, amount: Number(row.amount) },
    });
    return { ok: true };
  });

/** Short-lived link to a private receipt. */
export const getExpenseReceiptUrl = createServerFn({ method: "GET" })
  .middleware([requireAdmin])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row, error } = await supabaseAdmin
      .from("expenses")
      .select("receipt_path")
      .eq("id", data.id)
      .maybeSingle();
    if (error) fail(error);
    if (!row?.receipt_path) throw new Error("This expense has no receipt");
    const { data: signed, error: signErr } = await supabaseAdmin.storage
      .from(RECEIPTS_BUCKET)
      .createSignedUrl(row.receipt_path, 10 * 60);
    if (signErr || !signed) throw new Error(signErr?.message ?? "Could not open the receipt");
    return { url: signed.signedUrl };
  });
