import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import {
  Building2,
  Download,
  HandCoins,
  Landmark,
  Pencil,
  Plus,
  Trash2,
  TrendingDown,
  X,
} from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { toast } from "sonner";
import {
  AdminCard,
  AdminEmpty,
  AdminLoading,
  AdminNotice,
  AdminPageHeader,
  DataTable,
  KpiCard,
  MigrationNeeded,
  StatusPill,
  StatusTabs,
  btn,
  formatDate,
  tzs,
  type Column,
} from "@/components/admin/admin-ui";
import {
  CAPITAL_SOURCE_LABELS,
  CAPITAL_SOURCES,
  darToday,
  type CapitalSource,
} from "@/lib/ops/business";
import { downloadCsv } from "@/lib/ops/csv";
import {
  addLoanRepayment,
  deleteAsset,
  deleteCapitalContribution,
  deleteLoanRepayment,
  listFinanceRegisters,
  upsertAsset,
  upsertCapitalContribution,
} from "@/lib/ops/finance.functions";
import { PAYMENT_METHODS } from "@/lib/ops/business";

export const Route = createFileRoute("/admin/finance")({
  head: () => ({
    meta: [{ title: "Capital & assets — Admin" }, { name: "robots", content: "noindex" }],
  }),
  component: AdminFinancePage,
});

type Data = Awaited<ReturnType<typeof listFinanceRegisters>>;
type Capital = Data["capital"][number];
type Asset = Data["assets"][number];
type Tab = "capital" | "assets";

function sourceLabel(source: string) {
  return CAPITAL_SOURCE_LABELS[source as CapitalSource] ?? source;
}

function AdminFinancePage() {
  const list = useServerFn(listFinanceRegisters);
  const removeCapital = useServerFn(deleteCapitalContribution);
  const removeAsset = useServerFn(deleteAsset);
  const [data, setData] = useState<Data | null>(null);
  const [tab, setTab] = useState<Tab>("capital");
  const [editingCapital, setEditingCapital] = useState<Capital | "new" | null>(null);
  const [editingAsset, setEditingAsset] = useState<Asset | "new" | null>(null);
  const [repayingId, setRepayingId] = useState<string | null>(null);
  const repaying = data?.capital.find((c) => c.id === repayingId) ?? null;

  async function refresh() {
    setData(await list());
  }

  useEffect(() => {
    refresh().catch((e) => toast.error(e instanceof Error ? e.message : "Load failed"));
  }, []);

  async function onDeleteCapital(c: Capital) {
    const repaymentNote = c.repayments.length
      ? ` Its ${c.repayments.length} repayment record(s) will be deleted too.`
      : "";
    if (
      !confirm(
        `Delete the ${sourceLabel(c.source).toLowerCase()} of ${tzs(c.amount)}?${repaymentNote} This is logged.`,
      )
    )
      return;
    try {
      await removeCapital({ data: { id: c.id } });
      toast.success("Contribution deleted");
      await refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Delete failed");
    }
  }

  async function onDeleteAsset(a: Asset) {
    if (
      !confirm(
        `Delete the asset “${a.name}”? Use “Disposed on” instead if it was sold or scrapped.`,
      )
    )
      return;
    try {
      await removeAsset({ data: { id: a.id } });
      toast.success("Asset deleted");
      await refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Delete failed");
    }
  }

  function openCapital(row: Capital | "new") {
    setTab("capital");
    setEditingAsset(null);
    setRepayingId(null);
    setEditingCapital(row);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function openAsset(row: Asset | "new") {
    setTab("assets");
    setEditingCapital(null);
    setEditingAsset(row);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function exportCsv() {
    if (!data) return;
    const day = new Date().toISOString().slice(0, 10);
    if (tab === "capital") {
      downloadCsv(
        `gk-capital-${day}`,
        [
          "Date",
          "Source",
          "Contributor",
          "Amount (TSh)",
          "Repaid (TSh)",
          "Interest paid (TSh)",
          "Still owed (TSh)",
          "Due date",
          "Terms",
          "Notes",
        ],
        data.capital.map((c) => [
          c.date,
          sourceLabel(c.source),
          c.contributor,
          Math.round(c.amount),
          c.loan ? Math.round(c.loan.repaid) : null,
          c.loan ? Math.round(c.loan.interestPaid) : null,
          c.loan ? Math.round(c.loan.outstanding) : null,
          c.due_date,
          c.terms,
          c.notes,
        ]),
      );
    } else {
      downloadCsv(
        `gk-assets-${day}`,
        [
          "Name",
          "Category",
          "Purchased",
          "Cost (TSh)",
          "Useful life (months)",
          "Monthly depreciation (TSh)",
          "Book value (TSh)",
          "Disposed",
          "Notes",
        ],
        data.assets.map((a) => [
          a.name,
          a.category,
          a.purchase_date,
          Math.round(a.cost),
          a.useful_life_months,
          a.monthly,
          a.bookValue,
          a.disposed_at,
          a.notes,
        ]),
      );
    }
  }

  const capitalColumns: Column<Capital>[] = [
    {
      key: "date",
      header: "Date",
      cell: (c) => <span className="whitespace-nowrap">{formatDate(c.date)}</span>,
    },
    {
      key: "source",
      header: "Source",
      cell: (c) => (
        <StatusPill
          tone={c.source === "loan" ? "pending" : c.source === "gift" ? "info" : "success"}
        >
          {sourceLabel(c.source)}
        </StatusPill>
      ),
    },
    {
      key: "contributor",
      header: "From",
      cell: (c) => c.contributor ?? <span className="text-[#9CA3AF]">—</span>,
    },
    {
      key: "terms",
      header: "Terms / notes",
      className: "hidden lg:table-cell",
      cell: (c) => (
        <span className="line-clamp-2 text-xs text-[#6B7280]">
          {[c.terms, c.notes].filter(Boolean).join(" · ") || "—"}
        </span>
      ),
    },
    {
      key: "amount",
      header: "Amount",
      align: "right",
      cell: (c) => (
        <div className="text-right">
          <p className="font-semibold text-navy">{tzs(c.amount)}</p>
          {c.loan && <LoanBalanceLine loan={c.loan} dueDate={c.due_date} />}
        </div>
      ),
    },
    {
      key: "actions",
      header: <span className="sr-only">Actions</span>,
      align: "right",
      cell: (c) => capitalActions(c),
    },
  ];

  function capitalActions(c: Capital) {
    return (
      <div className="flex justify-end gap-1.5">
        {c.loan && (
          <button
            type="button"
            className={btn(repayingId === c.id ? "navy" : "outline", "sm")}
            onClick={() => {
              setEditingCapital(null);
              setRepayingId(repayingId === c.id ? null : c.id);
              window.scrollTo({ top: 0, behavior: "smooth" });
            }}
          >
            <HandCoins className="h-3.5 w-3.5" /> Repayments
          </button>
        )}
        <button type="button" className={btn("outline", "sm")} onClick={() => openCapital(c)}>
          <Pencil className="h-3.5 w-3.5" /> Edit
        </button>
        <button
          type="button"
          className={btn("danger", "sm")}
          onClick={() => void onDeleteCapital(c)}
          aria-label="Delete contribution"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
    );
  }

  const assetColumns: Column<Asset>[] = [
    {
      key: "name",
      header: "Asset",
      cell: (a) => (
        <div className="min-w-0">
          <p className="font-medium text-navy">{a.name}</p>
          <p className="truncate text-xs text-[#6B7280]">
            {[a.category, a.purchase_date ? `Bought ${formatDate(a.purchase_date)}` : null]
              .filter(Boolean)
              .join(" · ") || "—"}
          </p>
        </div>
      ),
    },
    { key: "cost", header: "Cost", align: "right", cell: (a) => tzs(a.cost) },
    {
      key: "dep",
      header: "Depreciation",
      align: "right",
      className: "hidden lg:table-cell",
      cell: (a) =>
        a.useful_life_months ? (
          <div className="text-right">
            <p className="text-navy">{tzs(a.monthly)}/month</p>
            <p className="text-xs text-[#6B7280]">
              {a.monthsUsed} of {a.useful_life_months} months
            </p>
          </div>
        ) : (
          <span className="text-xs text-[#9CA3AF]">Not depreciated</span>
        ),
    },
    {
      key: "book",
      header: "Book value",
      align: "right",
      cell: (a) => <span className="font-semibold text-navy">{tzs(a.bookValue)}</span>,
    },
    {
      key: "status",
      header: "Status",
      cell: (a) =>
        a.disposed_at ? (
          <StatusPill>Disposed {formatDate(a.disposed_at)}</StatusPill>
        ) : (
          <StatusPill tone="success">In use</StatusPill>
        ),
    },
    {
      key: "actions",
      header: <span className="sr-only">Actions</span>,
      align: "right",
      cell: (a) => assetActions(a),
    },
  ];

  function assetActions(a: Asset) {
    return (
      <div className="flex justify-end gap-1.5">
        <button type="button" className={btn("outline", "sm")} onClick={() => openAsset(a)}>
          <Pencil className="h-3.5 w-3.5" /> Edit
        </button>
        <button
          type="button"
          className={btn("danger", "sm")}
          onClick={() => void onDeleteAsset(a)}
          aria-label="Delete asset"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
    );
  }

  return (
    <div>
      <AdminPageHeader
        title="Capital & assets"
        description="Money put into the business (owner funds, gifts, loans) and the equipment it owns."
        action={
          data?.available && (
            <>
              <button
                type="button"
                className={btn("outline")}
                onClick={exportCsv}
                disabled={tab === "capital" ? !data.capital.length : !data.assets.length}
              >
                <Download className="h-4 w-4" /> Export CSV
              </button>
              <button
                type="button"
                className={btn("gold")}
                onClick={() => (tab === "capital" ? openCapital("new") : openAsset("new"))}
              >
                <Plus className="h-4 w-4" /> {tab === "capital" ? "Add contribution" : "Add asset"}
              </button>
            </>
          )
        }
      />

      {!data ? (
        <AdminLoading label="Loading registers…" />
      ) : !data.available || !data.totals ? (
        <MigrationNeeded reason={data.reason ?? "Run migration 0008."} />
      ) : (
        <div className="space-y-4">
          <AdminNotice>
            Capital, gifts and loans are never counted as sales or profit. They appear in the
            cashbook as money coming in, and loans stay listed here until they are repaid.
          </AdminNotice>

          <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <KpiCard
              label="Total capital in"
              value={tzs(data.totals.capital)}
              hint={`Owner funds ${tzs(data.totals.bySource.owner_funds)} · Gifts ${tzs(data.totals.bySource.gift)}`}
              icon={<Landmark className="h-5 w-5" />}
              tone="navy"
            />
            <KpiCard
              label="Loans still owed"
              value={tzs(data.totals.loansOutstanding)}
              hint={
                data.repaymentsAvailable
                  ? `Borrowed ${tzs(data.totals.bySource.loan)} · repaid ${tzs(data.totals.loansRepaid)} · interest ${tzs(data.totals.loanInterestPaid)}`
                  : `Borrowed ${tzs(data.totals.bySource.loan)} · run migration 0009 to record repayments`
              }
              icon={<HandCoins className="h-5 w-5" />}
              tone="pending"
            />
            <KpiCard
              label="Assets in use (cost)"
              value={tzs(data.totals.assetCost)}
              hint={`${data.assets.filter((a) => !a.disposed_at).length} asset${data.assets.filter((a) => !a.disposed_at).length === 1 ? "" : "s"}`}
              icon={<Building2 className="h-5 w-5" />}
              tone="gold"
            />
            <KpiCard
              label="Book value today"
              value={tzs(data.totals.bookValue)}
              hint={`Depreciating ${tzs(data.totals.monthlyDepreciation)} a month`}
              icon={<TrendingDown className="h-5 w-5" />}
              tone="success"
            />
          </section>

          <StatusTabs
            tabs={[
              {
                id: "capital" as const,
                label: "Capital contributions",
                count: data.capital.length,
              },
              { id: "assets" as const, label: "Assets", count: data.assets.length },
            ]}
            value={tab}
            onChange={(next) => {
              setTab(next);
              setEditingCapital(null);
              setEditingAsset(null);
              setRepayingId(null);
            }}
          />

          {tab === "capital" ? (
            <>
              {repaying?.loan && (
                <LoanRepayments
                  key={repaying.id}
                  loan={repaying}
                  available={data.repaymentsAvailable}
                  onClose={() => setRepayingId(null)}
                  onSaved={refresh}
                />
              )}
              {editingCapital && (
                <CapitalForm
                  key={editingCapital === "new" ? "new" : editingCapital.id}
                  row={editingCapital === "new" ? null : editingCapital}
                  onClose={() => setEditingCapital(null)}
                  onSaved={refresh}
                />
              )}
              <DataTable
                rows={data.capital}
                columns={capitalColumns}
                rowKey={(c) => c.id}
                empty={
                  <AdminEmpty
                    title="No capital recorded yet"
                    icon={<Landmark className="h-5 w-5" />}
                  >
                    Record the money you or others put into GK Furnish, including loans and their
                    terms.
                  </AdminEmpty>
                }
                mobileCard={(c) => (
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-semibold text-navy">
                          {c.contributor || sourceLabel(c.source)}
                        </p>
                        <p className="text-xs text-[#6B7280]">{formatDate(c.date)}</p>
                      </div>
                      <p className="shrink-0 font-semibold text-navy">{tzs(c.amount)}</p>
                    </div>
                    <div className="mt-2">
                      <StatusPill
                        tone={
                          c.source === "loan" ? "pending" : c.source === "gift" ? "info" : "success"
                        }
                      >
                        {sourceLabel(c.source)}
                      </StatusPill>
                    </div>
                    {c.loan && (
                      <div className="mt-2">
                        <LoanBalanceLine loan={c.loan} dueDate={c.due_date} align="left" />
                      </div>
                    )}
                    {c.terms && <p className="mt-2 text-xs text-[#374151]">Terms: {c.terms}</p>}
                    <div className="mt-3 border-t border-[#F0F0F0] pt-3">{capitalActions(c)}</div>
                  </div>
                )}
              />
            </>
          ) : (
            <>
              {editingAsset && (
                <AssetForm
                  key={editingAsset === "new" ? "new" : editingAsset.id}
                  row={editingAsset === "new" ? null : editingAsset}
                  onClose={() => setEditingAsset(null)}
                  onSaved={refresh}
                />
              )}
              <DataTable
                rows={data.assets}
                columns={assetColumns}
                rowKey={(a) => a.id}
                empty={
                  <AdminEmpty
                    title="No assets recorded yet"
                    icon={<Building2 className="h-5 w-5" />}
                  >
                    Add machines, tools, vehicles and other equipment the business owns.
                  </AdminEmpty>
                }
                mobileCard={(a) => (
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-semibold text-navy">{a.name}</p>
                        <p className="truncate text-xs text-[#6B7280]">
                          {[a.category, a.purchase_date ? formatDate(a.purchase_date) : null]
                            .filter(Boolean)
                            .join(" · ")}
                        </p>
                      </div>
                      {a.disposed_at ? (
                        <StatusPill>Disposed</StatusPill>
                      ) : (
                        <StatusPill tone="success">In use</StatusPill>
                      )}
                    </div>
                    <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
                      <p>
                        <span className="block text-xs text-[#6B7280]">Cost</span>
                        <span className="font-medium text-navy">{tzs(a.cost)}</span>
                      </p>
                      <p>
                        <span className="block text-xs text-[#6B7280]">Book value</span>
                        <span className="font-semibold text-navy">{tzs(a.bookValue)}</span>
                      </p>
                    </div>
                    <div className="mt-3 border-t border-[#F0F0F0] pt-3">{assetActions(a)}</div>
                  </div>
                )}
              />
            </>
          )}
        </div>
      )}
    </div>
  );
}

function LoanBalanceLine({
  loan,
  dueDate,
  align = "right",
}: {
  loan: NonNullable<Capital["loan"]>;
  dueDate: string | null;
  align?: "left" | "right";
}) {
  const overdue = Boolean(dueDate && dueDate < darToday() && loan.outstanding > 0);
  return (
    <div className={align === "right" ? "text-right" : ""}>
      {loan.outstanding > 0 ? (
        <p className={`text-xs font-semibold ${overdue ? "text-[#DC2626]" : "text-[#B45309]"}`}>
          Still owed {tzs(loan.outstanding)}
          {dueDate ? ` · ${overdue ? "overdue since" : "due"} ${formatDate(dueDate)}` : ""}
        </p>
      ) : (
        <p className="text-xs font-semibold text-[#15803D]">Fully repaid</p>
      )}
      {(loan.repaid > 0 || loan.interestPaid > 0) && (
        <p className="text-xs text-[#6B7280]">
          Repaid {tzs(loan.repaid)}
          {loan.interestPaid > 0 ? ` + interest ${tzs(loan.interestPaid)}` : ""}
        </p>
      )}
    </div>
  );
}

function LoanRepayments({
  loan,
  available,
  onClose,
  onSaved,
}: {
  loan: Capital;
  available: boolean;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const add = useServerFn(addLoanRepayment);
  const remove = useServerFn(deleteLoanRepayment);
  const [busy, setBusy] = useState(false);
  const balance = loan.loan;
  if (!balance) return null;

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    const principal = Number(fd.get("principal") || 0);
    const interest = Number(fd.get("interest") || 0);
    if (!Number.isFinite(principal) || !Number.isFinite(interest) || principal < 0 || interest < 0) {
      toast.error("Amounts must be zero or more");
      return;
    }
    if (principal + interest <= 0) {
      toast.error("Enter the principal and/or interest paid");
      return;
    }
    if (balance && Math.round(principal) > Math.round(balance.outstanding)) {
      toast.error(`Principal is more than the ${tzs(balance.outstanding)} still owed`);
      return;
    }
    setBusy(true);
    try {
      const r = await add({
        data: {
          loanId: loan.id,
          paid_on: String(fd.get("paid_on") ?? darToday()),
          principal,
          interest,
          method: String(fd.get("method") ?? ""),
          reference: String(fd.get("reference") ?? ""),
          notes: String(fd.get("notes") ?? ""),
        },
      });
      toast.success(r.outstanding > 0 ? `Repayment recorded. ${tzs(r.outstanding)} still owed.` : "Repayment recorded. The loan is fully repaid.");
      form.reset();
      await onSaved();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save");
    } finally {
      setBusy(false);
    }
  }

  async function onDelete(id: string) {
    if (!confirm("Delete this repayment? The amount will count as owed again. This is logged.")) return;
    try {
      await remove({ data: { id } });
      toast.success("Repayment deleted");
      await onSaved();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Delete failed");
    }
  }

  return (
    <AdminCard>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-navy">
            Repayments · {loan.contributor || "Loan"} ({formatDate(loan.date)})
          </h2>
          <p className="mt-0.5 text-sm text-[#6B7280]">
            Borrowed {tzs(loan.amount)} · repaid {tzs(balance.repaid)} ·{" "}
            <span className="font-semibold text-navy">still owed {tzs(balance.outstanding)}</span>
          </p>
        </div>
        <button type="button" className={btn("ghost", "sm")} onClick={onClose} aria-label="Close repayments">
          <X className="h-4 w-4" />
        </button>
      </div>

      {!available ? (
        <div className="mt-3">
          <MigrationNeeded reason="Run drizzle/migrations/0009_loan_repayments.sql in the Supabase SQL editor to record repayments." />
        </div>
      ) : (
        <>
          {balance.outstanding > 0 ? (
            <form onSubmit={onSubmit} className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <label className="field-label" htmlFor="rp-date">
                  Paid on *
                </label>
                <input id="rp-date" name="paid_on" type="date" required className="field-input" defaultValue={darToday()} />
              </div>
              <div>
                <label className="field-label" htmlFor="rp-principal">
                  Principal (TSh)
                </label>
                <input
                  id="rp-principal"
                  name="principal"
                  type="number"
                  min={0}
                  max={Math.round(balance.outstanding)}
                  step={1000}
                  className="field-input"
                  placeholder={`Up to ${Math.round(balance.outstanding).toLocaleString("en-US")}`}
                />
              </div>
              <div>
                <label className="field-label" htmlFor="rp-interest">
                  Interest (TSh)
                </label>
                <input id="rp-interest" name="interest" type="number" min={0} step={100} className="field-input" placeholder="0" />
              </div>
              <div>
                <label className="field-label" htmlFor="rp-method">
                  Method
                </label>
                <select id="rp-method" name="method" className="field-input" defaultValue="Bank transfer">
                  {PAYMENT_METHODS.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </div>
              <div className="sm:col-span-2">
                <label className="field-label" htmlFor="rp-reference">
                  Reference
                </label>
                <input id="rp-reference" name="reference" className="field-input" placeholder="Bank or M-Pesa reference" />
              </div>
              <div className="sm:col-span-2">
                <label className="field-label" htmlFor="rp-notes">
                  Notes
                </label>
                <input id="rp-notes" name="notes" className="field-input" />
              </div>
              <div className="flex flex-wrap items-center gap-2 sm:col-span-2 lg:col-span-4">
                <button type="submit" className={btn("gold")} disabled={busy}>
                  {busy ? "Saving…" : "Record repayment"}
                </button>
                <p className="text-xs text-[#6B7280]">
                  Principal reduces what is owed and is not an expense. Interest is counted as an expense in reports.
                </p>
              </div>
            </form>
          ) : (
            <p className="mt-3 rounded-lg bg-[#DCFCE7] px-3 py-2 text-sm font-medium text-[#15803D]">This loan is fully repaid.</p>
          )}

          <div className="mt-4 border-t border-[#F0F0F0] pt-3">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[#6B7280]">History</p>
            {loan.repayments.length ? (
              <ul className="divide-y divide-[#F0F0F0]">
                {loan.repayments.map((r) => (
                  <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                    <div className="min-w-0">
                      <p className="font-medium text-navy">
                        {formatDate(r.paid_on)} · {tzs(r.principal)}
                        {r.interest > 0 ? <span className="text-[#6B7280]"> + interest {tzs(r.interest)}</span> : null}
                      </p>
                      <p className="truncate text-xs text-[#6B7280]">{[r.method, r.reference, r.notes].filter(Boolean).join(" · ") || "—"}</p>
                    </div>
                    <button type="button" className={btn("danger", "sm")} onClick={() => void onDelete(r.id)} aria-label="Delete repayment">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-[#6B7280]">No repayments recorded yet.</p>
            )}
          </div>
        </>
      )}
    </AdminCard>
  );
}

function FormHeader({ title, onClose }: { title: string; onClose: () => void }) {
  return (
    <div className="flex items-center justify-between sm:col-span-2 lg:col-span-3">
      <h2 className="text-base font-semibold text-navy">{title}</h2>
      <button
        type="button"
        className={btn("ghost", "sm")}
        onClick={onClose}
        aria-label="Close form"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

function CapitalForm({
  row,
  onClose,
  onSaved,
}: {
  row: Capital | null;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const save = useServerFn(upsertCapitalContribution);
  const [busy, setBusy] = useState(false);
  const [source, setSource] = useState<CapitalSource>(
    (row?.source as CapitalSource | undefined) ?? "owner_funds",
  );

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const amount = Number(fd.get("amount"));
    if (!Number.isFinite(amount) || amount <= 0) {
      toast.error("Enter the amount received");
      return;
    }
    const terms = String(fd.get("terms") ?? "").trim();
    if (
      source === "loan" &&
      !terms &&
      !confirm("No repayment terms entered for this loan. Save anyway?")
    )
      return;
    setBusy(true);
    try {
      await save({
        data: {
          ...(row ? { id: row.id } : {}),
          date: String(fd.get("date") ?? darToday()),
          source,
          contributor: String(fd.get("contributor") ?? ""),
          amount,
          terms,
          notes: String(fd.get("notes") ?? ""),
          due_date: source === "loan" ? String(fd.get("due_date") ?? "") : "",
        },
      });
      toast.success(row ? "Contribution updated" : "Contribution recorded");
      onClose();
      await onSaved();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AdminCard>
      <form onSubmit={onSubmit} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <FormHeader
          title={row ? "Edit contribution" : "New capital contribution"}
          onClose={onClose}
        />
        <div>
          <label className="field-label" htmlFor="cap-date">
            Date *
          </label>
          <input
            id="cap-date"
            name="date"
            type="date"
            required
            className="field-input"
            defaultValue={row?.date ?? darToday()}
          />
        </div>
        <div>
          <label className="field-label" htmlFor="cap-source">
            Source *
          </label>
          <select
            id="cap-source"
            className="field-input"
            value={source}
            onChange={(e) => setSource(e.target.value as CapitalSource)}
          >
            {CAPITAL_SOURCES.map((s) => (
              <option key={s} value={s}>
                {CAPITAL_SOURCE_LABELS[s]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="field-label" htmlFor="cap-amount">
            Amount (TSh) *
          </label>
          <input
            id="cap-amount"
            name="amount"
            type="number"
            min={1}
            step={1000}
            required
            className="field-input"
            defaultValue={row?.amount ?? ""}
          />
        </div>
        <div>
          <label className="field-label" htmlFor="cap-contributor">
            {source === "loan" ? "Lender" : "Contributor"}
          </label>
          <input
            id="cap-contributor"
            name="contributor"
            className="field-input"
            placeholder={source === "loan" ? "Bank, SACCO or person" : "Name"}
            defaultValue={row?.contributor ?? ""}
          />
        </div>
        {source === "loan" && (
          <div>
            <label className="field-label" htmlFor="cap-due">
              Repay by
            </label>
            <input
              id="cap-due"
              name="due_date"
              type="date"
              className="field-input"
              defaultValue={row?.due_date ?? ""}
            />
            <p className="mt-1 text-xs text-[#6B7280]">Shows as overdue if not fully repaid by then.</p>
          </div>
        )}
        <div className="sm:col-span-2">
          <label className="field-label" htmlFor="cap-terms">
            Terms{source === "loan" ? " (recommended)" : ""}
          </label>
          <input
            id="cap-terms"
            name="terms"
            className="field-input"
            placeholder={source === "loan" ? "Interest, repayment amount and dates" : "Optional"}
            defaultValue={row?.terms ?? ""}
          />
        </div>
        <div className="sm:col-span-2 lg:col-span-3">
          <label className="field-label" htmlFor="cap-notes">
            Notes
          </label>
          <textarea
            id="cap-notes"
            name="notes"
            rows={2}
            className="field-input"
            defaultValue={row?.notes ?? ""}
          />
        </div>
        <div className="flex gap-2 sm:col-span-2 lg:col-span-3">
          <button type="submit" className={btn("gold")} disabled={busy}>
            {busy ? "Saving…" : row ? "Save changes" : "Record contribution"}
          </button>
          <button type="button" className={btn("outline")} onClick={onClose}>
            Cancel
          </button>
        </div>
      </form>
    </AdminCard>
  );
}

function AssetForm({
  row,
  onClose,
  onSaved,
}: {
  row: Asset | null;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const save = useServerFn(upsertAsset);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const cost = Number(fd.get("cost") || 0);
    const lifeRaw = String(fd.get("useful_life_months") ?? "").trim();
    const life = lifeRaw ? Math.round(Number(lifeRaw)) : null;
    if (!Number.isFinite(cost) || cost < 0) {
      toast.error("Enter the purchase cost");
      return;
    }
    if (life != null && (!Number.isFinite(life) || life <= 0)) {
      toast.error("Useful life must be a number of months");
      return;
    }
    setBusy(true);
    try {
      await save({
        data: {
          ...(row ? { id: row.id } : {}),
          name: String(fd.get("name") ?? "").trim(),
          category: String(fd.get("category") ?? ""),
          purchase_date: String(fd.get("purchase_date") ?? ""),
          cost,
          useful_life_months: life,
          notes: String(fd.get("notes") ?? ""),
          disposed_at: String(fd.get("disposed_at") ?? ""),
        },
      });
      toast.success(row ? "Asset updated" : "Asset added");
      onClose();
      await onSaved();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AdminCard>
      <form onSubmit={onSubmit} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <FormHeader title={row ? `Edit ${row.name}` : "New asset"} onClose={onClose} />
        <div>
          <label className="field-label" htmlFor="asset-name">
            Name *
          </label>
          <input
            id="asset-name"
            name="name"
            required
            className="field-input"
            placeholder="e.g. Table saw"
            defaultValue={row?.name ?? ""}
          />
        </div>
        <div>
          <label className="field-label" htmlFor="asset-category">
            Category
          </label>
          <input
            id="asset-category"
            name="category"
            list="asset-categories"
            className="field-input"
            placeholder="Machinery, tools, vehicle…"
            defaultValue={row?.category ?? ""}
          />
          <datalist id="asset-categories">
            {[
              "Machinery",
              "Tools",
              "Vehicle",
              "Furniture & fittings",
              "Computer & phone",
              "Building",
            ].map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        </div>
        <div>
          <label className="field-label" htmlFor="asset-date">
            Purchase date
          </label>
          <input
            id="asset-date"
            name="purchase_date"
            type="date"
            className="field-input"
            defaultValue={row?.purchase_date ?? ""}
          />
        </div>
        <div>
          <label className="field-label" htmlFor="asset-cost">
            Cost (TSh) *
          </label>
          <input
            id="asset-cost"
            name="cost"
            type="number"
            min={0}
            step={1000}
            required
            className="field-input"
            defaultValue={row?.cost ?? ""}
          />
        </div>
        <div>
          <label className="field-label" htmlFor="asset-life">
            Useful life (months)
          </label>
          <input
            id="asset-life"
            name="useful_life_months"
            type="number"
            min={1}
            max={1200}
            className="field-input"
            placeholder="e.g. 60"
            defaultValue={row?.useful_life_months ?? ""}
          />
          <p className="mt-1 text-xs text-[#6B7280]">
            Cost is spread evenly over these months. Leave empty for no depreciation.
          </p>
        </div>
        <div>
          <label className="field-label" htmlFor="asset-disposed">
            Disposed on
          </label>
          <input
            id="asset-disposed"
            name="disposed_at"
            type="date"
            className="field-input"
            defaultValue={row?.disposed_at ?? ""}
          />
          <p className="mt-1 text-xs text-[#6B7280]">Set when it is sold, scrapped or lost.</p>
        </div>
        <div className="sm:col-span-2 lg:col-span-3">
          <label className="field-label" htmlFor="asset-notes">
            Notes
          </label>
          <textarea
            id="asset-notes"
            name="notes"
            rows={2}
            className="field-input"
            defaultValue={row?.notes ?? ""}
          />
        </div>
        <div className="flex gap-2 sm:col-span-2 lg:col-span-3">
          <button type="submit" className={btn("gold")} disabled={busy}>
            {busy ? "Saving…" : row ? "Save changes" : "Add asset"}
          </button>
          <button type="button" className={btn("outline")} onClick={onClose}>
            Cancel
          </button>
        </div>
      </form>
    </AdminCard>
  );
}
