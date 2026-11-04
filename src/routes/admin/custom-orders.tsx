import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Download, ImageIcon, Phone, Plus, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  AdminCard,
  AdminEmpty,
  AdminLoading,
  AdminPageHeader,
  SearchInput,
  StatusPill,
  StatusTabs,
  btn,
  formatDate,
  type PillTone,
} from "@/components/admin/admin-ui";
import { formatPrice } from "@/config/site";
import { QUOTE_VALID_DAYS, quoteDateAfter, type QuoteStatus } from "@/lib/custom-quotes";
import { deleteAdminCustomOrder, listAdminCustomOrders, saveCustomOrderQuote, updateCustomOrderStatus } from "@/lib/admin.functions";
import { colorSwatch } from "@/lib/color-swatches";
import { downloadToDevice, photoFileName } from "@/lib/download-file";
import { downloadQuote } from "@/lib/invoice";
import { CUSTOM_STATUSES, customStatusLabel, customStatusTone, humanize } from "@/lib/ops/status";
import { parseCatalogColor, unpackPreference } from "@/lib/order-options";

export const Route = createFileRoute("/admin/custom-orders")({
  validateSearch: (s: Record<string, unknown>): { q?: string } =>
    typeof s["q"] === "string" && s["q"].trim() ? { q: s["q"].trim().slice(0, 80) } : {},
  head: () => ({ meta: [{ title: "Custom requests — Admin" }, { name: "robots", content: "noindex" }] }),
  component: AdminCustomOrdersPage,
});

type Row = Awaited<ReturnType<typeof listAdminCustomOrders>>[number];

const STATUSES = CUSTOM_STATUSES;

const QUOTE_TONES: Record<QuoteStatus, PillTone> = {
  draft: "neutral",
  sent: "info",
  accepted: "success",
  rejected: "danger",
  changes_requested: "pending",
  expired: "neutral",
  superseded: "neutral",
};

function PreferenceBlock({ label, stored, swatches = false }: { label: string; stored: string | null; swatches?: boolean }) {
  const { selected, note } = unpackPreference(stored);
  if (!selected.length && !note) return null;
  return (
    <div>
      <p className="text-[0.7rem] font-semibold uppercase tracking-wide text-[#6B7280]">{label}</p>
      {selected.length > 0 && (
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {selected.map((item) => {
            if (!swatches) {
              return (
                <span key={item} className="rounded-full border border-border bg-sand/70 px-2.5 py-1 text-xs font-semibold text-navy">
                  {item}
                </span>
              );
            }
            const color = parseCatalogColor(item);
            return (
              <span key={item} className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background py-1 pl-1 pr-2.5 text-xs font-semibold text-navy">
                <span
                  className="h-4 w-4 rounded-full shadow-[inset_0_0_0_1px_color-mix(in_oklab,black_12%,transparent)]"
                  style={{
                    background: color.hex ?? undefined,
                    backgroundImage: color.hex ? undefined : `url("${colorSwatch(color.label)}")`,
                  }}
                />
                {color.label}
              </span>
            );
          })}
        </div>
      )}
      {note && <p className="mt-1.5 text-sm text-navy">“{note}”</p>}
    </div>
  );
}

function QuotePanel({ order, onSaved }: { order: Row; onSaved: () => Promise<void> }) {
  const save = useServerFn(saveCustomOrderQuote);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notes, setNotes] = useState("");
  const [advancePercent, setAdvancePercent] = useState("");
  const [validUntil, setValidUntil] = useState(() => quoteDateAfter(QUOTE_VALID_DAYS));
  const [inclusions, setInclusions] = useState("");
  const [exclusions, setExclusions] = useState("");
  const [estimatedCompletion, setEstimatedCompletion] = useState("");
  const [lines, setLines] = useState([{ description: order.furniture_type, quantity: String(order.quantity), unitPrice: "" }]);
  const quotes = [...order.quotes].reverse();

  function updateLine(index: number, patch: Partial<(typeof lines)[number]>) {
    setLines((current) => current.map((line, i) => (i === index ? { ...line, ...patch } : line)));
  }

  async function onSave() {
    const parsed = lines.map((line) => ({
      description: line.description.trim(),
      quantity: Math.round(Number(line.quantity)),
      unitPrice: Number(line.unitPrice),
    }));
    if (parsed.some((line) => !line.description || line.quantity < 1 || !Number.isFinite(line.unitPrice) || line.unitPrice < 0)) {
      toast.error("Each line needs a description, quantity and price");
      return;
    }
    setBusy(true);
    try {
      const percent = Math.round(Number(advancePercent));
      const quote = await save({
        data: {
          id: order.id,
          notes,
          valid_until: validUntil,
          lines: parsed,
          inclusions,
          exclusions,
          estimated_completion: estimatedCompletion,
          ...(advancePercent.trim() && percent >= 10 && percent <= 100 ? { advance_percent: percent } : {}),
        },
      });
      downloadQuote(quote);
      toast.success(`Quote ${quote.number} saved`);
      setOpen(false);
      setNotes("");
      setInclusions("");
      setExclusions("");
      setEstimatedCompletion("");
      setAdvancePercent("");
      setValidUntil(quoteDateAfter(QUOTE_VALID_DAYS));
      await onSaved();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save the quote");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-5 border-t border-[#F0F0F0] pt-4">
      {quotes.length > 0 && (
        <div className="mb-4 space-y-2">
          <p className="text-sm font-semibold text-navy">Quotes</p>
          {quotes.map((quote) => (
            <div key={quote.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-[#F9FAFB] px-3 py-2.5">
              <div className="min-w-0">
                <p className="flex flex-wrap items-center gap-2 text-sm font-semibold text-navy">
                  {quote.number}
                  {quote.status && <StatusPill tone={QUOTE_TONES[quote.status]}>{humanize(quote.status)}</StatusPill>}
                </p>
                <p className="text-xs text-[#6B7280]">
                  {formatDate(quote.createdAt, true)} · {formatPrice(quote.total)}
                  {quote.validUntil ? ` · valid until ${formatDate(quote.validUntil)}` : ""}
                </p>
                {quote.customerResponse && <p className="mt-1 text-xs text-navy">Customer: “{quote.customerResponse}”</p>}
              </div>
              <button type="button" className={btn("outline", "sm")} onClick={() => downloadQuote(quote)}>
                <Download className="h-3.5 w-3.5" />
                Download PDF
              </button>
            </div>
          ))}
        </div>
      )}
      <button type="button" className={btn(open ? "outline" : "gold")} onClick={() => setOpen((value) => !value)}>
        {open ? "Close quote" : quotes.length ? "Prepare a new quote version" : "Prepare quote"}
      </button>
      {open && (
        <div className="mt-3 space-y-3">
          <p className="text-sm text-muted-foreground">
            {order.full_name} · {order.phone}
            {order.email ? ` · ${order.email}` : ""} · {order.delivery_location}
          </p>
          {lines.map((line, index) => (
            <div key={index} className="grid gap-2 sm:grid-cols-[1fr_5.5rem_8rem_auto]">
              <input
                className="field-input"
                value={line.description}
                placeholder="Description"
                onChange={(e) => updateLine(index, { description: e.target.value })}
              />
              <input
                className="field-input"
                type="number"
                min={1}
                value={line.quantity}
                aria-label="Quantity"
                onChange={(e) => updateLine(index, { quantity: e.target.value })}
              />
              <input
                className="field-input"
                type="number"
                min={0}
                step={500}
                value={line.unitPrice}
                placeholder="Unit TSh"
                aria-label="Unit price"
                onChange={(e) => updateLine(index, { unitPrice: e.target.value })}
              />
              <button
                type="button"
                className="text-sm font-semibold text-destructive disabled:opacity-40"
                disabled={lines.length === 1}
                onClick={() => setLines((current) => current.filter((_, i) => i !== index))}
              >
                Remove
              </button>
            </div>
          ))}
          <button
            type="button"
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-navy"
            onClick={() => setLines((current) => [...current, { description: "", quantity: "1", unitPrice: "" }])}
          >
            <Plus className="h-4 w-4" /> Add line
          </button>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="field-label">Valid until</label>
              <input type="date" className="field-input" value={validUntil} onChange={(e) => setValidUntil(e.target.value)} />
              <p className="mt-1.5 text-xs text-muted-foreground">Filled as 3 days from today.</p>
            </div>
            <div>
              <label className="field-label">Advance %</label>
              <input
                type="number"
                min={10}
                max={100}
                className="field-input"
                value={advancePercent}
                onChange={(e) => setAdvancePercent(e.target.value)}
                placeholder="Automatic"
              />
              <p className="mt-1.5 text-xs text-muted-foreground">
                Leave empty to use the tier from Site settings (custom orders start at 60%, large orders 70%). The advance
                note and payment policy are added to the quote.
              </p>
            </div>
            <div>
              <label className="field-label">What is included</label>
              <textarea
                className="field-input"
                rows={2}
                value={inclusions}
                onChange={(e) => setInclusions(e.target.value)}
                placeholder="e.g. Varnish, assembly, cushions"
              />
            </div>
            <div>
              <label className="field-label">Not included</label>
              <textarea
                className="field-input"
                rows={2}
                value={exclusions}
                onChange={(e) => setExclusions(e.target.value)}
                placeholder="e.g. Delivery outside Mbeya"
              />
            </div>
            <div>
              <label className="field-label">Estimated completion</label>
              <input type="date" className="field-input" value={estimatedCompletion} onChange={(e) => setEstimatedCompletion(e.target.value)} />
            </div>
            <div className="sm:col-span-2">
              <label className="field-label">Notes for the customer</label>
              <textarea
                className="field-input"
                rows={3}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Lead time, delivery, and what is included"
              />
            </div>
          </div>
          <button type="button" className="btn-base btn-gold" disabled={busy} onClick={onSave}>
            {busy ? "Saving…" : "Save and download PDF"}
          </button>
        </div>
      )}
    </div>
  );
}

type Tab = "all" | (typeof STATUSES)[number];

function AdminCustomOrdersPage() {
  const search = Route.useSearch();
  const list = useServerFn(listAdminCustomOrders);
  const update = useServerFn(updateCustomOrderStatus);
  const remove = useServerFn(deleteAdminCustomOrder);
  const [rows, setRows] = useState<Row[] | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [q, setQ] = useState(search.q ?? "");
  const [tab, setTab] = useState<Tab>("all");

  async function refresh() {
    setRows(await list());
  }

  useEffect(() => {
    refresh().catch((e) => toast.error(e instanceof Error ? e.message : "Load failed"));
  }, []);

  useEffect(() => {
    if (search.q) setQ(search.q);
  }, [search.q]);

  const searched = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!rows || !term) return rows ?? [];
    const digits = term.replace(/\D/g, "");
    return rows.filter(
      (r) =>
        r.request_number.toLowerCase().includes(term) ||
        r.full_name.toLowerCase().includes(term) ||
        r.furniture_type.toLowerCase().includes(term) ||
        (digits.length >= 3 && r.phone.replace(/\D/g, "").includes(digits)),
    );
  }, [rows, q]);
  const tabs: { id: Tab; label: string; count: number }[] = [
    { id: "all", label: "All", count: searched.length },
    ...STATUSES.map((s) => ({ id: s, label: customStatusLabel(s), count: searched.filter((r) => r.status === s).length })),
  ];
  const shown = tab === "all" ? searched : searched.filter((r) => r.status === tab);

  async function onStatus(id: string, status: (typeof STATUSES)[number]) {
    try {
      await update({ data: { id, status } });
      toast.success("Updated");
      await refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Update failed");
    }
  }

  async function onDelete(id: string, requestNumber: string) {
    if (!confirm(`Delete custom order ${requestNumber}? This cannot be undone.`)) return;
    setDeletingId(id);
    try {
      await remove({ data: { id } });
      toast.success("Custom order deleted");
      await refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Delete failed");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div>
      <AdminPageHeader
        title="Custom requests"
        description="Bespoke requests with reference photos. Prepare a quote, save it, and download the PDF. Registered customers are notified."
      />

      <div className="mb-4 space-y-3">
        <StatusTabs tabs={tabs} value={tab} onChange={setTab} />
        <SearchInput value={q} onChange={setQ} placeholder="Search request number, name, phone or item" className="max-w-md" />
      </div>

      {!rows && <AdminLoading label="Loading custom requests…" />}
      <div className="space-y-4">
        {shown.map((r) => (
          <AdminCard key={r.id}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-base font-semibold text-navy">{r.request_number}</p>
                  <StatusPill tone={customStatusTone(r.status)}>{customStatusLabel(r.status)}</StatusPill>
                  {r.user_id && <StatusPill tone="info">Registered customer</StatusPill>}
                </div>
                <p className="mt-1 text-xs text-[#6B7280]">{formatDate(r.created_at, true)}</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <select
                  className="h-9 rounded-lg border border-[#E5E5E5] bg-white px-2 text-sm text-navy"
                  value={r.status}
                  aria-label="Request status"
                  onChange={(e) => onStatus(r.id, e.target.value as (typeof STATUSES)[number])}
                >
                  {STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {customStatusLabel(s)}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => onDelete(r.id, r.request_number)}
                  disabled={deletingId === r.id}
                  className={btn("danger", "sm")}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  {deletingId === r.id ? "Deleting…" : "Delete"}
                </button>
              </div>
            </div>

            <div className="mt-5 grid gap-5 lg:grid-cols-[1fr_220px]">
              <div className="space-y-3 text-sm">
                <div>
                  <p className="text-[0.7rem] font-semibold uppercase tracking-wide text-[#6B7280]">Customer</p>
                  <p className="mt-1 font-semibold text-navy">{r.full_name}</p>
                  <a
                    href={`tel:${r.phone.replace(/[^\d+]/g, "")}`}
                    className="mt-1 inline-flex items-center gap-1.5 font-semibold text-[#B86A00] transition-colors hover:text-navy hover:underline"
                  >
                    <Phone className="h-3.5 w-3.5" /> {r.phone}
                  </a>
                  {r.email && <p className="text-[#6B7280]">{r.email}</p>}
                </div>
                <div>
                  <p className="text-[0.7rem] font-semibold uppercase tracking-wide text-[#6B7280]">Request</p>
                  <p className="mt-1 text-navy">
                    {r.furniture_type} ×{r.quantity}
                  </p>
                  <p className="mt-1 leading-relaxed text-[#374151]">{r.design_description}</p>
                  {(r.needed_by || r.budget || r.finish) && (
                    <p className="mt-1 text-xs text-[#6B7280]">
                      {[
                        r.needed_by ? `Needed by ${formatDate(r.needed_by)}` : null,
                        r.budget ? `Budget: ${r.budget}` : null,
                        r.finish ? `Finish: ${r.finish}` : null,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  )}
                  {r.cancel_reason && <p className="mt-1 text-xs text-[#DC2626]">Cancelled: {r.cancel_reason}</p>}
                </div>
                <div>
                  <p className="text-[0.7rem] font-semibold uppercase tracking-wide text-[#6B7280]">Delivery</p>
                  <p className="mt-1">{r.delivery_location}</p>
                  {r.preferred_dimensions && <p className="mt-1 text-muted-foreground">{r.preferred_dimensions}</p>}
                  <div className="mt-3 space-y-3">
                    <PreferenceBlock label="Materials" stored={r.preferred_material} />
                    <PreferenceBlock label="Colours" stored={r.preferred_color} swatches />
                  </div>
                  {r.additional_requirements && (
                    <p className="mt-2 whitespace-pre-line text-sm text-navy">{r.additional_requirements}</p>
                  )}
                </div>
              </div>
              <div className="space-y-3">
                {(
                  [
                    ["Reference photo", r.signed_url, "reference"],
                    ["Material / colour", r.finish_signed_url, "finish"],
                  ] as const
                ).map(([label, url, kind]) =>
                  url ? (
                    <div key={kind} className="space-y-2">
                      <p className="text-[0.7rem] font-semibold uppercase tracking-wide text-[#6B7280]">{label}</p>
                      <a
                        href={url}
                        target="_blank"
                        rel="noreferrer"
                        className="group block overflow-hidden rounded-xl border border-border/80 transition-all hover:border-gold/40 hover:shadow-[var(--shadow-lift)]"
                      >
                        <img
                          src={url}
                          alt={label}
                          className="h-36 w-full object-cover transition-transform duration-500 group-hover:scale-105"
                        />
                      </a>
                      <button
                        type="button"
                        className="btn-base btn-outline-navy !h-9 w-full text-xs"
                        onClick={() => {
                          downloadToDevice(url, photoFileName(`${r.request_number}-${kind}`, url)).catch(() => {
                            toast.error("Could not download this photo");
                          });
                        }}
                      >
                        <Download className="h-3.5 w-3.5" />
                        Download photo
                      </button>
                    </div>
                  ) : null,
                )}
                {!r.signed_url && !r.finish_signed_url && (
                  <div className="grid h-48 place-items-center rounded-xl border border-dashed border-border bg-secondary/40 text-xs text-muted-foreground">
                    <span className="inline-flex flex-col items-center gap-2">
                      <ImageIcon className="h-5 w-5 opacity-50" />
                      No photo attached
                    </span>
                  </div>
                )}
              </div>
            </div>
            <QuotePanel order={r} onSaved={refresh} />
          </AdminCard>
        ))}
        {rows && !shown.length && (
          <AdminEmpty title={rows.length ? "No requests match" : "No custom requests yet"}>
            {rows.length ? "Try another tab or search." : "Requests from the custom order form appear here."}
          </AdminEmpty>
        )}
      </div>
    </div>
  );
}
