import { useServerFn } from "@tanstack/react-start";
import { AlertTriangle, ClipboardCheck, Package, Trash2, X } from "lucide-react";
import { useMemo, useState, type FormEvent } from "react";
import { toast } from "sonner";
import {
  AdminCard,
  AdminNotice,
  Field,
  StatusPill,
  adminInput,
  btn,
  formatDate,
  tzs,
} from "@/components/admin/admin-ui";
import {
  JOB_STARTED_STATUSES,
  JOB_STATUSES,
  JOB_STATUS_LABELS,
  QC_RESULTS,
  jobStatusTone,
  qcTone,
  type JobStatus,
} from "@/lib/ops/business";
import {
  addQualityCheck,
  consumeMaterial,
  createJob,
  deleteJob,
  listJobs,
  listProductionOptions,
  setActualCosts,
  setJobStatus,
  updateJob,
} from "@/lib/ops/production.functions";
import { humanize } from "@/lib/ops/status";
import { cn } from "@/lib/utils";

type JobsData = Awaited<ReturnType<typeof listJobs>>;
export type Job = Extract<JobsData, { available: true }>["jobs"][number];
export type ProductionOptions = Awaited<ReturnType<typeof listProductionOptions>>;

export type JobPrefill = { orderId?: string | undefined; itemId?: string | undefined };

function num(v: FormDataEntryValue | null) {
  const n = Number(v ?? 0);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

/** Create a job (standalone or for an order line) or edit an existing one. */
export function JobForm({
  job,
  options,
  prefill,
  onClose,
  onSaved,
}: {
  job: Job | null;
  options: ProductionOptions;
  prefill?: JobPrefill | undefined;
  onClose: () => void;
  onSaved: (id?: string) => Promise<void>;
}) {
  const create = useServerFn(createJob);
  const update = useServerFn(updateJob);
  const prefillOrder = options.orders.find((o) => o.id === prefill?.orderId);
  const prefillLine = prefillOrder?.items.find((i) => i.id === prefill?.itemId) ?? (prefill?.itemId ? undefined : prefillOrder?.items[0]);
  const [source, setSource] = useState<"order" | "standalone">(job ? (job.order_id ? "order" : "standalone") : prefillOrder ? "order" : "standalone");
  const [orderId, setOrderId] = useState(job?.order_id ?? prefillOrder?.id ?? "");
  const [lineId, setLineId] = useState(job?.order_item_id ?? prefillLine?.id ?? "");
  const [route, setRoute] = useState<"in_house" | "partner">((job?.route as "in_house" | "partner" | undefined) ?? "in_house");
  const [description, setDescription] = useState(
    job?.description ??
      (prefillLine ? [prefillLine.product_name, prefillLine.material, prefillLine.size, prefillLine.color].filter(Boolean).join(" · ") : ""),
  );
  const [quantity, setQuantity] = useState(String(job?.quantity ?? prefillLine?.quantity ?? 1));
  const [productId, setProductId] = useState(job?.product_id ?? prefillLine?.product_id ?? "");
  const [busy, setBusy] = useState(false);
  const order = options.orders.find((o) => o.id === orderId);

  function pickLine(id: string) {
    setLineId(id);
    const line = order?.items.find((i) => i.id === id);
    if (!line) return;
    setDescription([line.product_name, line.material, line.size, line.color].filter(Boolean).join(" · "));
    setQuantity(String(line.quantity));
    setProductId(line.product_id ?? "");
  }

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const est = (k: string) => {
      const raw = String(fd.get(k) ?? "").trim();
      return raw ? Math.max(0, Number(raw) || 0) : undefined;
    };
    const fields = {
      description: description.trim(),
      quantity: Math.max(1, Math.round(Number(quantity) || 1)),
      route,
      assignee: String(fd.get("assignee") ?? ""),
      supplier_id: route === "partner" ? String(fd.get("supplier_id") ?? "") || null : null,
      target_date: String(fd.get("target_date") ?? ""),
      notes: String(fd.get("notes") ?? ""),
      ...(est("est_material_cost") != null ? { est_material_cost: est("est_material_cost") } : {}),
      ...(est("est_labour_cost") != null ? { est_labour_cost: est("est_labour_cost") } : {}),
      ...(est("est_overhead_cost") != null ? { est_overhead_cost: est("est_overhead_cost") } : {}),
    };
    if (route === "partner" && !fields.supplier_id) {
      toast.error("Choose the partner supplier");
      return;
    }
    setBusy(true);
    try {
      if (job) {
        await update({ data: { id: job.id, ...fields } });
        toast.success("Job updated");
        onClose();
        await onSaved(job.id);
      } else {
        const r = await create({
          data: {
            ...fields,
            ...(source === "order" && orderId ? { order_id: orderId } : {}),
            ...(source === "order" && lineId ? { order_item_id: lineId } : {}),
            ...(productId ? { product_id: productId } : {}),
          },
        });
        toast.success(`Job ${r.job_number} created`);
        onClose();
        await onSaved(r.id);
      }
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
          <h2 className="text-base font-semibold text-navy">{job ? `Edit ${job.job_number}` : "New production job"}</h2>
          <button type="button" className={btn("ghost", "sm")} onClick={onClose} aria-label="Close form">
            <X className="h-4 w-4" />
          </button>
        </div>

        {!job && (
          <div className="flex flex-wrap gap-2 sm:col-span-2 lg:col-span-3">
            {(["order", "standalone"] as const).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setSource(s)}
                className={cn(
                  "h-9 rounded-lg px-3 text-sm font-semibold",
                  source === s ? "bg-navy text-white" : "border border-[#E5E5E5] bg-white text-[#374151]",
                )}
              >
                {s === "order" ? "For a customer order" : "Standalone (stock or sample)"}
              </button>
            ))}
          </div>
        )}

        {source === "order" && !job && (
          <>
            <div>
              <label className="field-label">Order</label>
              <select
                className="field-input"
                value={orderId}
                onChange={(e) => {
                  setOrderId(e.target.value);
                  setLineId("");
                }}
              >
                <option value="">Choose an order…</option>
                {options.orders.map((o) => (
                  <option key={o.id} value={o.id}>
                    #{o.order_number} · {o.customer_name}
                  </option>
                ))}
              </select>
            </div>
            <div className="lg:col-span-2">
              <label className="field-label">Order line</label>
              <select className="field-input" value={lineId} onChange={(e) => pickLine(e.target.value)} disabled={!order}>
                <option value="">{order ? "Choose a line…" : "Choose an order first"}</option>
                {order?.items.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.quantity}× {i.product_name}
                    {i.size ? ` · ${i.size}` : ""}
                  </option>
                ))}
              </select>
            </div>
          </>
        )}
        {job?.order_number && (
          <p className="text-sm text-[#374151] sm:col-span-2 lg:col-span-3">
            For order <span className="font-semibold text-navy">#{job.order_number}</span> · {job.customer_name}
          </p>
        )}

        <div className="sm:col-span-2">
          <label className="field-label">What to make *</label>
          <input className="field-input" required value={description} onChange={(e) => setDescription(e.target.value)} />
        </div>
        <div>
          <label className="field-label">Quantity *</label>
          <input type="number" min={1} className="field-input" value={quantity} onChange={(e) => setQuantity(e.target.value)} />
        </div>
        {source === "standalone" && (
          <div>
            <label className="field-label">Shop product</label>
            <select className="field-input" value={productId} onChange={(e) => setProductId(e.target.value)}>
              <option value="">None</option>
              {options.products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
        )}
        <div>
          <label className="field-label">Made by</label>
          <select className="field-input" value={route} onChange={(e) => setRoute(e.target.value as "in_house" | "partner")}>
            <option value="in_house">Our workshop</option>
            <option value="partner">Partner maker</option>
          </select>
        </div>
        {route === "partner" ? (
          <div>
            <label className="field-label">Partner supplier *</label>
            <select name="supplier_id" className="field-input" defaultValue={job?.supplier_id ?? ""}>
              <option value="">{options.suppliers.length ? "Choose…" : "No suppliers yet — add one under Suppliers"}</option>
              {options.suppliers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
        ) : (
          <div>
            <label className="field-label">Assigned to</label>
            <input name="assignee" className="field-input" defaultValue={job?.assignee ?? ""} placeholder="Carpenter or team" />
          </div>
        )}
        <div>
          <label className="field-label">Target date</label>
          <input name="target_date" type="date" className="field-input" defaultValue={job?.target_date ?? ""} />
        </div>
        <div>
          <label className="field-label">Est. materials (TSh)</label>
          <input name="est_material_cost" type="number" min={0} step="any" className="field-input" defaultValue={job ? job.est_material_cost : ""} placeholder={job ? undefined : "From product costs"} />
        </div>
        <div>
          <label className="field-label">Est. labour (TSh)</label>
          <input name="est_labour_cost" type="number" min={0} step="any" className="field-input" defaultValue={job ? job.est_labour_cost : ""} placeholder={job ? undefined : "From product costs"} />
        </div>
        <div>
          <label className="field-label">Est. overhead (TSh)</label>
          <input name="est_overhead_cost" type="number" min={0} step="any" className="field-input" defaultValue={job ? job.est_overhead_cost : ""} placeholder={job ? undefined : "From product costs"} />
        </div>
        {!job && (
          <p className="text-xs text-[#6B7280] sm:col-span-2 lg:col-span-3">
            Leave the estimates empty to fill them from the product&apos;s costs (Inventory → Product costs) × quantity.
          </p>
        )}
        <div className="sm:col-span-2 lg:col-span-3">
          <label className="field-label">Notes</label>
          <textarea name="notes" rows={2} className="field-input" defaultValue={job?.notes ?? ""} />
        </div>
        <div className="flex gap-2 sm:col-span-2 lg:col-span-3">
          <button type="submit" className={btn("gold")} disabled={busy || !description.trim() || (source === "order" && !job && !orderId)}>
            {busy ? "Saving…" : job ? "Save job" : "Create job"}
          </button>
          <button type="button" className={btn("outline")} onClick={onClose}>
            Cancel
          </button>
        </div>
      </form>
    </AdminCard>
  );
}

function variance(est: number, act: number) {
  if (!act) return <span className="text-[#9CA3AF]">—</span>;
  const diff = act - est;
  return (
    <span className={cn("font-medium", diff > 0 ? "text-[#DC2626]" : "text-[#15803D]")}>
      {diff > 0 ? "+" : ""}
      {tzs(diff)}
    </span>
  );
}

/** Status, materials, costs and quality checks for one job. */
export function JobDetail({
  job,
  options,
  onChanged,
  onEdit,
  onDeleted,
}: {
  job: Job;
  options: ProductionOptions;
  onChanged: () => Promise<void>;
  onEdit: () => void;
  onDeleted: () => void;
}) {
  const changeStatus = useServerFn(setJobStatus);
  const consume = useServerFn(consumeMaterial);
  const saveCosts = useServerFn(setActualCosts);
  const addCheck = useServerFn(addQualityCheck);
  const remove = useServerFn(deleteJob);
  const [busy, setBusy] = useState<string | null>(null);
  const [nextStatus, setNextStatus] = useState<JobStatus>(job.status as JobStatus);
  const [exception, setException] = useState("");
  const [needsException, setNeedsException] = useState(false);
  const [completedQty, setCompletedQty] = useState(String(job.completed_qty || job.quantity));
  const [finishedItem, setFinishedItem] = useState("");
  const [materialId, setMaterialId] = useState("");
  const [materialQty, setMaterialQty] = useState("");
  const [labour, setLabour] = useState(String(job.act_labour_cost || ""));
  const [overhead, setOverhead] = useState(String(job.act_overhead_cost || ""));
  const [qcResult, setQcResult] = useState<(typeof QC_RESULTS)[number]>("pass");
  const [qcNotes, setQcNotes] = useState("");
  const finishedItems = useMemo(() => options.items.filter((i) => i.kind === "finished"), [options.items]);
  const consumable = useMemo(() => options.items.filter((i) => i.kind !== "finished" && i.kind !== "damaged"), [options.items]);
  const selectedMaterial = consumable.find((i) => i.id === materialId);
  const done = job.status === "completed";

  async function run(key: string, task: () => Promise<unknown>, success: string) {
    setBusy(key);
    try {
      await task();
      toast.success(success);
      await onChanged();
      return true;
    } catch (e) {
      const message = e instanceof Error ? e.message : "That did not work";
      if (key === "status" && /exception reason/i.test(message)) setNeedsException(true);
      toast.error(message, { duration: 9000 });
      return false;
    } finally {
      setBusy(null);
    }
  }

  async function applyStatus() {
    const ok = await run(
      "status",
      () =>
        changeStatus({
          data: {
            id: job.id,
            status: nextStatus,
            ...(exception.trim() ? { exception_reason: exception.trim() } : {}),
            ...(nextStatus === "completed"
              ? { completed_qty: Math.max(0, Math.round(Number(completedQty) || 0)), ...(finishedItem ? { finished_item_id: finishedItem } : {}) }
              : {}),
          },
        }),
      `Job moved to ${JOB_STATUS_LABELS[nextStatus]}`,
    );
    if (ok) {
      setNeedsException(false);
      setException("");
    }
  }

  const est = { m: job.est_material_cost, l: job.est_labour_cost, o: job.est_overhead_cost };
  const act = { m: job.act_material_cost, l: job.act_labour_cost, o: job.act_overhead_cost };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 rounded-xl border border-[#E5E5E5] bg-white p-4 sm:grid-cols-3">
        <Field label="Quantity">
          {job.quantity}
          {job.completed_qty ? ` · ${job.completed_qty} done` : ""}
        </Field>
        <Field label="Made by">{job.route === "partner" ? `Partner: ${job.supplier_name ?? "—"}` : (job.assignee ?? "Workshop")}</Field>
        <Field label="Target date">
          <span className={job.overdue ? "font-semibold text-[#DC2626]" : undefined}>{job.target_date ? formatDate(job.target_date) : "—"}</span>
        </Field>
        {job.order_number && (
          <Field label="Order" className="col-span-2 sm:col-span-3">
            #{job.order_number} · {job.customer_name}
            {job.order_status ? ` · ${humanize(job.order_status)}` : ""}
          </Field>
        )}
        {job.started_at && <Field label="Started">{formatDate(job.started_at, true)}</Field>}
        {job.completed_at && <Field label="Completed">{formatDate(job.completed_at, true)}</Field>}
        {job.exception_reason && (
          <Field label="Production exception" className="col-span-2 sm:col-span-3">
            <span className="text-[#C2410C]">{job.exception_reason}</span>
          </Field>
        )}
      </div>

      {!done && (
        <div className="space-y-3 rounded-xl border border-[#E5E5E5] bg-white p-4">
          <p className="text-sm font-semibold text-navy">Status</p>
          <div className="flex flex-wrap gap-1.5" aria-label="Job progress">
            {JOB_STATUSES.filter((s) => s !== "on_hold").map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setNextStatus(s)}
                className={cn(
                  "rounded-full px-2.5 py-1 text-xs font-semibold",
                  s === nextStatus ? "bg-navy text-white" : s === job.status ? "bg-gold-soft text-[#B86A00]" : "bg-[#F3F4F6] text-[#374151]",
                )}
              >
                {JOB_STATUS_LABELS[s]}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setNextStatus("on_hold")}
              className={cn("rounded-full px-2.5 py-1 text-xs font-semibold", nextStatus === "on_hold" ? "bg-[#DC2626] text-white" : "bg-[#FEE2E2] text-[#DC2626]")}
            >
              On hold
            </button>
          </div>
          {nextStatus === "completed" && (
            <div className="grid gap-2 sm:grid-cols-2">
              <label className="block">
                <span className="mb-1 block text-xs font-semibold text-[#374151]">Completed quantity</span>
                <input type="number" min={0} className={adminInput} value={completedQty} onChange={(e) => setCompletedQty(e.target.value)} />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-semibold text-[#374151]">Add to finished stock</span>
                <select className={adminInput} value={finishedItem} onChange={(e) => setFinishedItem(e.target.value)}>
                  <option value="">{job.product_id ? "Product's finished item (if any)" : "Do not add to stock"}</option>
                  {finishedItems.map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.name}
                    </option>
                  ))}
                </select>
              </label>
              {job.order_id && <p className="text-xs text-[#6B7280] sm:col-span-2">Pieces made for a customer order usually go straight to delivery; leave stock empty.</p>}
            </div>
          )}
          {needsException && JOB_STARTED_STATUSES.includes(nextStatus) && (
            <div className="space-y-2">
              <AdminNotice tone="pending">
                <span className="flex items-start gap-2">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  The order has not met the production policy (advance paid and specifications agreed). Record why work is starting anyway; it
                  is saved on the job and in the audit log.
                </span>
              </AdminNotice>
              <input className={adminInput} value={exception} onChange={(e) => setException(e.target.value)} placeholder="Exception reason (at least 5 characters)" />
            </div>
          )}
          <button type="button" className={btn("navy")} disabled={busy !== null || nextStatus === job.status} onClick={() => void applyStatus()}>
            {busy === "status" ? "Saving…" : needsException ? "Start with exception" : `Move to ${JOB_STATUS_LABELS[nextStatus]}`}
          </button>
        </div>
      )}

      <div className="rounded-xl border border-[#E5E5E5] bg-white">
        <p className="flex items-center gap-2 border-b border-[#F0F0F0] px-4 py-3 text-sm font-semibold text-navy">
          <Package className="h-4 w-4 text-[#6B7280]" /> Materials used
        </p>
        {job.materials.length ? (
          <ul className="divide-y divide-[#F0F0F0]">
            {job.materials.map((m) => (
              <li key={m.id} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
                <span className="min-w-0">
                  <span className="font-medium text-navy">{m.item_name}</span>
                  <span className="block text-xs text-[#6B7280]">
                    {m.quantity} {m.item_unit} × {tzs(m.unit_cost)} · {formatDate(m.created_at)}
                  </span>
                </span>
                <span className="font-medium text-navy">{tzs(m.quantity * m.unit_cost)}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="px-4 py-3 text-sm text-[#6B7280]">No materials recorded yet.</p>
        )}
        {!done && (
          <div className="flex flex-wrap items-end gap-2 border-t border-[#F0F0F0] p-4">
            <label className="min-w-0 flex-1">
              <span className="mb-1 block text-xs font-semibold text-[#374151]">Stock item</span>
              <select className={adminInput} value={materialId} onChange={(e) => setMaterialId(e.target.value)}>
                <option value="">{consumable.length ? "Choose…" : "No stock items — add them under Inventory"}</option>
                {consumable.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.name} ({i.quantity} {i.unit} left)
                  </option>
                ))}
              </select>
            </label>
            <label className="w-28">
              <span className="mb-1 block text-xs font-semibold text-[#374151]">Quantity{selectedMaterial ? ` (${selectedMaterial.unit})` : ""}</span>
              <input type="number" min={0} step="any" className={adminInput} value={materialQty} onChange={(e) => setMaterialQty(e.target.value)} />
            </label>
            <button
              type="button"
              className={btn("outline")}
              disabled={busy !== null || !materialId || !(Number(materialQty) > 0)}
              onClick={async () => {
                const ok = await run(
                  "material",
                  () => consume({ data: { jobId: job.id, inventoryItemId: materialId, quantity: Number(materialQty) } }),
                  "Material taken from stock",
                );
                if (ok) setMaterialQty("");
              }}
            >
              {busy === "material" ? "Saving…" : "Use material"}
            </button>
          </div>
        )}
      </div>

      <div className="rounded-xl border border-[#E5E5E5] bg-white">
        <p className="border-b border-[#F0F0F0] px-4 py-3 text-sm font-semibold text-navy">Cost: estimate vs actual</p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-xs text-[#6B7280]">
              <tr>
                <th className="px-4 py-2 text-left font-semibold">Cost</th>
                <th className="px-4 py-2 text-right font-semibold">Estimate</th>
                <th className="px-4 py-2 text-right font-semibold">Actual</th>
                <th className="px-4 py-2 text-right font-semibold">Variance</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F0F0F0]">
              {(
                [
                  ["Materials", est.m, act.m],
                  ["Labour", est.l, act.l],
                  ["Overhead", est.o, act.o],
                ] as const
              ).map(([label, e, a]) => (
                <tr key={label}>
                  <td className="px-4 py-2 text-[#374151]">{label}</td>
                  <td className="px-4 py-2 text-right">{tzs(e)}</td>
                  <td className="px-4 py-2 text-right">{tzs(a)}</td>
                  <td className="px-4 py-2 text-right">{variance(e, a)}</td>
                </tr>
              ))}
              <tr className="font-semibold text-navy">
                <td className="px-4 py-2">Total</td>
                <td className="px-4 py-2 text-right">{tzs(job.est_total)}</td>
                <td className="px-4 py-2 text-right">{tzs(job.act_total)}</td>
                <td className="px-4 py-2 text-right">{variance(job.est_total, job.act_total)}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <div className="flex flex-wrap items-end gap-2 border-t border-[#F0F0F0] p-4">
          <label className="w-36">
            <span className="mb-1 block text-xs font-semibold text-[#374151]">Actual labour (TSh)</span>
            <input type="number" min={0} step="any" className={adminInput} value={labour} onChange={(e) => setLabour(e.target.value)} />
          </label>
          <label className="w-36">
            <span className="mb-1 block text-xs font-semibold text-[#374151]">Actual overhead (TSh)</span>
            <input type="number" min={0} step="any" className={adminInput} value={overhead} onChange={(e) => setOverhead(e.target.value)} />
          </label>
          <button
            type="button"
            className={btn("outline")}
            disabled={busy !== null}
            onClick={() =>
              void run(
                "costs",
                () =>
                  saveCosts({
                    data: { id: job.id, act_labour_cost: Math.max(0, Number(labour) || 0), act_overhead_cost: Math.max(0, Number(overhead) || 0) },
                  }),
                "Actual costs saved",
              )
            }
          >
            Save costs
          </button>
          <p className="w-full text-xs text-[#6B7280]">Actual materials come from the materials used above.</p>
        </div>
      </div>

      <div className="rounded-xl border border-[#E5E5E5] bg-white">
        <p className="flex items-center gap-2 border-b border-[#F0F0F0] px-4 py-3 text-sm font-semibold text-navy">
          <ClipboardCheck className="h-4 w-4 text-[#6B7280]" /> Quality checks
        </p>
        {job.checks.length ? (
          <ul className="divide-y divide-[#F0F0F0]">
            {job.checks.map((c) => (
              <li key={c.id} className="px-4 py-2.5 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <StatusPill tone={qcTone(c.result)}>{humanize(c.result)}</StatusPill>
                  <span className="text-xs text-[#6B7280]">
                    {formatDate(c.checked_at, true)}
                    {c.checked_by ? ` · ${c.checked_by}` : ""}
                  </span>
                </div>
                {c.notes && <p className="mt-1 text-[#374151]">{c.notes}</p>}
              </li>
            ))}
          </ul>
        ) : (
          <p className="px-4 py-3 text-sm text-[#6B7280]">No checks yet.</p>
        )}
        <div className="space-y-2 border-t border-[#F0F0F0] p-4">
          <div className="flex flex-wrap gap-2">
            <select className={cn(adminInput, "w-36")} value={qcResult} onChange={(e) => setQcResult(e.target.value as typeof qcResult)} aria-label="Result">
              {QC_RESULTS.map((r) => (
                <option key={r} value={r}>
                  {humanize(r)}
                </option>
              ))}
            </select>
            <input className={cn(adminInput, "min-w-0 flex-1")} value={qcNotes} onChange={(e) => setQcNotes(e.target.value)} placeholder={qcResult === "pass" ? "Notes (optional)" : "What needs fixing *"} />
            <button
              type="button"
              className={btn("outline")}
              disabled={busy !== null}
              onClick={async () => {
                const ok = await run("qc", () => addCheck({ data: { job_id: job.id, result: qcResult, notes: qcNotes } }), "Quality check recorded");
                if (ok) setQcNotes("");
              }}
            >
              Record check
            </button>
          </div>
          <p className="text-xs text-[#6B7280]">Rework sends the job back to finishing; a fail puts it on hold.</p>
        </div>
      </div>

      {job.notes && (
        <div className="rounded-xl border border-[#E5E5E5] bg-white p-4">
          <Field label="Notes">
            <p className="whitespace-pre-line text-[#374151]">{job.notes}</p>
          </Field>
        </div>
      )}

      <div className="flex flex-wrap justify-end gap-2 border-t border-[#E5E5E5] pt-4">
        <button type="button" className={btn("outline")} onClick={onEdit}>
          Edit job
        </button>
        {job.status === "queued" && !job.materials.length && (
          <button
            type="button"
            className={btn("danger")}
            disabled={busy !== null}
            onClick={async () => {
              if (!confirm(`Delete ${job.job_number}?`)) return;
              const ok = await run("delete", () => remove({ data: { id: job.id } }), "Job deleted");
              if (ok) onDeleted();
            }}
          >
            <Trash2 className="h-4 w-4" /> Delete
          </button>
        )}
      </div>
    </div>
  );
}

export function JobStatusPill({ job }: { job: Pick<Job, "status" | "overdue"> }) {
  return (
    <span className="inline-flex flex-wrap gap-1">
      <StatusPill tone={jobStatusTone(job.status)}>{JOB_STATUS_LABELS[job.status as JobStatus] ?? humanize(job.status)}</StatusPill>
      {job.overdue && <StatusPill tone="danger">Overdue</StatusPill>}
    </span>
  );
}
