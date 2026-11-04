import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import {
  Archive,
  ArchiveRestore,
  Download,
  FileText,
  Paperclip,
  Pencil,
  Plus,
  Receipt,
  Tags,
  Wallet,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { toast } from "sonner";
import {
  AdminCard,
  AdminEmpty,
  AdminLoading,
  AdminNotice,
  AdminPageHeader,
  ChartCard,
  DataTable,
  DateRangeSelect,
  FilterSelect,
  KpiCard,
  MigrationNeeded,
  SearchInput,
  StatusPill,
  btn,
  formatDate,
  tzs,
  type Column,
} from "@/components/admin/admin-ui";
import {
  openSignedUrl,
  RECEIPT_ACCEPT,
  receiptFileToUpload,
} from "@/components/admin/finance/receipt-file";
import {
  EXPENSE_CATEGORIES,
  EXPENSE_CATEGORY_LABELS,
  PAYMENT_METHODS,
  darToday,
  type ExpenseCategory,
} from "@/lib/ops/business";
import { csvDate, downloadCsv } from "@/lib/ops/csv";
import { darDayKey, rangeBounds, type DateRange } from "@/lib/ops/date-range";
import {
  getExpenseReceiptUrl,
  listExpenseFormOptions,
  listExpenses,
  setExpenseArchived,
  upsertExpense,
} from "@/lib/ops/expenses.functions";

export const Route = createFileRoute("/admin/expenses")({
  head: () => ({ meta: [{ title: "Expenses — Admin" }, { name: "robots", content: "noindex" }] }),
  component: AdminExpensesPage,
});

type Data = Awaited<ReturnType<typeof listExpenses>>;
type Row = Data["rows"][number];
type Options = Awaited<ReturnType<typeof listExpenseFormOptions>>;

const CATEGORY_OPTIONS: { value: "all" | ExpenseCategory; label: string }[] = [
  { value: "all", label: "All categories" },
  ...EXPENSE_CATEGORIES.map((c) => ({ value: c, label: EXPENSE_CATEGORY_LABELS[c] })),
];

function categoryLabel(category: string) {
  return EXPENSE_CATEGORY_LABELS[category as ExpenseCategory] ?? category;
}

function AdminExpensesPage() {
  const list = useServerFn(listExpenses);
  const loadOptions = useServerFn(listExpenseFormOptions);
  const archive = useServerFn(setExpenseArchived);
  const receiptUrl = useServerFn(getExpenseReceiptUrl);
  const [data, setData] = useState<Data | null>(null);
  const [options, setOptions] = useState<Options | null>(null);
  const [q, setQ] = useState("");
  const [range, setRange] = useState<DateRange | "all">("30d");
  const [category, setCategory] = useState<"all" | ExpenseCategory>("all");
  const [showArchived, setShowArchived] = useState(false);
  const [editing, setEditing] = useState<Row | "new" | null>(null);

  async function refresh() {
    setData(await list());
  }

  useEffect(() => {
    refresh().catch((e) => toast.error(e instanceof Error ? e.message : "Load failed"));
  }, []);

  function openForm(row: Row | "new") {
    setEditing(row);
    if (!options)
      loadOptions()
        .then(setOptions)
        .catch(() => setOptions({ suppliers: [], orders: [] }));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  const rows = data?.rows ?? [];
  const inRange = useMemo(() => {
    const from = range === "all" ? null : darDayKey(rangeBounds(range).from);
    const term = q.trim().toLowerCase();
    return rows.filter((e) => {
      if (e.archived !== showArchived) return false;
      if (from && e.expense_date < from) return false;
      if (!term) return true;
      return [
        e.description,
        e.supplier_name,
        e.order_number,
        e.payment_method,
        categoryLabel(e.category),
      ].some((v) => v?.toLowerCase().includes(term));
    });
  }, [rows, range, q, showArchived]);
  const shown = category === "all" ? inRange : inRange.filter((e) => e.category === category);

  const byCategory = useMemo(() => {
    const totals = new Map<string, number>();
    for (const e of inRange) totals.set(e.category, (totals.get(e.category) ?? 0) + e.amount);
    return [...totals.entries()].sort((a, b) => b[1] - a[1]);
  }, [inRange]);
  const total = shown.reduce((s, e) => s + e.amount, 0);
  const rangeTotal = inRange.reduce((s, e) => s + e.amount, 0);
  const top = byCategory[0];
  const missingReceipts = shown.filter((e) => !e.has_receipt).length;

  async function onArchive(e: Row) {
    if (!e.archived && !confirm(`Archive “${e.description}”? It will no longer count in reports.`))
      return;
    try {
      await archive({ data: { id: e.id, archived: !e.archived } });
      toast.success(e.archived ? "Expense restored" : "Expense archived");
      await refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "That did not work");
    }
  }

  function viewReceipt(e: Row) {
    openSignedUrl(() => receiptUrl({ data: { id: e.id } })).catch((err) =>
      toast.error(err instanceof Error ? err.message : "Could not open the receipt"),
    );
  }

  function exportCsv() {
    downloadCsv(
      `gk-expenses-${new Date().toISOString().slice(0, 10)}`,
      [
        "Date",
        "Category",
        "Description",
        "Amount (TSh)",
        "Payment method",
        "Supplier",
        "Order",
        "Receipt",
        "Archived",
        "Recorded by",
        "Recorded at",
      ],
      shown.map((e) => [
        e.expense_date,
        categoryLabel(e.category),
        e.description,
        Math.round(e.amount),
        e.payment_method,
        e.supplier_name,
        e.order_number,
        e.has_receipt ? "Yes" : "No",
        e.archived ? "Yes" : "No",
        e.created_by,
        csvDate(e.created_at),
      ]),
    );
  }

  const columns: Column<Row>[] = [
    {
      key: "date",
      header: "Date",
      cell: (e) => (
        <span className="whitespace-nowrap text-[#374151]">{formatDate(e.expense_date)}</span>
      ),
    },
    {
      key: "description",
      header: "Description",
      cell: (e) => (
        <div className="min-w-0">
          <p className="font-medium text-navy">{e.description}</p>
          {(e.supplier_name || e.order_number) && (
            <p className="truncate text-xs text-[#6B7280]">
              {[e.supplier_name, e.order_number ? `Order #${e.order_number}` : null]
                .filter(Boolean)
                .join(" · ")}
            </p>
          )}
        </div>
      ),
    },
    {
      key: "category",
      header: "Category",
      cell: (e) => (
        <StatusPill tone={e.category === "payment_fees" ? "info" : "neutral"}>
          {categoryLabel(e.category)}
        </StatusPill>
      ),
    },
    {
      key: "method",
      header: "Paid by",
      className: "hidden lg:table-cell",
      cell: (e) => e.payment_method ?? <span className="text-[#9CA3AF]">—</span>,
    },
    {
      key: "amount",
      header: "Amount",
      align: "right",
      cell: (e) => <span className="font-semibold text-navy">{tzs(e.amount)}</span>,
    },
    {
      key: "receipt",
      header: "Receipt",
      cell: (e) =>
        e.has_receipt ? (
          <button type="button" className={btn("outline", "sm")} onClick={() => viewReceipt(e)}>
            <FileText className="h-3.5 w-3.5" /> View
          </button>
        ) : (
          <StatusPill tone="pending">Missing</StatusPill>
        ),
    },
    {
      key: "actions",
      header: <span className="sr-only">Actions</span>,
      align: "right",
      cell: (e) => rowActions(e),
    },
  ];

  function rowActions(e: Row) {
    return (
      <div className="flex justify-end gap-1.5">
        <button
          type="button"
          className={btn("outline", "sm")}
          onClick={() => openForm(e)}
          aria-label={`Edit ${e.description}`}
        >
          <Pencil className="h-3.5 w-3.5" />
          <span className="hidden xl:inline">Edit</span>
        </button>
        <button type="button" className={btn("outline", "sm")} onClick={() => void onArchive(e)}>
          {e.archived ? (
            <ArchiveRestore className="h-3.5 w-3.5" />
          ) : (
            <Archive className="h-3.5 w-3.5" />
          )}
          {e.archived ? "Restore" : "Archive"}
        </button>
      </div>
    );
  }

  return (
    <div>
      <AdminPageHeader
        title="Expenses"
        description="Day-to-day running costs: rent, wages, transport, utilities, payment fees and more."
        action={
          data?.available && (
            <>
              <button
                type="button"
                className={btn("outline")}
                onClick={exportCsv}
                disabled={!shown.length}
              >
                <Download className="h-4 w-4" /> Export CSV
              </button>
              <button type="button" className={btn("gold")} onClick={() => openForm("new")}>
                <Plus className="h-4 w-4" /> Add expense
              </button>
            </>
          )
        }
      />

      {!data ? (
        <AdminLoading label="Loading expenses…" />
      ) : !data.available ? (
        <MigrationNeeded reason={data.reason} />
      ) : (
        <div className="space-y-4">
          <AdminNotice>
            Mobile money and bank charges count as an expense here (category “Payment fees”).
            Payments to suppliers for purchase orders are recorded under Purchases, so do not enter
            them again here.
          </AdminNotice>

          {editing && (
            <ExpenseForm
              key={editing === "new" ? "new" : editing.id}
              row={editing === "new" ? null : editing}
              options={options}
              onClose={() => setEditing(null)}
              onSaved={refresh}
              onViewReceipt={viewReceipt}
            />
          )}

          <section className="grid gap-3 sm:grid-cols-3">
            <KpiCard
              label={
                category === "all" ? "Total in period" : `${categoryLabel(category)} in period`
              }
              value={tzs(total)}
              hint={`${shown.length} expense${shown.length === 1 ? "" : "s"}`}
              icon={<Wallet className="h-5 w-5" />}
              tone="gold"
            />
            <KpiCard
              label="Largest category"
              value={top ? categoryLabel(top[0]) : "—"}
              hint={
                top
                  ? `${tzs(top[1])} · ${rangeTotal ? Math.round((top[1] / rangeTotal) * 100) : 0}% of spending`
                  : "No expenses in this period"
              }
              icon={<Tags className="h-5 w-5" />}
              tone="navy"
            />
            <KpiCard
              label="Missing receipts"
              value={missingReceipts}
              hint={
                missingReceipts
                  ? "Upload them to keep records complete"
                  : "Every expense has a receipt"
              }
              icon={<Receipt className="h-5 w-5" />}
              tone={missingReceipts ? "pending" : "success"}
            />
          </section>

          {byCategory.length > 0 && (
            <ChartCard title="By category" description="Share of spending in the selected period">
              <ul className="space-y-2">
                {byCategory.map(([cat, amount]) => (
                  <li key={cat}>
                    <button
                      type="button"
                      onClick={() =>
                        setCategory(category === cat ? "all" : (cat as ExpenseCategory))
                      }
                      className="block w-full text-left"
                      aria-pressed={category === cat}
                    >
                      <span className="flex items-center justify-between gap-3 text-sm">
                        <span
                          className={
                            category === cat ? "font-semibold text-navy" : "text-[#374151]"
                          }
                        >
                          {categoryLabel(cat)}
                        </span>
                        <span className="font-medium text-navy">{tzs(amount)}</span>
                      </span>
                      <span className="mt-1 block h-2 overflow-hidden rounded-full bg-[#F3F4F6]">
                        <span
                          className="block h-full rounded-full bg-gold"
                          style={{
                            width: `${rangeTotal ? Math.max(2, (amount / rangeTotal) * 100) : 0}%`,
                          }}
                        />
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </ChartCard>
          )}

          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_11rem_12rem_auto]">
            <SearchInput
              value={q}
              onChange={setQ}
              placeholder="Search description, supplier or order"
              className="sm:col-span-2 lg:col-span-1"
            />
            <DateRangeSelect value={range} onChange={setRange} allowAll />
            <FilterSelect
              value={category}
              onChange={setCategory}
              options={CATEGORY_OPTIONS}
              label="Category"
            />
            <label className="flex h-10 items-center gap-2 rounded-lg border border-[#E5E5E5] bg-white px-3 text-sm text-[#374151]">
              <input
                type="checkbox"
                checked={showArchived}
                onChange={(e) => setShowArchived(e.target.checked)}
                className="accent-[#14213D]"
              />
              Archived only
            </label>
          </div>

          <DataTable
            rows={shown}
            columns={columns}
            rowKey={(e) => e.id}
            empty={
              <AdminEmpty title={rows.length ? "No expenses match" : "No expenses yet"}>
                {rows.length
                  ? "Try another period, category or search."
                  : "Add rent, wages, transport and other running costs here."}
              </AdminEmpty>
            }
            mobileCard={(e) => (
              <div>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-semibold text-navy">{e.description}</p>
                    <p className="truncate text-xs text-[#6B7280]">
                      {[formatDate(e.expense_date), e.payment_method, e.supplier_name]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  </div>
                  <p className="shrink-0 font-semibold text-navy">{tzs(e.amount)}</p>
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  <StatusPill tone={e.category === "payment_fees" ? "info" : "neutral"}>
                    {categoryLabel(e.category)}
                  </StatusPill>
                  {e.has_receipt ? (
                    <button
                      type="button"
                      className={btn("ghost", "sm")}
                      onClick={() => viewReceipt(e)}
                    >
                      <FileText className="h-3.5 w-3.5" /> Receipt
                    </button>
                  ) : (
                    <StatusPill tone="pending">No receipt</StatusPill>
                  )}
                </div>
                <div className="mt-3 border-t border-[#F0F0F0] pt-3">{rowActions(e)}</div>
              </div>
            )}
          />
        </div>
      )}
    </div>
  );
}

function ExpenseForm({
  row,
  options,
  onClose,
  onSaved,
  onViewReceipt,
}: {
  row: Row | null;
  options: Options | null;
  onClose: () => void;
  onSaved: () => Promise<void>;
  onViewReceipt: (row: Row) => void;
}) {
  const save = useServerFn(upsertExpense);
  const [busy, setBusy] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [clearReceipt, setClearReceipt] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const amount = Number(fd.get("amount"));
    if (!Number.isFinite(amount) || amount <= 0) {
      toast.error("Enter the amount paid");
      return;
    }
    setBusy(true);
    try {
      const receipt = file ? await receiptFileToUpload(file) : undefined;
      await save({
        data: {
          ...(row ? { id: row.id } : {}),
          expense_date: String(fd.get("expense_date") ?? darToday()),
          category: String(fd.get("category")) as ExpenseCategory,
          description: String(fd.get("description") ?? "").trim(),
          amount,
          payment_method: String(fd.get("payment_method") ?? ""),
          supplier_id: String(fd.get("supplier_id") ?? ""),
          order_id: String(fd.get("order_id") ?? ""),
          ...(receipt ? { receipt } : {}),
          ...(clearReceipt && !receipt ? { clear_receipt: true } : {}),
        },
      });
      toast.success(row ? "Expense updated" : "Expense added");
      onClose();
      await onSaved();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save the expense");
    } finally {
      setBusy(false);
    }
  }

  const suppliers = options?.suppliers ?? [];
  const orders = options?.orders ?? [];
  const keepsReceipt = Boolean(row?.has_receipt) && !clearReceipt && !file;

  return (
    <AdminCard>
      <form onSubmit={onSubmit} className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        <div className="flex items-center justify-between md:col-span-2 xl:col-span-3">
          <h2 className="text-base font-semibold text-navy">
            {row ? "Edit expense" : "New expense"}
          </h2>
          <button
            type="button"
            className={btn("ghost", "sm")}
            onClick={onClose}
            aria-label="Close form"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div>
          <label className="field-label" htmlFor="expense_date">
            Date *
          </label>
          <input
            id="expense_date"
            name="expense_date"
            type="date"
            required
            className="field-input"
            defaultValue={row?.expense_date ?? darToday()}
          />
        </div>
        <div>
          <label className="field-label" htmlFor="category">
            Category *
          </label>
          <select
            id="category"
            name="category"
            required
            className="field-input"
            defaultValue={row?.category ?? "other"}
          >
            {EXPENSE_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {EXPENSE_CATEGORY_LABELS[c]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="field-label" htmlFor="amount">
            Amount (TSh) *
          </label>
          <input
            id="amount"
            name="amount"
            type="number"
            min={1}
            step={100}
            required
            className="field-input"
            defaultValue={row?.amount ?? ""}
          />
        </div>
        <div className="md:col-span-2 xl:col-span-3">
          <label className="field-label" htmlFor="description">
            Description *
          </label>
          <input
            id="description"
            name="description"
            required
            minLength={2}
            maxLength={500}
            className="field-input"
            placeholder="e.g. Workshop rent for March, M-Pesa withdrawal charges"
            defaultValue={row?.description ?? ""}
          />
        </div>
        <div>
          <label className="field-label" htmlFor="payment_method">
            Paid by
          </label>
          <select
            id="payment_method"
            name="payment_method"
            className="field-input"
            defaultValue={row?.payment_method ?? "Cash"}
          >
            <option value="">Not recorded</option>
            {PAYMENT_METHODS.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
            {row?.payment_method &&
              !(PAYMENT_METHODS as readonly string[]).includes(row.payment_method) && (
                <option value={row.payment_method}>{row.payment_method}</option>
              )}
          </select>
        </div>
        <div>
          <label className="field-label" htmlFor="supplier_id">
            Supplier
          </label>
          <select
            id="supplier_id"
            name="supplier_id"
            className="field-input"
            defaultValue={row?.supplier_id ?? ""}
          >
            <option value="">None</option>
            {suppliers.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
                {s.active ? "" : " (inactive)"}
              </option>
            ))}
            {row?.supplier_id && !suppliers.some((s) => s.id === row.supplier_id) && (
              <option value={row.supplier_id}>{row.supplier_name ?? "Current supplier"}</option>
            )}
          </select>
        </div>
        <div>
          <label className="field-label" htmlFor="order_id">
            For order
          </label>
          <select
            id="order_id"
            name="order_id"
            className="field-input"
            defaultValue={row?.order_id ?? ""}
          >
            <option value="">None</option>
            {orders.map((o) => (
              <option key={o.id} value={o.id}>
                #{o.order_number} · {o.customer_name}
              </option>
            ))}
            {row?.order_id && !orders.some((o) => o.id === row.order_id) && (
              <option value={row.order_id}>#{row.order_number ?? "Current order"}</option>
            )}
          </select>
        </div>

        <div className="md:col-span-2 xl:col-span-3">
          <p className="field-label">Receipt</p>
          <div className="flex flex-wrap items-center gap-2">
            <label className={btn("outline", "sm", "cursor-pointer")}>
              <Paperclip className="h-3.5 w-3.5" />
              {file
                ? "Change file"
                : row?.has_receipt && !clearReceipt
                  ? "Replace receipt"
                  : "Attach receipt"}
              <input
                type="file"
                accept={RECEIPT_ACCEPT}
                className="sr-only"
                onChange={(e) => {
                  const next = e.target.files?.[0] ?? null;
                  e.target.value = "";
                  if (next && next.size > 5_000_000) {
                    toast.error("Use a receipt under 5MB");
                    return;
                  }
                  setFile(next);
                }}
              />
            </label>
            {file && (
              <span className="inline-flex items-center gap-1.5 text-sm text-navy">
                {file.name}
                <button
                  type="button"
                  className="text-[#6B7280] hover:text-[#DC2626]"
                  onClick={() => setFile(null)}
                  aria-label="Remove chosen file"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </span>
            )}
            {keepsReceipt && row && (
              <>
                <button
                  type="button"
                  className={btn("ghost", "sm")}
                  onClick={() => onViewReceipt(row)}
                >
                  <FileText className="h-3.5 w-3.5" /> View receipt
                </button>
                <button
                  type="button"
                  className={btn("ghost", "sm", "text-[#DC2626]")}
                  onClick={() => setClearReceipt(true)}
                >
                  Remove receipt
                </button>
              </>
            )}
            {clearReceipt && !file && (
              <span className="text-xs text-[#9A3412]">
                The receipt will be removed when you save.{" "}
                <button
                  type="button"
                  className="font-semibold underline"
                  onClick={() => setClearReceipt(false)}
                >
                  Undo
                </button>
              </span>
            )}
          </div>
          <p className="mt-1 text-xs text-[#6B7280]">
            Photo or PDF, up to 5MB. Receipts are private and open through a link that expires after
            10 minutes.
          </p>
        </div>

        <div className="flex gap-2 md:col-span-2 xl:col-span-3">
          <button type="submit" className={btn("gold")} disabled={busy}>
            {busy ? "Saving…" : row ? "Save changes" : "Add expense"}
          </button>
          <button type="button" className={btn("outline")} onClick={onClose}>
            Cancel
          </button>
        </div>
      </form>
    </AdminCard>
  );
}
