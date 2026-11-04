import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { AlertTriangle, Clock3, Factory, Plus, Wallet } from "lucide-react";
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
  StatusTabs,
  btn,
  formatDate,
  tzs,
  type Column,
} from "@/components/admin/admin-ui";
import {
  JobDetail,
  JobForm,
  JobStatusPill,
  type Job,
  type JobPrefill,
  type ProductionOptions,
} from "@/components/admin/production/ProductionParts";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { JOB_STATUSES, JOB_STATUS_LABELS } from "@/lib/ops/business";
import { listJobs, listProductionOptions } from "@/lib/ops/production.functions";

type Search = { new?: "1"; order?: string; item?: string; job?: string };

export const Route = createFileRoute("/admin/production")({
  validateSearch: (s: Record<string, unknown>): Search => {
    const out: Search = {};
    if (s["new"] === "1" || s["new"] === 1) out.new = "1";
    if (typeof s["order"] === "string" && /^[0-9a-f-]{36}$/i.test(s["order"])) out.order = s["order"];
    if (typeof s["item"] === "string" && /^[0-9a-f-]{36}$/i.test(s["item"])) out.item = s["item"];
    if (typeof s["job"] === "string" && /^[0-9a-f-]{36}$/i.test(s["job"])) out.job = s["job"];
    return out;
  },
  head: () => ({ meta: [{ title: "Production — Admin" }, { name: "robots", content: "noindex" }] }),
  component: AdminProductionPage,
});

type Tab = "active" | "overdue" | "all" | (typeof JOB_STATUSES)[number];
type Data = Awaited<ReturnType<typeof listJobs>>;

function AdminProductionPage() {
  const search = Route.useSearch();
  const navigate = useNavigate({ from: "/admin/production" });
  const load = useServerFn(listJobs);
  const loadOptions = useServerFn(listProductionOptions);
  const [data, setData] = useState<Data | null>(null);
  const [options, setOptions] = useState<ProductionOptions | null>(null);
  const [tab, setTab] = useState<Tab>("active");
  const [q, setQ] = useState("");
  const [form, setForm] = useState<{ job: Job | null; prefill?: JobPrefill } | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);

  async function refresh() {
    const [jobs, opts] = await Promise.all([load(), loadOptions()]);
    setData(jobs);
    setOptions(opts);
  }

  useEffect(() => {
    refresh().catch((e) => toast.error(e instanceof Error ? e.message : "Load failed"));
  }, []);

  // ?new=1&order=…&item=… (from an order) opens the create form prefilled with that order line.
  useEffect(() => {
    if (search.new !== "1" || !options) return;
    setForm({ job: null, prefill: { orderId: search.order, itemId: search.item } });
    void navigate({ search: {}, replace: true });
  }, [search.new, options]);

  // ?job=… (from an order's linked jobs) opens that job.
  useEffect(() => {
    if (!search.job || !data?.available) return;
    if (data.jobs.some((j) => j.id === search.job)) {
      setTab("all");
      setOpenId(search.job);
    }
    void navigate({ search: {}, replace: true });
  }, [search.job, data]);

  const jobs = data?.available ? data.jobs : [];
  const searched = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return jobs;
    return jobs.filter((j) =>
      [j.job_number, j.description, j.order_number, j.customer_name, j.assignee, j.supplier_name, j.product_name].some((v) =>
        v?.toLowerCase().includes(term),
      ),
    );
  }, [jobs, q]);

  const activeJobs = searched.filter((j) => j.status !== "completed");
  const tabs: { id: Tab; label: string; count: number }[] = [
    { id: "active", label: "Active", count: activeJobs.length },
    { id: "overdue", label: "Overdue", count: searched.filter((j) => j.overdue).length },
    ...JOB_STATUSES.map((s) => ({ id: s, label: JOB_STATUS_LABELS[s], count: searched.filter((j) => j.status === s).length })),
    { id: "all", label: "All", count: searched.length },
  ];
  const shown =
    tab === "all"
      ? searched
      : tab === "active"
        ? activeJobs
        : tab === "overdue"
          ? searched.filter((j) => j.overdue)
          : searched.filter((j) => j.status === tab);
  const open = jobs.find((j) => j.id === openId) ?? null;
  const overdueCount = jobs.filter((j) => j.overdue).length;
  const wip = jobs.filter((j) => j.status !== "completed").reduce((s, j) => s + j.act_total, 0);

  const columns: Column<Job>[] = [
    {
      key: "job",
      header: "Job",
      cell: (j) => (
        <div className="min-w-0">
          <p className="font-semibold text-navy">{j.job_number}</p>
          <p className="truncate text-xs text-[#6B7280]">
            {j.quantity}× {j.description}
          </p>
        </div>
      ),
    },
    {
      key: "for",
      header: "For",
      cell: (j) =>
        j.order_number ? (
          <div className="min-w-0">
            <p className="font-medium text-navy">#{j.order_number}</p>
            <p className="truncate text-xs text-[#6B7280]">{j.customer_name}</p>
          </div>
        ) : (
          <span className="text-xs text-[#6B7280]">Stock / standalone</span>
        ),
    },
    {
      key: "who",
      header: "Made by",
      className: "hidden lg:table-cell",
      cell: (j) => <span className="text-[#374151]">{j.route === "partner" ? (j.supplier_name ?? "Partner") : (j.assignee ?? "Workshop")}</span>,
    },
    {
      key: "target",
      header: "Target",
      cell: (j) => <span className={j.overdue ? "font-semibold text-[#DC2626]" : "text-[#374151]"}>{j.target_date ? formatDate(j.target_date) : "—"}</span>,
    },
    { key: "cost", header: "Actual cost", align: "right", className: "hidden xl:table-cell", cell: (j) => tzs(j.act_total) },
    { key: "status", header: "Status", cell: (j) => <JobStatusPill job={j} /> },
  ];

  if (data && !data.available) {
    return (
      <div>
        <AdminPageHeader title="Production" description="Workshop and partner jobs." />
        <MigrationNeeded reason={data.reason} />
      </div>
    );
  }

  return (
    <div>
      <AdminPageHeader
        title="Production"
        description="Workshop and partner jobs from queue to quality check. Work on a customer order starts only after the advance and agreed specifications."
        action={
          <button type="button" className={btn("gold")} onClick={() => setForm({ job: null })} disabled={!options}>
            <Plus className="h-4 w-4" /> New job
          </button>
        }
      />

      {data?.available && (
        <div className="mb-4 grid gap-3 sm:grid-cols-3">
          <KpiCard label="Active jobs" value={jobs.filter((j) => j.status !== "completed").length} icon={<Factory className="h-5 w-5" />} tone="navy" />
          <KpiCard
            label="Overdue"
            value={overdueCount}
            icon={overdueCount ? <AlertTriangle className="h-5 w-5" /> : <Clock3 className="h-5 w-5" />}
            tone={overdueCount ? "danger" : "success"}
            hint={overdueCount ? "Past the target date" : "Everything on time"}
          />
          <KpiCard label="Cost in progress" value={tzs(wip)} icon={<Wallet className="h-5 w-5" />} tone="gold" hint="Actual cost of open jobs" />
        </div>
      )}

      {form && options && (
        <JobForm
          key={form.job?.id ?? `new-${form.prefill?.itemId ?? ""}`}
          job={form.job}
          options={options}
          prefill={form.prefill}
          onClose={() => setForm(null)}
          onSaved={async (id) => {
            await refresh();
            if (id) setOpenId(id);
          }}
        />
      )}

      <div className="mb-4 space-y-3">
        <StatusTabs tabs={tabs} value={tab} onChange={setTab} />
        <SearchInput value={q} onChange={setQ} placeholder="Search job, order, customer or maker" className="max-w-md" />
      </div>

      {!data ? (
        <AdminLoading label="Loading jobs…" />
      ) : (
        <DataTable
          rows={shown}
          columns={columns}
          rowKey={(j) => j.id}
          onRowClick={(j) => setOpenId(j.id)}
          empty={
            <AdminEmpty title={jobs.length ? "No jobs here" : "No production jobs yet"}>
              {jobs.length ? "Try another tab or search." : "Create a job for an order line, or a standalone job for stock."}
            </AdminEmpty>
          }
          mobileCard={(j) => (
            <div>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-semibold text-navy">{j.job_number}</p>
                  <p className="truncate text-xs text-[#6B7280]">
                    {j.quantity}× {j.description}
                  </p>
                </div>
                <JobStatusPill job={j} />
              </div>
              <p className="mt-2 text-xs text-[#6B7280]">
                {j.order_number ? `#${j.order_number} · ${j.customer_name}` : "Stock / standalone"}
                {j.target_date ? ` · due ${formatDate(j.target_date)}` : ""}
              </p>
            </div>
          )}
        />
      )}

      <Sheet open={Boolean(open)} onOpenChange={(v) => !v && setOpenId(null)}>
        <SheetContent side="right" className="w-full overflow-y-auto bg-[#F5F6F8] p-0 sm:max-w-2xl">
          {open && options && (
            <div>
              <div className="sticky top-0 z-10 border-b border-[#E5E5E5] bg-white px-5 py-4 pr-12">
                <SheetTitle className="text-lg font-bold text-navy">{open.job_number}</SheetTitle>
                <SheetDescription className="text-xs text-[#6B7280]">
                  {open.quantity}× {open.description}
                </SheetDescription>
                <div className="mt-2">
                  <JobStatusPill job={open} />
                </div>
              </div>
              <div className="p-4 md:p-5">
                <JobDetail
                  key={`${open.id}-${open.status}`}
                  job={open}
                  options={options}
                  onChanged={refresh}
                  onEdit={() => {
                    setForm({ job: open });
                    setOpenId(null);
                    window.scrollTo({ top: 0, behavior: "smooth" });
                  }}
                  onDeleted={() => setOpenId(null)}
                />
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
