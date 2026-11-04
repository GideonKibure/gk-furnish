import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { AlertTriangle, Archive, ArchiveRestore, Boxes, Download, History, Pencil, Plus, Wallet } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  AdminEmpty,
  AdminLoading,
  AdminPageHeader,
  DataTable,
  Field,
  KpiCard,
  MigrationNeeded,
  SearchInput,
  StatusPill,
  StatusTabs,
  btn,
  tzs,
  type Column,
} from "@/components/admin/admin-ui";
import {
  AdjustStockPanel,
  ItemForm,
  MovementsLoader,
  ProductCostsPanel,
  qty,
  type InventoryItem,
} from "@/components/admin/inventory/InventoryParts";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { INVENTORY_KINDS, INVENTORY_KIND_LABELS } from "@/lib/ops/business";
import { csvDate, downloadCsv } from "@/lib/ops/csv";
import { listInventory, setInventoryItemArchived } from "@/lib/ops/inventory.functions";

export const Route = createFileRoute("/admin/inventory")({
  head: () => ({ meta: [{ title: "Inventory — Admin" }, { name: "robots", content: "noindex" }] }),
  component: AdminInventoryPage,
});

type Section = "stock" | "movements" | "costs";
type KindTab = "all" | "low" | (typeof INVENTORY_KINDS)[number];
type Data = Awaited<ReturnType<typeof listInventory>>;

function AdminInventoryPage() {
  const load = useServerFn(listInventory);
  const archive = useServerFn(setInventoryItemArchived);
  const [section, setSection] = useState<Section>("stock");
  const [data, setData] = useState<Data | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const [tab, setTab] = useState<KindTab>("all");
  const [q, setQ] = useState("");
  const [editing, setEditing] = useState<InventoryItem | "new" | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  async function refresh() {
    setData(await load({ data: { includeArchived: showArchived } }));
    setRefreshKey((k) => k + 1);
  }

  useEffect(() => {
    refresh().catch((e) => toast.error(e instanceof Error ? e.message : "Load failed"));
  }, [showArchived]);

  const items = data?.available ? data.items : [];
  const searched = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return items;
    return items.filter((i) => [i.name, i.sku, i.location, i.product_name].some((v) => v?.toLowerCase().includes(term)));
  }, [items, q]);
  const tabs: { id: KindTab; label: string; count: number }[] = [
    { id: "all", label: "All", count: searched.length },
    { id: "low", label: "Low stock", count: searched.filter((i) => i.low).length },
    ...INVENTORY_KINDS.map((k) => ({ id: k, label: INVENTORY_KIND_LABELS[k], count: searched.filter((i) => i.kind === k).length })),
  ];
  const shown = tab === "all" ? searched : tab === "low" ? searched.filter((i) => i.low) : searched.filter((i) => i.kind === tab);
  const active = items.filter((i) => !i.archived_at);
  const valuation = active.reduce((s, i) => s + i.value, 0);
  const lowCount = active.filter((i) => i.low).length;
  const open = items.find((i) => i.id === openId) ?? null;

  async function onArchive(item: InventoryItem) {
    const archiving = !item.archived_at;
    if (archiving && !confirm(`Archive ${item.name}? It stays in the history but disappears from the stock list.`)) return;
    try {
      await archive({ data: { id: item.id, archived: archiving } });
      toast.success(archiving ? "Item archived" : "Item restored");
      if (archiving) setOpenId(null);
      await refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "That did not work");
    }
  }

  function exportCsv() {
    downloadCsv(
      `gk-inventory-${new Date().toISOString().slice(0, 10)}`,
      ["SKU", "Name", "Kind", "Unit", "Quantity", "Reorder level", "Unit cost (TSh)", "Value (TSh)", "Location", "Linked product", "Low stock", "Updated"],
      shown.map((i) => [
        i.sku,
        i.name,
        INVENTORY_KIND_LABELS[i.kind as keyof typeof INVENTORY_KIND_LABELS] ?? i.kind,
        i.unit,
        i.quantity,
        i.reorder_level,
        i.unit_cost,
        Math.round(i.value),
        i.location,
        i.product_name,
        i.low ? "yes" : "",
        csvDate(i.updated_at),
      ]),
    );
  }

  const stockCell = (i: InventoryItem) => (
    <span className="inline-flex items-center gap-2">
      <span className={i.quantity < 0 ? "font-semibold text-[#DC2626]" : "font-semibold text-navy"}>{qty(i.quantity, i.unit)}</span>
      {i.low && <StatusPill tone="pending">Low</StatusPill>}
    </span>
  );

  const columns: Column<InventoryItem>[] = [
    {
      key: "item",
      header: "Item",
      cell: (i) => (
        <div className="min-w-0">
          <p className="truncate font-semibold text-navy">
            {i.name}
            {i.archived_at && <span className="ml-2 text-xs font-normal text-[#9CA3AF]">archived</span>}
          </p>
          <p className="truncate text-xs text-[#6B7280]">
            {[i.sku, i.product_name ? `Shop: ${i.product_name}` : null, i.location].filter(Boolean).join(" · ") || "—"}
          </p>
        </div>
      ),
    },
    {
      key: "kind",
      header: "Kind",
      className: "hidden lg:table-cell",
      cell: (i) => <StatusPill tone={i.kind === "damaged" ? "danger" : i.kind === "finished" ? "success" : "neutral"}>{INVENTORY_KIND_LABELS[i.kind as keyof typeof INVENTORY_KIND_LABELS] ?? i.kind}</StatusPill>,
    },
    { key: "stock", header: "In stock", cell: stockCell },
    { key: "reorder", header: "Reorder at", align: "right", className: "hidden xl:table-cell", cell: (i) => (i.reorder_level ? qty(i.reorder_level) : "—") },
    { key: "cost", header: "Unit cost", align: "right", className: "hidden lg:table-cell", cell: (i) => tzs(i.unit_cost) },
    { key: "value", header: "Value", align: "right", cell: (i) => <span className="font-medium text-navy">{tzs(i.value)}</span> },
  ];

  if (data && !data.available) {
    return (
      <div>
        <AdminPageHeader title="Inventory" description="Raw materials, work in progress and finished goods." />
        <MigrationNeeded reason={data.reason} />
      </div>
    );
  }

  return (
    <div>
      <AdminPageHeader
        title="Inventory"
        description="Raw materials, work in progress and finished goods. Every change is a recorded movement."
        action={
          section === "stock" && (
            <>
              <button type="button" className={btn("outline")} onClick={exportCsv} disabled={!shown.length}>
                <Download className="h-4 w-4" /> Export CSV
              </button>
              <button type="button" className={btn("gold")} onClick={() => setEditing("new")}>
                <Plus className="h-4 w-4" /> Add item
              </button>
            </>
          )
        }
      />

      <StatusTabs
        className="mb-4"
        tabs={[
          { id: "stock", label: "Stock" },
          { id: "movements", label: "Movements" },
          { id: "costs", label: "Product costs" },
        ]}
        value={section}
        onChange={setSection}
      />

      {section === "movements" && <MovementsLoader refreshKey={refreshKey} />}
      {section === "costs" && <ProductCostsPanel />}

      {section === "stock" && (
        <>
          {data?.available && (
            <div className="mb-4 grid gap-3 sm:grid-cols-3">
              <KpiCard label="Stock value" value={tzs(valuation)} icon={<Wallet className="h-5 w-5" />} tone="gold" hint="Quantity × unit cost" />
              <KpiCard label="Items" value={active.length} icon={<Boxes className="h-5 w-5" />} tone="navy" />
              <KpiCard
                label="Low stock"
                value={lowCount}
                icon={<AlertTriangle className="h-5 w-5" />}
                tone={lowCount ? "pending" : "success"}
                hint={lowCount ? "At or below the reorder level" : "All above reorder level"}
              />
            </div>
          )}

          {editing && data?.available && (
            <ItemForm
              key={editing === "new" ? "new" : editing.id}
              item={editing === "new" ? null : editing}
              products={data.products}
              onClose={() => setEditing(null)}
              onSaved={refresh}
            />
          )}

          <div className="mb-4 space-y-3">
            <StatusTabs tabs={tabs} value={tab} onChange={setTab} />
            <div className="flex flex-wrap gap-2">
              <SearchInput value={q} onChange={setQ} placeholder="Search name, SKU, location or product" className="min-w-0 flex-1 sm:max-w-md" />
              <label className="flex h-10 items-center gap-2 rounded-lg border border-[#E5E5E5] bg-white px-3 text-sm text-[#374151]">
                <input type="checkbox" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} className="accent-[#14213D]" />
                Show archived
              </label>
            </div>
          </div>

          {!data ? (
            <AdminLoading label="Loading stock…" />
          ) : (
            <DataTable
              rows={shown}
              columns={columns}
              rowKey={(i) => i.id}
              onRowClick={(i) => setOpenId(i.id)}
              empty={
                <AdminEmpty
                  title={items.length ? "No items match" : "No stock items yet"}
                  action={
                    !items.length && (
                      <button type="button" className={btn("gold")} onClick={() => setEditing("new")}>
                        <Plus className="h-4 w-4" /> Add item
                      </button>
                    )
                  }
                >
                  {items.length ? "Try another tab or search." : "Add timber, hardware, fabric and finished pieces to track them."}
                </AdminEmpty>
              }
              mobileCard={(i) => (
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <p className="truncate font-semibold text-navy">{i.name}</p>
                    {stockCell(i)}
                  </div>
                  <p className="truncate text-xs text-[#6B7280]">
                    {INVENTORY_KIND_LABELS[i.kind as keyof typeof INVENTORY_KIND_LABELS] ?? i.kind}
                    {i.sku ? ` · ${i.sku}` : ""}
                  </p>
                  <p className="mt-1 text-sm font-medium text-navy">{tzs(i.value)}</p>
                </div>
              )}
            />
          )}
        </>
      )}

      <Sheet open={Boolean(open)} onOpenChange={(v) => !v && setOpenId(null)}>
        <SheetContent side="right" className="w-full overflow-y-auto bg-[#F5F6F8] p-0 sm:max-w-2xl">
          {open && (
            <div>
              <div className="sticky top-0 z-10 border-b border-[#E5E5E5] bg-white px-5 py-4 pr-12">
                <SheetTitle className="text-lg font-bold text-navy">{open.name}</SheetTitle>
                <SheetDescription className="text-xs text-[#6B7280]">
                  {INVENTORY_KIND_LABELS[open.kind as keyof typeof INVENTORY_KIND_LABELS] ?? open.kind}
                  {open.sku ? ` · ${open.sku}` : ""}
                </SheetDescription>
              </div>
              <div className="space-y-4 p-4 md:p-5">
                <div className="grid grid-cols-2 gap-3 rounded-xl border border-[#E5E5E5] bg-white p-4 sm:grid-cols-4">
                  <Field label="In stock">{stockCell(open)}</Field>
                  <Field label="Unit cost">{tzs(open.unit_cost)}</Field>
                  <Field label="Value">{tzs(open.value)}</Field>
                  <Field label="Reorder at">{open.reorder_level ? qty(open.reorder_level, open.unit) : "Off"}</Field>
                  {open.product_name && <Field label="Shop product" className="col-span-2">{open.product_name}</Field>}
                  {open.location && <Field label="Location" className="col-span-2">{open.location}</Field>}
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    className={btn("outline", "sm")}
                    onClick={() => {
                      setEditing(open);
                      setOpenId(null);
                      setSection("stock");
                      window.scrollTo({ top: 0, behavior: "smooth" });
                    }}
                  >
                    <Pencil className="h-3.5 w-3.5" /> Edit item
                  </button>
                  <button type="button" className={btn("outline", "sm")} onClick={() => void onArchive(open)}>
                    {open.archived_at ? <ArchiveRestore className="h-3.5 w-3.5" /> : <Archive className="h-3.5 w-3.5" />}
                    {open.archived_at ? "Restore" : "Archive"}
                  </button>
                </div>
                {!open.archived_at && <AdjustStockPanel item={open} onDone={refresh} />}
                <div>
                  <p className="mb-2 flex items-center gap-2 text-sm font-semibold text-navy">
                    <History className="h-4 w-4 text-[#6B7280]" /> Movement history
                  </p>
                  <MovementsLoader itemId={open.id} refreshKey={refreshKey} />
                </div>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
