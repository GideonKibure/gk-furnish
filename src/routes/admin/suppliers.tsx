import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Download, Mail, Pencil, Phone, Plus, Trash2, Truck, Wallet, X } from "lucide-react";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { toast } from "sonner";
import {
  AdminCard,
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
  formatDate,
  tzs,
  type Column,
} from "@/components/admin/admin-ui";
import { StarInput, StarRating } from "@/components/admin/purchasing/StarRating";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { PO_STATUS_LABELS, poStatusTone, type PoStatus } from "@/lib/ops/business";
import { csvDate, downloadCsv } from "@/lib/ops/csv";
import { humanize } from "@/lib/ops/status";
import { deleteSupplier, listSuppliers, setSupplierStatus, upsertSupplier } from "@/lib/ops/suppliers.functions";

export const Route = createFileRoute("/admin/suppliers")({
  head: () => ({ meta: [{ title: "Suppliers — Admin" }, { name: "robots", content: "noindex" }] }),
  component: AdminSuppliersPage,
});

type Data = Awaited<ReturnType<typeof listSuppliers>>;
type Row = Extract<Data, { available: true }>["rows"][number];
type Tab = "all" | "active" | "inactive";

function AdminSuppliersPage() {
  const list = useServerFn(listSuppliers);
  const remove = useServerFn(deleteSupplier);
  const setStatus = useServerFn(setSupplierStatus);
  const [data, setData] = useState<Data | null>(null);
  const [tab, setTab] = useState<Tab>("active");
  const [q, setQ] = useState("");
  const [editing, setEditing] = useState<Row | "new" | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);

  async function refresh() {
    setData(await list());
  }

  useEffect(() => {
    refresh().catch((e) => toast.error(e instanceof Error ? e.message : "Load failed"));
  }, []);

  const rows = data?.available ? data.rows : [];
  const searched = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return rows;
    return rows.filter((s) =>
      [s.name, s.contact_person, s.phone, s.email, s.location, s.products_services].some((v) => v?.toLowerCase().includes(term)),
    );
  }, [rows, q]);
  const tabs: { id: Tab; label: string; count: number }[] = [
    { id: "active", label: "Active", count: searched.filter((s) => s.status === "active").length },
    { id: "inactive", label: "Inactive", count: searched.filter((s) => s.status === "inactive").length },
    { id: "all", label: "All", count: searched.length },
  ];
  const shown = tab === "all" ? searched : searched.filter((s) => s.status === tab);
  const open = rows.find((s) => s.id === openId) ?? null;

  async function onDelete(s: Row) {
    if (!confirm(`Delete ${s.name}? This only works for suppliers that were never used.`)) return;
    try {
      await remove({ data: { id: s.id } });
      toast.success("Supplier deleted");
      setOpenId(null);
      await refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Delete failed", { duration: 8000 });
    }
  }

  async function onToggle(s: Row) {
    const status = s.status === "active" ? "inactive" : "active";
    try {
      await setStatus({ data: { id: s.id, status } });
      toast.success(status === "active" ? `${s.name} is active again` : `${s.name} marked inactive`);
      await refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Update failed");
    }
  }

  function exportCsv() {
    downloadCsv(
      `gk-suppliers-${new Date().toISOString().slice(0, 10)}`,
      ["Name", "Contact", "Phone", "Email", "Location", "Supplies", "Payment terms", "Status", "Rating", "Open POs", "Total paid (TSh)", "Payable (TSh)", "Last order"],
      shown.map((s) => [
        s.name,
        s.contact_person,
        s.phone,
        s.email,
        s.location,
        s.products_services,
        s.payment_terms,
        s.status,
        s.rating,
        s.open_po_count,
        Math.round(s.total_paid),
        s.payable,
        csvDate(s.last_order_date),
      ]),
    );
  }

  const columns: Column<Row>[] = [
    {
      key: "name",
      header: "Supplier",
      cell: (s) => (
        <div className="min-w-0">
          <p className="truncate font-semibold text-navy">{s.name}</p>
          <p className="truncate text-xs text-[#6B7280]">{s.products_services || s.contact_person || "—"}</p>
        </div>
      ),
    },
    {
      key: "contact",
      header: "Contact",
      className: "hidden lg:table-cell",
      cell: (s) => (
        <div className="text-xs text-[#374151]">
          {s.contact_person && <p>{s.contact_person}</p>}
          {s.phone && <p className="text-[#6B7280]">{s.phone}</p>}
        </div>
      ),
    },
    { key: "rating", header: "Rating", cell: (s) => <StarRating value={s.rating} /> },
    { key: "open", header: "Open POs", align: "right", cell: (s) => s.open_po_count },
    {
      key: "payable",
      header: "Payable",
      align: "right",
      cell: (s) => <span className={s.payable > 0 ? "font-semibold text-navy" : "text-[#9CA3AF]"}>{tzs(s.payable)}</span>,
    },
    {
      key: "status",
      header: "Status",
      cell: (s) => <StatusPill tone={s.status === "active" ? "success" : "neutral"}>{humanize(s.status)}</StatusPill>,
    },
  ];

  return (
    <div>
      <AdminPageHeader
        title="Suppliers"
        description="Timber yards, hardware shops and partner makers you buy from, with what you still owe each one."
        action={
          data?.available ? (
            <>
              <button type="button" className={btn("outline")} onClick={exportCsv} disabled={!shown.length}>
                <Download className="h-4 w-4" /> Export CSV
              </button>
              <button type="button" className={btn("gold")} onClick={() => setEditing("new")}>
                <Plus className="h-4 w-4" /> Add supplier
              </button>
            </>
          ) : undefined
        }
      />

      {!data ? (
        <AdminLoading label="Loading suppliers…" />
      ) : !data.available ? (
        <MigrationNeeded reason={data.reason} />
      ) : (
        <>
          <div className="mb-4 grid gap-3 sm:grid-cols-3">
            <KpiCard
              label="Owed to suppliers"
              value={tzs(rows.reduce((s, r) => s + r.payable, 0))}
              icon={<Wallet className="h-5 w-5" />}
              tone="pending"
              hint="Sent and received POs, after payments"
            />
            <KpiCard label="Active suppliers" value={rows.filter((r) => r.status === "active").length} icon={<Truck className="h-5 w-5" />} tone="navy" />
            <KpiCard
              label="Paid to suppliers"
              value={tzs(rows.reduce((s, r) => s + r.total_paid, 0))}
              icon={<Wallet className="h-5 w-5" />}
              tone="success"
              hint="All time"
            />
          </div>

          {editing && (
            <SupplierForm
              key={editing === "new" ? "new" : editing.id}
              row={editing === "new" ? null : editing}
              onClose={() => setEditing(null)}
              onSaved={refresh}
            />
          )}

          <div className="mb-4 space-y-3">
            <StatusTabs tabs={tabs} value={tab} onChange={setTab} />
            <SearchInput value={q} onChange={setQ} placeholder="Search name, contact, phone or what they supply" className="max-w-md" />
          </div>

          <DataTable
            rows={shown}
            columns={columns}
            rowKey={(s) => s.id}
            onRowClick={(s) => setOpenId(s.id)}
            empty={
              <AdminEmpty title={rows.length ? "No suppliers match" : "No suppliers yet"} icon={<Truck className="h-5 w-5" />}>
                {rows.length ? "Try another tab or search." : "Add the businesses you buy materials or finished pieces from."}
              </AdminEmpty>
            }
            mobileCard={(s) => (
              <div>
                <div className="flex items-start justify-between gap-2">
                  <p className="truncate font-semibold text-navy">{s.name}</p>
                  <StatusPill tone={s.status === "active" ? "success" : "neutral"}>{humanize(s.status)}</StatusPill>
                </div>
                <p className="truncate text-xs text-[#6B7280]">{s.products_services || s.phone || "—"}</p>
                <div className="mt-2 flex items-center justify-between gap-2">
                  <StarRating value={s.rating} />
                  <p className={s.payable > 0 ? "text-sm font-semibold text-navy" : "text-sm text-[#9CA3AF]"}>{tzs(s.payable)} owed</p>
                </div>
              </div>
            )}
          />

          <Sheet open={Boolean(open)} onOpenChange={(v) => !v && setOpenId(null)}>
            <SheetContent side="right" className="w-full overflow-y-auto bg-[#F5F6F8] p-0 sm:max-w-xl">
              {open && (
                <SupplierDetail
                  supplier={open}
                  onEdit={() => {
                    setOpenId(null);
                    setEditing(open);
                    window.scrollTo({ top: 0, behavior: "smooth" });
                  }}
                  onToggle={() => void onToggle(open)}
                  onDelete={() => void onDelete(open)}
                />
              )}
            </SheetContent>
          </Sheet>
        </>
      )}
    </div>
  );
}

function SupplierDetail({ supplier: s, onEdit, onToggle, onDelete }: { supplier: Row; onEdit: () => void; onToggle: () => void; onDelete: () => void }) {
  const unused = !s.purchase_orders.length && !s.supplier_payments.length;
  return (
    <div>
      <div className="sticky top-0 z-10 border-b border-[#E5E5E5] bg-white px-5 py-4 pr-12">
        <SheetTitle className="text-lg font-bold text-navy">{s.name}</SheetTitle>
        <SheetDescription className="text-xs text-[#6B7280]">{s.products_services || "Supplier"}</SheetDescription>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <StatusPill tone={s.status === "active" ? "success" : "neutral"}>{humanize(s.status)}</StatusPill>
          <StarRating value={s.rating} />
        </div>
      </div>
      <div className="space-y-4 p-4 md:p-5">
        <div className="flex flex-wrap gap-2">
          <button type="button" className={btn("outline", "sm")} onClick={onEdit}>
            <Pencil className="h-3.5 w-3.5" /> Edit
          </button>
          {s.status === "active" && (
            <Link to="/admin/purchases" search={{ new: "1", supplier: s.id }} className={btn("gold", "sm")}>
              <Plus className="h-3.5 w-3.5" /> New PO
            </Link>
          )}
          <button type="button" className={btn("outline", "sm")} onClick={onToggle}>
            {s.status === "active" ? "Mark inactive" : "Mark active"}
          </button>
          {unused && (
            <button type="button" className={btn("danger", "sm")} onClick={onDelete}>
              <Trash2 className="h-3.5 w-3.5" /> Delete
            </button>
          )}
        </div>

        <div className="grid gap-3 rounded-xl border border-[#E5E5E5] bg-white p-4 sm:grid-cols-2">
          <Field label="Contact person">{s.contact_person || "—"}</Field>
          <Field label="Phone">
            {s.phone ? (
              <a href={`tel:${s.phone.replace(/[^\d+]/g, "")}`} className="inline-flex items-center gap-1.5 font-semibold text-[#B86A00] hover:underline">
                <Phone className="h-3.5 w-3.5" /> {s.phone}
              </a>
            ) : (
              "—"
            )}
          </Field>
          <Field label="Email">
            {s.email ? (
              <a href={`mailto:${s.email}`} className="inline-flex items-center gap-1.5 font-semibold text-[#B86A00] hover:underline">
                <Mail className="h-3.5 w-3.5" /> {s.email}
              </a>
            ) : (
              "—"
            )}
          </Field>
          <Field label="Location">{s.location || "—"}</Field>
          <Field label="Payment terms">{s.payment_terms || "—"}</Field>
          <Field label="Owed now">
            <span className="font-semibold">{tzs(s.payable)}</span>
          </Field>
          {s.notes && (
            <Field label="Notes" className="sm:col-span-2">
              <span className="whitespace-pre-line">{s.notes}</span>
            </Field>
          )}
        </div>

        <div className="rounded-xl border border-[#E5E5E5] bg-white">
          <p className="border-b border-[#F0F0F0] px-4 py-3 text-sm font-semibold text-navy">Purchase orders</p>
          {s.purchase_orders.length ? (
            <ul className="divide-y divide-[#F0F0F0]">
              {s.purchase_orders.map((po) => (
                <li key={po.id}>
                  <Link
                    to="/admin/purchases"
                    search={{ q: po.po_number }}
                    className="flex items-center justify-between gap-3 px-4 py-2.5 hover:bg-[#F9FAFB]"
                  >
                    <span className="min-w-0">
                      <span className="block text-sm font-semibold text-navy">{po.po_number}</span>
                      <span className="block text-xs text-[#6B7280]">
                        {formatDate(po.order_date)} · {tzs(po.landed)}
                        {po.balance > 0 && po.status !== "cancelled" ? ` · ${tzs(po.balance)} due` : ""}
                      </span>
                    </span>
                    <StatusPill tone={poStatusTone(po.status)}>{PO_STATUS_LABELS[po.status as PoStatus] ?? humanize(po.status)}</StatusPill>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="px-4 py-4 text-sm text-[#6B7280]">No purchase orders yet.</p>
          )}
        </div>

        <div className="rounded-xl border border-[#E5E5E5] bg-white">
          <p className="border-b border-[#F0F0F0] px-4 py-3 text-sm font-semibold text-navy">Payments</p>
          {s.supplier_payments.length ? (
            <ul className="divide-y divide-[#F0F0F0]">
              {s.supplier_payments.map((p) => {
                const po = s.purchase_orders.find((x) => x.id === p.po_id);
                return (
                  <li key={p.id} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
                    <span className="min-w-0">
                      <span className="block font-semibold text-navy">{tzs(p.amount)}</span>
                      <span className="block truncate text-xs text-[#6B7280]">
                        {formatDate(p.paid_at)} · {p.method ?? "—"}
                        {po ? ` · ${po.po_number}` : " · on account"}
                        {p.reference ? ` · ref ${p.reference}` : ""}
                      </span>
                    </span>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="px-4 py-4 text-sm text-[#6B7280]">No payments yet. Record them on each purchase order.</p>
          )}
        </div>
      </div>
    </div>
  );
}

function SupplierForm({ row, onClose, onSaved }: { row: Row | null; onClose: () => void; onSaved: () => Promise<void> }) {
  const save = useServerFn(upsertSupplier);
  const [busy, setBusy] = useState(false);
  const [rating, setRating] = useState<number | null>(row?.rating ?? null);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const text = (k: string) => String(fd.get(k) ?? "").trim();
    setBusy(true);
    try {
      await save({
        data: {
          ...(row ? { id: row.id } : {}),
          name: text("name"),
          contact_person: text("contact_person"),
          phone: text("phone"),
          email: text("email"),
          location: text("location"),
          products_services: text("products_services"),
          payment_terms: text("payment_terms"),
          status: fd.get("status") === "inactive" ? "inactive" : "active",
          rating,
          notes: text("notes"),
        },
      });
      toast.success(row ? "Supplier updated" : "Supplier added");
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
      <form onSubmit={onSubmit} className="grid gap-3 sm:grid-cols-2">
        <div className="flex items-center justify-between sm:col-span-2">
          <h2 className="text-base font-semibold text-navy">{row ? `Edit ${row.name}` : "New supplier"}</h2>
          <button type="button" className={btn("ghost", "sm")} onClick={onClose} aria-label="Close form">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div>
          <label className="field-label">Name *</label>
          <input name="name" required className="field-input" defaultValue={row?.name ?? ""} />
        </div>
        <div>
          <label className="field-label">Contact person</label>
          <input name="contact_person" className="field-input" defaultValue={row?.contact_person ?? ""} />
        </div>
        <div>
          <label className="field-label">Phone</label>
          <input name="phone" type="tel" className="field-input" placeholder="+255…" defaultValue={row?.phone ?? ""} />
        </div>
        <div>
          <label className="field-label">Email</label>
          <input name="email" type="email" className="field-input" defaultValue={row?.email ?? ""} />
        </div>
        <div>
          <label className="field-label">Location</label>
          <input name="location" className="field-input" defaultValue={row?.location ?? ""} />
        </div>
        <div>
          <label className="field-label">Payment terms</label>
          <input name="payment_terms" className="field-input" placeholder="e.g. 50% deposit, balance on delivery" defaultValue={row?.payment_terms ?? ""} />
        </div>
        <div className="sm:col-span-2">
          <label className="field-label">Products / services</label>
          <input name="products_services" className="field-input" placeholder="e.g. Mninga timber, foam, hinges" defaultValue={row?.products_services ?? ""} />
        </div>
        <div>
          <label className="field-label">Status</label>
          <select name="status" className="field-input" defaultValue={row?.status ?? "active"}>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </div>
        <div>
          <p className="field-label">Rating</p>
          <StarInput value={rating} onChange={setRating} />
        </div>
        <div className="sm:col-span-2">
          <label className="field-label">Notes</label>
          <textarea name="notes" rows={2} className="field-input" defaultValue={row?.notes ?? ""} />
        </div>
        <div className="flex gap-2 sm:col-span-2">
          <button type="submit" className={btn("gold")} disabled={busy}>
            {busy ? "Saving…" : row ? "Save changes" : "Add supplier"}
          </button>
          <button type="button" className={btn("outline")} onClick={onClose}>
            Cancel
          </button>
        </div>
      </form>
    </AdminCard>
  );
}
