import { useServerFn } from "@tanstack/react-start";
import { AlertTriangle, Save, X } from "lucide-react";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { toast } from "sonner";
import {
  AdminCard,
  AdminEmpty,
  AdminLoading,
  AdminNotice,
  DataTable,
  MigrationNeeded,
  SearchInput,
  StatusPill,
  adminInput,
  btn,
  formatDate,
  tzs,
  type Column,
} from "@/components/admin/admin-ui";
import { INVENTORY_KINDS, INVENTORY_KIND_LABELS, MOVEMENT_LABELS, type InventoryKind } from "@/lib/ops/business";
import {
  adjustStock,
  listInventory,
  listMovements,
  listProductCosts,
  upsertInventoryItem,
  upsertProductCost,
} from "@/lib/ops/inventory.functions";
import { cn } from "@/lib/utils";

type InventoryData = Awaited<ReturnType<typeof listInventory>>;
export type InventoryItem = Extract<InventoryData, { available: true }>["items"][number];
export type ProductOption = Extract<InventoryData, { available: true }>["products"][number];
type MovementData = Awaited<ReturnType<typeof listMovements>>;
export type Movement = Extract<MovementData, { available: true }>["rows"][number];

export function qty(value: number, unit?: string) {
  const text = new Intl.NumberFormat("en-US", { maximumFractionDigits: 3 }).format(value);
  return unit ? `${text} ${unit}` : text;
}

/** Create or edit a stock item. Opening stock is only asked for on create. */
export function ItemForm({
  item,
  products,
  onClose,
  onSaved,
}: {
  item: InventoryItem | null;
  products: ProductOption[];
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const save = useServerFn(upsertInventoryItem);
  const [kind, setKind] = useState<InventoryKind>((item?.kind as InventoryKind | undefined) ?? "raw");
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const num = (k: string) => Math.max(0, Number(fd.get(k) || 0));
    setBusy(true);
    try {
      await save({
        data: {
          ...(item ? { id: item.id } : {}),
          sku: String(fd.get("sku") ?? ""),
          name: String(fd.get("name") ?? ""),
          kind,
          unit: String(fd.get("unit") ?? "pcs").trim() || "pcs",
          product_id: kind === "finished" ? String(fd.get("product_id") ?? "") || null : null,
          reorder_level: num("reorder_level"),
          unit_cost: num("unit_cost"),
          location: String(fd.get("location") ?? ""),
          ...(item ? {} : { opening_quantity: num("opening_quantity") }),
        },
      });
      toast.success(item ? "Item updated" : "Item added");
      onClose();
      await onSaved();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Save failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AdminCard className="mb-5">
      <form onSubmit={onSubmit} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <div className="flex items-center justify-between sm:col-span-2 lg:col-span-3">
          <h2 className="text-base font-semibold text-navy">{item ? `Edit ${item.name}` : "New stock item"}</h2>
          <button type="button" className={btn("ghost", "sm")} onClick={onClose} aria-label="Close form">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="sm:col-span-2">
          <label className="field-label">Name *</label>
          <input name="name" required className="field-input" defaultValue={item?.name ?? ""} placeholder="e.g. Mninga plank 2x6" />
        </div>
        <div>
          <label className="field-label">SKU</label>
          <input name="sku" className="field-input font-mono" defaultValue={item?.sku ?? ""} placeholder="Optional, unique" />
        </div>
        <div>
          <label className="field-label">Kind</label>
          <select className="field-input" value={kind} onChange={(e) => setKind(e.target.value as InventoryKind)}>
            {INVENTORY_KINDS.map((k) => (
              <option key={k} value={k}>
                {INVENTORY_KIND_LABELS[k]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="field-label">Unit</label>
          <input name="unit" className="field-input" defaultValue={item?.unit ?? "pcs"} placeholder="pcs, m, kg, sheet…" />
        </div>
        <div>
          <label className="field-label">Location</label>
          <input name="location" className="field-input" defaultValue={item?.location ?? ""} placeholder="Workshop, store…" />
        </div>
        {kind === "finished" && (
          <div className="sm:col-span-2 lg:col-span-3">
            <label className="field-label">Linked shop product</label>
            <select name="product_id" className="field-input" defaultValue={item?.product_id ?? ""}>
              <option value="">Not linked</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-[#6B7280]">
              When linked, every stock movement of this item updates the product&apos;s stock in the shop.
            </p>
          </div>
        )}
        <div>
          <label className="field-label">Unit cost (TSh)</label>
          <input name="unit_cost" type="number" min={0} step="any" className="field-input" defaultValue={item?.unit_cost ?? 0} />
        </div>
        <div>
          <label className="field-label">Reorder level</label>
          <input name="reorder_level" type="number" min={0} step="any" className="field-input" defaultValue={item?.reorder_level ?? 0} />
          <p className="mt-1 text-xs text-[#6B7280]">0 turns off the low-stock alert.</p>
        </div>
        {!item && (
          <div>
            <label className="field-label">Opening stock</label>
            <input name="opening_quantity" type="number" min={0} step="any" className="field-input" defaultValue={0} />
            <p className="mt-1 text-xs text-[#6B7280]">Recorded as an opening movement.</p>
          </div>
        )}
        <div className="flex gap-2 sm:col-span-2 lg:col-span-3">
          <button type="submit" className={btn("gold")} disabled={busy}>
            {busy ? "Saving…" : item ? "Save item" : "Add item"}
          </button>
          <button type="button" className={btn("outline")} onClick={onClose}>
            Cancel
          </button>
        </div>
      </form>
    </AdminCard>
  );
}

const ADJUST_TYPES = [
  { value: "adjustment", label: "Adjustment (count correction)" },
  { value: "damage", label: "Damaged / written off" },
  { value: "return_in", label: "Returned to stock" },
  { value: "transfer", label: "Transfer" },
] as const;

/** Signed stock change with a required reason. Negative stock needs an explicit override. */
export function AdjustStockPanel({ item, onDone }: { item: InventoryItem; onDone: () => Promise<void> }) {
  const adjust = useServerFn(adjustStock);
  const [type, setType] = useState<(typeof ADJUST_TYPES)[number]["value"]>("adjustment");
  const [change, setChange] = useState("");
  const [reason, setReason] = useState("");
  const [authorise, setAuthorise] = useState(false);
  const [busy, setBusy] = useState(false);
  const value = Number(change);
  const signed = type === "damage" ? -Math.abs(value) : value;
  const after = Number.isFinite(signed) ? item.quantity + signed : item.quantity;
  const goesNegative = after < 0;

  async function submit() {
    if (!change.trim() || !Number.isFinite(value) || value === 0) {
      toast.error("Enter the quantity to add (+) or remove (−)");
      return;
    }
    if (reason.trim().length < 3) {
      toast.error("Give a reason for the adjustment");
      return;
    }
    setBusy(true);
    try {
      const r = await adjust({ data: { itemId: item.id, quantityChange: value, type, reason, authoriseNegative: authorise } });
      toast.success(`Stock is now ${qty(r.quantity ?? after, item.unit)}`);
      setChange("");
      setReason("");
      setAuthorise(false);
      await onDone();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Adjustment failed", { duration: 8000 });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3 rounded-xl border border-[#E5E5E5] bg-white p-4">
      <p className="text-sm font-semibold text-navy">Adjust stock</p>
      <div className="grid gap-2 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1 block text-xs font-semibold text-[#374151]">Type</span>
          <select className={adminInput} value={type} onChange={(e) => setType(e.target.value as typeof type)}>
            {ADJUST_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-semibold text-[#374151]">
            Quantity ({type === "damage" ? "removed" : "+ adds, − removes"})
          </span>
          <input
            type="number"
            step="any"
            inputMode="decimal"
            className={adminInput}
            value={change}
            onChange={(e) => setChange(e.target.value)}
            placeholder={type === "damage" ? "e.g. 2" : "e.g. -3 or 5"}
          />
        </label>
      </div>
      <label className="block">
        <span className="mb-1 block text-xs font-semibold text-[#374151]">Reason *</span>
        <input className={adminInput} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Why the stock changed" />
      </label>
      <p className="text-xs text-[#6B7280]">
        Now {qty(item.quantity, item.unit)} → after {qty(after, item.unit)}
      </p>
      {goesNegative && (
        <div className="space-y-2">
          <AdminNotice tone="danger">
            <span className="flex items-start gap-2">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              This takes stock below zero. Only allow it if you are sure stock was received but not recorded yet; the
              reason and your name are kept in the audit log.
            </span>
          </AdminNotice>
          <label className="flex items-center gap-2 text-sm text-navy">
            <input type="checkbox" checked={authorise} onChange={(e) => setAuthorise(e.target.checked)} className="h-4 w-4 accent-[#DC2626]" />
            Authorise negative stock
          </label>
        </div>
      )}
      <button type="button" className={btn("navy")} disabled={busy || (goesNegative && !authorise)} onClick={() => void submit()}>
        {busy ? "Saving…" : "Save adjustment"}
      </button>
    </div>
  );
}

export function MovementList({ rows, showItem = true }: { rows: Movement[]; showItem?: boolean }) {
  const columns: Column<Movement>[] = [
    { key: "date", header: "Date", cell: (m) => <span className="whitespace-nowrap text-[#374151]">{formatDate(m.created_at, true)}</span> },
    ...(showItem ? [{ key: "item", header: "Item", cell: (m: Movement) => <span className="font-medium text-navy">{m.item_name}</span> }] : []),
    { key: "type", header: "Type", cell: (m) => <StatusPill tone={m.quantity_change > 0 ? "success" : "neutral"}>{MOVEMENT_LABELS[m.type] ?? m.type}</StatusPill> },
    {
      key: "qty",
      header: "Change",
      align: "right",
      cell: (m) => (
        <span className={cn("font-semibold", m.quantity_change > 0 ? "text-[#15803D]" : "text-[#DC2626]")}>
          {m.quantity_change > 0 ? "+" : ""}
          {qty(m.quantity_change, m.item_unit)}
        </span>
      ),
    },
    { key: "after", header: "After", align: "right", cell: (m) => (m.quantity_after == null ? "—" : qty(m.quantity_after)) },
    {
      key: "note",
      header: "Note",
      className: "hidden lg:table-cell",
      cell: (m) => (
        <span className="text-xs text-[#6B7280]">
          {m.note ?? "—"}
          {m.actor ? ` · ${m.actor}` : ""}
          {m.authorised_negative ? " · negative authorised" : ""}
        </span>
      ),
    },
  ];
  return (
    <DataTable
      rows={rows}
      columns={columns}
      rowKey={(m) => m.id}
      empty={<AdminEmpty title="No stock movements yet" />}
      mobileCard={(m) => (
        <div>
          <div className="flex items-start justify-between gap-2">
            <p className="font-medium text-navy">{showItem ? m.item_name : (MOVEMENT_LABELS[m.type] ?? m.type)}</p>
            <span className={cn("shrink-0 font-semibold", m.quantity_change > 0 ? "text-[#15803D]" : "text-[#DC2626]")}>
              {m.quantity_change > 0 ? "+" : ""}
              {qty(m.quantity_change, m.item_unit)}
            </span>
          </div>
          <p className="text-xs text-[#6B7280]">
            {showItem ? `${MOVEMENT_LABELS[m.type] ?? m.type} · ` : ""}
            {formatDate(m.created_at, true)}
          </p>
          {m.note && <p className="mt-1 text-xs text-[#374151]">{m.note}</p>}
        </div>
      )}
    />
  );
}

/** Movements for one item, or the latest across all items. */
export function MovementsLoader({ itemId, refreshKey }: { itemId?: string; refreshKey: number }) {
  const load = useServerFn(listMovements);
  const [data, setData] = useState<MovementData | null>(null);
  useEffect(() => {
    let alive = true;
    load({ data: itemId ? { itemId, limit: 200 } : { limit: 200 } })
      .then((d) => alive && setData(d))
      .catch((e) => toast.error(e instanceof Error ? e.message : "Could not load movements"));
    return () => {
      alive = false;
    };
  }, [load, itemId, refreshKey]);
  if (!data) return <AdminLoading label="Loading movements…" />;
  if (!data.available) return <MigrationNeeded reason={data.reason} />;
  return <MovementList rows={data.rows} showItem={!itemId} />;
}

type CostData = Awaited<ReturnType<typeof listProductCosts>>;
type CostRow = Extract<CostData, { available: true }>["rows"][number];
type CostDraft = Record<"material_cost" | "labour_cost" | "overhead_cost" | "partner_price" | "transport_cost", string>;

function draftOf(r: CostRow): CostDraft {
  return {
    material_cost: String(r.material_cost || ""),
    labour_cost: String(r.labour_cost || ""),
    overhead_cost: String(r.overhead_cost || ""),
    partner_price: r.partner_price == null ? "" : String(r.partner_price),
    transport_cost: String(r.transport_cost || ""),
  };
}

/** Unit cost: partner price + transport when bought in, else materials + labour + overhead + transport. */
export function unitCost(d: CostDraft) {
  const n = (v: string) => Math.max(0, Number(v) || 0);
  if (d.partner_price.trim()) return n(d.partner_price) + n(d.transport_cost);
  return n(d.material_cost) + n(d.labour_cost) + n(d.overhead_cost) + n(d.transport_cost);
}

/** Internal product costs with margin against the selling price. Never shown on the storefront. */
export function ProductCostsPanel() {
  const load = useServerFn(listProductCosts);
  const save = useServerFn(upsertProductCost);
  const [data, setData] = useState<CostData | null>(null);
  const [drafts, setDrafts] = useState<Record<string, CostDraft>>({});
  const [q, setQ] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  async function refresh() {
    const next = await load();
    setData(next);
    if (next.available) setDrafts(Object.fromEntries(next.rows.map((r) => [r.product_id, draftOf(r)])));
  }

  useEffect(() => {
    refresh().catch((e) => toast.error(e instanceof Error ? e.message : "Load failed"));
  }, []);

  const rows = useMemo(() => {
    if (!data?.available) return [];
    const term = q.trim().toLowerCase();
    return term ? data.rows.filter((r) => r.name.toLowerCase().includes(term)) : data.rows;
  }, [data, q]);

  if (!data) return <AdminLoading label="Loading product costs…" />;
  if (!data.available) return <MigrationNeeded reason={data.reason} />;

  async function onSave(r: CostRow) {
    const d = drafts[r.product_id] ?? draftOf(r);
    const n = (v: string) => Math.max(0, Number(v) || 0);
    setBusyId(r.product_id);
    try {
      await save({
        data: {
          product_id: r.product_id,
          material_cost: n(d.material_cost),
          labour_cost: n(d.labour_cost),
          overhead_cost: n(d.overhead_cost),
          partner_price: d.partner_price.trim() ? n(d.partner_price) : null,
          transport_cost: n(d.transport_cost),
        },
      });
      toast.success(`Costs saved for ${r.name}`);
      await refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Save failed");
    } finally {
      setBusyId(null);
    }
  }

  const field = (r: CostRow, key: keyof CostDraft, label: string) => (
    <input
      type="number"
      min={0}
      step="any"
      aria-label={`${label} for ${r.name}`}
      placeholder={key === "partner_price" ? "—" : "0"}
      className="h-9 w-24 rounded-lg border border-[#E5E5E5] bg-white px-2 text-right text-sm text-navy focus:border-gold focus:outline-none"
      value={drafts[r.product_id]?.[key] ?? ""}
      onChange={(e) =>
        setDrafts((all) => ({ ...all, [r.product_id]: { ...(all[r.product_id] ?? draftOf(r)), [key]: e.target.value } }))
      }
    />
  );

  const margin = (r: CostRow) => {
    const cost = unitCost(drafts[r.product_id] ?? draftOf(r));
    if (!r.price || !cost) return null;
    return Math.round(((r.price - cost) / r.price) * 1000) / 10;
  };

  const marginPill = (r: CostRow) => {
    const m = margin(r);
    if (m == null) return <span className="text-xs text-[#9CA3AF]">—</span>;
    return <StatusPill tone={m < 0 ? "danger" : m < 20 ? "pending" : "success"}>{m}%</StatusPill>;
  };

  const columns: Column<CostRow>[] = [
    {
      key: "product",
      header: "Product",
      cell: (r) => (
        <div className="min-w-[10rem]">
          <p className="font-semibold text-navy">{r.name}</p>
          <p className="text-xs text-[#6B7280]">Sells at {tzs(r.price)}</p>
        </div>
      ),
    },
    { key: "material", header: "Materials", align: "right", cell: (r) => field(r, "material_cost", "Materials") },
    { key: "labour", header: "Labour", align: "right", cell: (r) => field(r, "labour_cost", "Labour") },
    { key: "overhead", header: "Overhead", align: "right", cell: (r) => field(r, "overhead_cost", "Overhead") },
    { key: "partner", header: "Partner price", align: "right", cell: (r) => field(r, "partner_price", "Partner price") },
    { key: "transport", header: "Transport", align: "right", cell: (r) => field(r, "transport_cost", "Transport") },
    {
      key: "unit",
      header: "Unit cost",
      align: "right",
      cell: (r) => <span className="font-semibold text-navy">{tzs(unitCost(drafts[r.product_id] ?? draftOf(r)))}</span>,
    },
    { key: "margin", header: "Margin", align: "right", cell: (r) => marginPill(r) },
    {
      key: "save",
      header: <span className="sr-only">Save</span>,
      align: "right",
      cell: (r) => (
        <button type="button" className={btn("outline", "sm")} disabled={busyId === r.product_id} onClick={() => void onSave(r)}>
          <Save className="h-3.5 w-3.5" /> Save
        </button>
      ),
    },
  ];

  return (
    <div className="space-y-3">
      <AdminNotice>
        Internal costs per unit, used for production estimates and margins. Leave the partner price empty for items made in
        the workshop. These figures never appear in the shop.
      </AdminNotice>
      <SearchInput value={q} onChange={setQ} placeholder="Search products" className="max-w-md" />
      <DataTable
        rows={rows}
        columns={columns}
        rowKey={(r) => r.product_id}
        empty={<AdminEmpty title="No products match" />}
        mobileCard={(r) => (
          <div className="space-y-2">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-semibold text-navy">{r.name}</p>
                <p className="text-xs text-[#6B7280]">Sells at {tzs(r.price)}</p>
              </div>
              {marginPill(r)}
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs text-[#6B7280]">
              <label className="space-y-1">Materials{field(r, "material_cost", "Materials")}</label>
              <label className="space-y-1">Labour{field(r, "labour_cost", "Labour")}</label>
              <label className="space-y-1">Overhead{field(r, "overhead_cost", "Overhead")}</label>
              <label className="space-y-1">Partner price{field(r, "partner_price", "Partner price")}</label>
              <label className="space-y-1">Transport{field(r, "transport_cost", "Transport")}</label>
            </div>
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-navy">Unit cost {tzs(unitCost(drafts[r.product_id] ?? draftOf(r)))}</p>
              <button type="button" className={btn("outline", "sm")} disabled={busyId === r.product_id} onClick={() => void onSave(r)}>
                <Save className="h-3.5 w-3.5" /> Save
              </button>
            </div>
          </div>
        )}
      />
    </div>
  );
}
