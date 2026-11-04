import { useServerFn } from "@tanstack/react-start";
import { Plus, Trash2, X } from "lucide-react";
import { useMemo, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { AdminCard, AdminNotice, adminInput, btn, tzs } from "@/components/admin/admin-ui";
import { createPurchaseOrder, updatePurchaseOrder } from "@/lib/ops/purchases.functions";
import type { PoOptions, PoPrefill, PoRow } from "./types";

type Line = {
  key: string;
  description: string;
  inventory_item_id: string;
  order_item_id: string;
  quantity: string;
  unit_cost: string;
};

const newKey = () => Math.random().toString(36).slice(2);
const emptyLine = (): Line => ({ key: newKey(), description: "", inventory_item_id: "", order_item_id: "", quantity: "1", unit_cost: "" });

function initialLines(po: PoRow | null, options: PoOptions, prefill: PoPrefill | null): Line[] {
  if (po) {
    return po.purchase_items.map((i) => ({
      key: i.id,
      description: i.description,
      inventory_item_id: i.inventory_item_id ?? "",
      order_item_id: i.order_item_id ?? "",
      quantity: String(i.quantity),
      unit_cost: String(i.unit_cost),
    }));
  }
  const order = options.orders.find((o) => o.id === prefill?.orderId);
  const item = order?.order_items.find((i) => i.id === prefill?.orderItemId);
  if (item) {
    const details = [item.material, item.size, item.color].filter(Boolean).join(", ");
    return [
      {
        ...emptyLine(),
        description: details ? `${item.product_name} (${details})` : item.product_name,
        order_item_id: item.id,
        quantity: String(item.quantity),
      },
    ];
  }
  return [emptyLine()];
}

export function PoForm({
  po,
  options,
  prefill,
  onClose,
  onSaved,
}: {
  po: PoRow | null;
  options: PoOptions;
  prefill: PoPrefill | null;
  onClose: () => void;
  onSaved: (id: string) => Promise<void> | void;
}) {
  const create = useServerFn(createPurchaseOrder);
  const update = useServerFn(updatePurchaseOrder);
  const [busy, setBusy] = useState(false);
  const [supplierId, setSupplierId] = useState(po?.supplier_id ?? prefill?.supplierId ?? "");
  const [orderId, setOrderId] = useState(po?.order_id ?? prefill?.orderId ?? "");
  const [lines, setLines] = useState<Line[]>(() => initialLines(po, options, prefill));

  const nothingReceived = !po || po.purchase_items.every((i) => i.accepted_qty === 0 && i.rejected_qty === 0);
  const itemsEditable = !po || (["draft", "sent"].includes(po.status) && nothingReceived);
  const suppliers = options.suppliers.filter((s) => s.status === "active" || s.id === supplierId);
  const order = options.orders.find((o) => o.id === orderId);
  const orderLines = order?.order_items ?? [];
  const linesTotal = useMemo(
    () => lines.reduce((s, l) => s + (Number(l.quantity) || 0) * (Number(l.unit_cost) || 0), 0),
    [lines],
  );

  function patch(key: string, next: Partial<Line>) {
    setLines((rows) => rows.map((r) => (r.key === key ? { ...r, ...next } : r)));
  }

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!supplierId) {
      toast.error("Choose a supplier — every purchase order needs one");
      return;
    }
    const fd = new FormData(e.currentTarget);
    const items = lines.map((l) => ({
      description: l.description.trim(),
      inventory_item_id: l.inventory_item_id || null,
      order_item_id: l.order_item_id || null,
      quantity: Number(l.quantity),
      unit_cost: Number(l.unit_cost || 0),
    }));
    if (itemsEditable && items.some((i) => !i.description || !(i.quantity > 0) || !(i.unit_cost >= 0))) {
      toast.error("Each line needs a description, a quantity above 0 and a unit cost");
      return;
    }
    const header = {
      supplier_id: supplierId,
      order_id: orderId || null,
      order_date: String(fd.get("order_date") ?? ""),
      expected_date: String(fd.get("expected_date") ?? ""),
      transport_cost: Math.max(0, Number(fd.get("transport_cost") || 0)),
      inspection_cost: Math.max(0, Number(fd.get("inspection_cost") || 0)),
      notes: String(fd.get("notes") ?? ""),
    };
    setBusy(true);
    try {
      if (po) {
        await update({ data: { ...header, id: po.id, ...(itemsEditable ? { items } : {}) } });
        toast.success(`${po.po_number} updated`);
        await onSaved(po.id);
      } else {
        const r = await create({ data: { ...header, items } });
        toast.success(`${r.po_number} created`);
        await onSaved(r.id);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save the purchase order", { duration: 8000 });
    } finally {
      setBusy(false);
    }
  }

  return (
    <AdminCard className="mb-5">
      <form onSubmit={onSubmit} className="space-y-4">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-base font-semibold text-navy">{po ? `Edit ${po.po_number}` : "New purchase order"}</h2>
          <button type="button" className={btn("ghost", "sm")} onClick={onClose} aria-label="Close form">
            <X className="h-4 w-4" />
          </button>
        </div>

        {!options.suppliers.length && (
          <AdminNotice tone="pending">Add a supplier first (Operations → Suppliers). Every purchase order needs one.</AdminNotice>
        )}

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <label className="block">
            <span className="field-label">Supplier *</span>
            <select className={adminInput} value={supplierId} onChange={(e) => setSupplierId(e.target.value)} required>
              <option value="">Choose supplier…</option>
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                  {s.status !== "active" ? " (inactive)" : ""}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="field-label">For customer order</span>
            <select
              className={adminInput}
              value={orderId}
              onChange={(e) => {
                setOrderId(e.target.value);
                setLines((rows) => rows.map((r) => ({ ...r, order_item_id: "" })));
              }}
            >
              <option value="">Stock / not for one order</option>
              {options.orders.map((o) => (
                <option key={o.id} value={o.id}>
                  #{o.order_number} · {o.customer_name}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="field-label">Order date</span>
            <input name="order_date" type="date" className={adminInput} defaultValue={po?.order_date ?? ""} />
          </label>
          <label className="block">
            <span className="field-label">Expected delivery</span>
            <input name="expected_date" type="date" className={adminInput} defaultValue={po?.expected_date ?? ""} />
          </label>
          <label className="block">
            <span className="field-label">Transport cost (TSh)</span>
            <input name="transport_cost" type="number" min={0} step={100} className={adminInput} defaultValue={po?.transport_cost ?? 0} />
          </label>
          <label className="block">
            <span className="field-label">Inspection cost (TSh)</span>
            <input name="inspection_cost" type="number" min={0} step={100} className={adminInput} defaultValue={po?.inspection_cost ?? 0} />
          </label>
        </div>

        <div>
          <p className="field-label">Items</p>
          {!itemsEditable && (
            <AdminNotice>Goods have been received on this PO, so its item lines are locked. You can still edit the costs, dates and notes.</AdminNotice>
          )}
          <div className="mt-2 space-y-2">
            {lines.map((l, index) => (
              <div key={l.key} className="grid gap-2 rounded-lg border border-[#E5E5E5] bg-[#F9FAFB] p-3 lg:grid-cols-[minmax(0,2fr)_minmax(0,1.3fr)_minmax(0,1.3fr)_6rem_8rem_auto]">
                <input
                  className={adminInput}
                  placeholder="Description *"
                  aria-label={`Line ${index + 1} description`}
                  value={l.description}
                  disabled={!itemsEditable}
                  onChange={(e) => patch(l.key, { description: e.target.value })}
                />
                <select
                  className={adminInput}
                  aria-label={`Line ${index + 1} stock item`}
                  value={l.inventory_item_id}
                  disabled={!itemsEditable}
                  onChange={(e) => {
                    const item = options.items.find((i) => i.id === e.target.value);
                    patch(l.key, {
                      inventory_item_id: e.target.value,
                      ...(item && !l.description ? { description: item.name } : {}),
                      ...(item && !l.unit_cost && item.unit_cost ? { unit_cost: String(item.unit_cost) } : {}),
                    });
                  }}
                >
                  <option value="">No stock item</option>
                  {options.items.map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.name} ({i.unit})
                    </option>
                  ))}
                </select>
                <select
                  className={adminInput}
                  aria-label={`Line ${index + 1} customer order line`}
                  value={l.order_item_id}
                  disabled={!itemsEditable || !orderLines.length}
                  onChange={(e) => {
                    const item = orderLines.find((i) => i.id === e.target.value);
                    patch(l.key, {
                      order_item_id: e.target.value,
                      ...(item && !l.description ? { description: item.product_name, quantity: String(item.quantity) } : {}),
                    });
                  }}
                >
                  <option value="">{order ? "No order line" : "Pick an order first"}</option>
                  {orderLines.map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.quantity}× {i.product_name}
                    </option>
                  ))}
                </select>
                <input
                  className={adminInput}
                  type="number"
                  min={0}
                  step="any"
                  aria-label={`Line ${index + 1} quantity`}
                  value={l.quantity}
                  disabled={!itemsEditable}
                  onChange={(e) => patch(l.key, { quantity: e.target.value })}
                />
                <input
                  className={adminInput}
                  type="number"
                  min={0}
                  step={100}
                  placeholder="Unit cost"
                  aria-label={`Line ${index + 1} unit cost`}
                  value={l.unit_cost}
                  disabled={!itemsEditable}
                  onChange={(e) => patch(l.key, { unit_cost: e.target.value })}
                />
                <button
                  type="button"
                  className={btn("ghost", "sm", "h-10 text-[#DC2626]")}
                  disabled={!itemsEditable || lines.length === 1}
                  onClick={() => setLines((rows) => rows.filter((r) => r.key !== l.key))}
                  aria-label={`Remove line ${index + 1}`}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
          <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
            <button
              type="button"
              className={btn("outline", "sm")}
              disabled={!itemsEditable}
              onClick={() => setLines((rows) => [...rows, emptyLine()])}
            >
              <Plus className="h-3.5 w-3.5" /> Add line
            </button>
            <p className="text-sm text-[#374151]">
              Items total <span className="font-semibold text-navy">{tzs(itemsEditable ? linesTotal : (po?.total ?? 0))}</span>
            </p>
          </div>
        </div>

        <label className="block">
          <span className="field-label">Notes</span>
          <textarea name="notes" rows={2} className="field-input" defaultValue={po?.notes ?? ""} />
        </label>

        <div className="flex gap-2">
          <button type="submit" className={btn("gold")} disabled={busy}>
            {busy ? "Saving…" : po ? "Save changes" : "Create purchase order"}
          </button>
          <button type="button" className={btn("outline")} onClick={onClose}>
            Cancel
          </button>
        </div>
      </form>
    </AdminCard>
  );
}
