import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { AlarmClock, Download, Plus, ShoppingCart, Wallet } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  AdminEmpty,
  AdminLoading,
  AdminPageHeader,
  DataTable,
  KpiCard,
  MigrationNeeded,
  SearchInput,
  StatusPill,
  StatusTabs,
  btn,
  formatDate,
  tzs,
  type Column,
} from "@/components/admin/admin-ui";
import { PoDetail } from "@/components/admin/purchasing/PoDetail";
import { PoForm } from "@/components/admin/purchasing/PoForm";
import type { PoOptions, PoPrefill, PoRow } from "@/components/admin/purchasing/types";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { PO_STATUS_LABELS, PO_STATUSES, poStatusTone, type PoStatus } from "@/lib/ops/business";
import { downloadCsv } from "@/lib/ops/csv";
import { listPurchaseFormOptions, listPurchaseOrders } from "@/lib/ops/purchases.functions";
import { humanize } from "@/lib/ops/status";

type Search = { new?: "1"; order?: string; item?: string; supplier?: string; po?: string; q?: string };

const uuid = /^[0-9a-f-]{36}$/i;

export const Route = createFileRoute("/admin/purchases")({
  validateSearch: (s: Record<string, unknown>): Search => {
    const out: Search = {};
    if (s["new"] === "1" || s["new"] === 1) out.new = "1";
    for (const key of ["order", "item", "supplier", "po"] as const) {
      const v = s[key];
      if (typeof v === "string" && uuid.test(v)) out[key] = v;
    }
    if (typeof s["q"] === "string" && s["q"].trim()) out.q = s["q"].trim().slice(0, 80);
    return out;
  },
  head: () => ({ meta: [{ title: "Purchases — Admin" }, { name: "robots", content: "noindex" }] }),
  component: AdminPurchasesPage,
});

type Tab = "all" | PoStatus | "overdue";

function AdminPurchasesPage() {
  const search = Route.useSearch();
  const navigate = useNavigate({ from: "/admin/purchases" });
  const list = useServerFn(listPurchaseOrders);
  const loadOptions = useServerFn(listPurchaseFormOptions);
  const [data, setData] = useState<Awaited<ReturnType<typeof listPurchaseOrders>> | null>(null);
  const [options, setOptions] = useState<PoOptions | null>(null);
  const [tab, setTab] = useState<Tab>("all");
  const [q, setQ] = useState(search.q ?? "");
  const [openId, setOpenId] = useState<string | null>(null);
  const [form, setForm] = useState<{ po: PoRow | null; prefill: PoPrefill | null } | null>(null);

  async function refresh() {
    setData(await list());
  }

  async function ensureOptions() {
    if (options) return options;
    const r = await loadOptions();
    if (!r.available) return null;
    setOptions(r);
    return r;
  }

  useEffect(() => {
    refresh().catch((e) => toast.error(e instanceof Error ? e.message : "Load failed"));
  }, []);

  useEffect(() => {
    if (search.q) setQ(search.q);
  }, [search.q]);

  // ?new=1&order=…&item=… (from an order line) or ?supplier=… opens the create form prefilled.
  useEffect(() => {
    if (search.new !== "1" && !search.supplier) return;
    const prefill: PoPrefill = { orderId: search.order, orderItemId: search.item, supplierId: search.supplier };
    ensureOptions()
      .then((opts) => {
        if (opts) setForm({ po: null, prefill });
      })
      .catch((e) => toast.error(e instanceof Error ? e.message : "Load failed"))
      .finally(() => void navigate({ search: {}, replace: true }));
  }, [search.new, search.order, search.item, search.supplier]);

  // ?po=… (from an order's linked purchase orders) opens that PO.
  useEffect(() => {
    if (!search.po || !data?.available) return;
    if (data.rows.some((po) => po.id === search.po)) {
      setTab("all");
      setOpenId(search.po);
    }
    void navigate({ search: {}, replace: true });
  }, [search.po, data]);

  const rows = data?.available ? data.rows : [];
  const searched = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return rows;
    return rows.filter((po) =>
      [po.po_number, po.suppliers?.name, po.orders?.order_number, po.orders?.customer_name, po.notes].some((v) =>
        v?.toLowerCase().includes(term.replace(/^#/, "")),
      ),
    );
  }, [rows, q]);

  const tabs: { id: Tab; label: string; count: number }[] = [
    { id: "all", label: "All", count: searched.length },
    { id: "overdue", label: "Overdue", count: searched.filter((po) => po.overdue).length },
    ...PO_STATUSES.map((s) => ({ id: s, label: PO_STATUS_LABELS[s], count: searched.filter((po) => po.status === s).length })),
  ];
  const shown = tab === "all" ? searched : tab === "overdue" ? searched.filter((po) => po.overdue) : searched.filter((po) => po.status === tab);
  const open = rows.find((po) => po.id === openId) ?? null;
  const payable = rows.filter((po) => po.status !== "draft").reduce((s, po) => s + po.balance, 0);

  async function openForm(po: PoRow | null) {
    try {
      const opts = await ensureOptions();
      if (!opts) return;
      setOpenId(null);
      setForm({ po, prefill: null });
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Load failed");
    }
  }

  function exportCsv() {
    downloadCsv(
      `gk-purchase-orders-${new Date().toISOString().slice(0, 10)}`,
      ["PO", "Order date", "Expected", "Supplier", "Customer order", "Status", "Items (TSh)", "Transport (TSh)", "Inspection (TSh)", "Landed (TSh)", "Paid (TSh)", "Balance (TSh)", "Overdue"],
      shown.map((po) => [
        po.po_number,
        po.order_date,
        po.expected_date,
        po.suppliers?.name,
        po.orders?.order_number,
        PO_STATUS_LABELS[po.status as PoStatus] ?? po.status,
        po.total,
        po.transport_cost,
        po.inspection_cost,
        po.landed,
        po.paid,
        po.balance,
        po.overdue ? "yes" : "",
      ]),
    );
  }

  const columns: Column<PoRow>[] = [
    {
      key: "po",
      header: "PO",
      cell: (po) => (
        <div>
          <p className="font-semibold text-navy">{po.po_number}</p>
          <p className="text-xs text-[#6B7280]">{formatDate(po.order_date)}</p>
        </div>
      ),
    },
    { key: "supplier", header: "Supplier", cell: (po) => <span className="font-medium text-navy">{po.suppliers?.name ?? "—"}</span> },
    {
      key: "order",
      header: "For order",
      className: "hidden xl:table-cell",
      cell: (po) => (po.orders ? <span className="text-[#374151]">#{po.orders.order_number}</span> : <span className="text-xs text-[#9CA3AF]">Stock</span>),
    },
    {
      key: "expected",
      header: "Expected",
      cell: (po) => (
        <span className={po.overdue ? "font-semibold text-[#DC2626]" : "text-[#374151]"}>
          {formatDate(po.expected_date)}
          {po.overdue && <span className="block text-xs font-normal">Overdue</span>}
        </span>
      ),
    },
    { key: "landed", header: "Landed", align: "right", cell: (po) => <span className="font-medium text-navy">{tzs(po.landed)}</span> },
    {
      key: "balance",
      header: "Balance",
      align: "right",
      cell: (po) => <span className={po.balance > 0 ? "font-semibold text-navy" : "text-[#9CA3AF]"}>{tzs(po.balance)}</span>,
    },
    {
      key: "status",
      header: "Status",
      cell: (po) => <StatusPill tone={poStatusTone(po.status)}>{PO_STATUS_LABELS[po.status as PoStatus] ?? humanize(po.status)}</StatusPill>,
    },
  ];

  return (
    <div>
      <AdminPageHeader
        title="Purchases"
        description="Purchase orders to suppliers: receive goods into stock, check quality and track what is still owed."
        action={
          data?.available ? (
            <>
              <button type="button" className={btn("outline")} onClick={exportCsv} disabled={!shown.length}>
                <Download className="h-4 w-4" /> Export CSV
              </button>
              <button type="button" className={btn("gold")} onClick={() => void openForm(null)}>
                <Plus className="h-4 w-4" /> New PO
              </button>
            </>
          ) : undefined
        }
      />

      {!data ? (
        <AdminLoading label="Loading purchase orders…" />
      ) : !data.available ? (
        <MigrationNeeded reason={data.reason} />
      ) : (
        <>
          <div className="mb-4 grid gap-3 sm:grid-cols-3">
            <KpiCard label="Owed to suppliers" value={tzs(payable)} icon={<Wallet className="h-5 w-5" />} tone="pending" hint="Sent and received POs, after payments" />
            <KpiCard
              label="Open purchase orders"
              value={rows.filter((po) => ["draft", "sent", "partially_received"].includes(po.status)).length}
              icon={<ShoppingCart className="h-5 w-5" />}
              tone="navy"
            />
            <KpiCard
              label="Overdue deliveries"
              value={rows.filter((po) => po.overdue).length}
              icon={<AlarmClock className="h-5 w-5" />}
              tone={rows.some((po) => po.overdue) ? "danger" : "success"}
            />
          </div>

          {form && options && (
            <PoForm
              key={form.po?.id ?? "new"}
              po={form.po}
              options={options}
              prefill={form.prefill}
              onClose={() => setForm(null)}
              onSaved={async (id) => {
                setForm(null);
                await refresh();
                setOpenId(id);
              }}
            />
          )}

          <div className="mb-4 space-y-3">
            <StatusTabs tabs={tabs} value={tab} onChange={setTab} />
            <SearchInput value={q} onChange={setQ} placeholder="Search PO number, supplier or order" className="max-w-md" />
          </div>

          <DataTable
            rows={shown}
            columns={columns}
            rowKey={(po) => po.id}
            onRowClick={(po) => setOpenId(po.id)}
            empty={
              <AdminEmpty
                title={rows.length ? "No purchase orders match" : "No purchase orders yet"}
                icon={<ShoppingCart className="h-5 w-5" />}
                action={
                  !rows.length && (
                    <button type="button" className={btn("gold")} onClick={() => void openForm(null)}>
                      <Plus className="h-4 w-4" /> New PO
                    </button>
                  )
                }
              >
                {rows.length ? "Try another tab or search." : "Create a PO when you buy materials or order from a partner maker."}
              </AdminEmpty>
            }
            mobileCard={(po) => (
              <div>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold text-navy">{po.po_number}</p>
                    <p className="truncate text-xs text-[#6B7280]">{po.suppliers?.name ?? "—"}</p>
                  </div>
                  <StatusPill tone={poStatusTone(po.status)}>{PO_STATUS_LABELS[po.status as PoStatus] ?? humanize(po.status)}</StatusPill>
                </div>
                <div className="mt-2 flex items-center justify-between gap-2">
                  <p className="font-semibold text-navy">{tzs(po.landed)}</p>
                  <p className={po.overdue ? "text-xs font-semibold text-[#DC2626]" : "text-xs text-[#6B7280]"}>
                    {po.overdue ? "Overdue · " : "Expected "}
                    {formatDate(po.expected_date)}
                  </p>
                </div>
                {po.balance > 0 && <p className="mt-1 text-xs text-[#C2410C]">{tzs(po.balance)} still to pay</p>}
              </div>
            )}
          />

          <Sheet open={Boolean(open)} onOpenChange={(v) => !v && setOpenId(null)}>
            <SheetContent side="right" className="w-full overflow-y-auto bg-[#F5F6F8] p-0 sm:max-w-2xl">
              {open && <PoDetail po={open} onChanged={refresh} onEdit={() => void openForm(open)} />}
            </SheetContent>
          </Sheet>
        </>
      )}
    </div>
  );
}