import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { ImageIcon, Phone, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { AdminBadge, AdminCard, AdminEmpty, AdminPageHeader } from "@/components/admin/admin-ui";
import { deleteAdminCustomOrder, listAdminCustomOrders, updateCustomOrderStatus } from "@/lib/admin.functions";

export const Route = createFileRoute("/admin/custom-orders")({
  head: () => ({ meta: [{ title: "Custom orders — Admin" }, { name: "robots", content: "noindex" }] }),
  component: AdminCustomOrdersPage,
});

type Row = Awaited<ReturnType<typeof listAdminCustomOrders>>[number];

const STATUSES = ["pending", "quoted", "in_progress", "completed", "cancelled"] as const;

function statusTone(status: string): "neutral" | "gold" | "success" | "danger" {
  if (status === "completed") return "success";
  if (status === "cancelled") return "danger";
  if (status === "quoted" || status === "in_progress") return "gold";
  return "neutral";
}

function AdminCustomOrdersPage() {
  const list = useServerFn(listAdminCustomOrders);
  const update = useServerFn(updateCustomOrderStatus);
  const remove = useServerFn(deleteAdminCustomOrder);
  const [rows, setRows] = useState<Row[]>([]);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function refresh() {
    setRows(await list());
  }

  useEffect(() => {
    refresh().catch((e) => toast.error(e instanceof Error ? e.message : "Load failed"));
  }, []);

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
        title="Custom orders"
        description="Bespoke requests with reference photos — update status as you quote and build."
      />

      <div className="space-y-4">
        {rows.map((r) => (
          <AdminCard key={r.id}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-display text-lg text-navy">{r.request_number}</p>
                  <AdminBadge tone={statusTone(r.status)}>{r.status.replace(/_/g, " ")}</AdminBadge>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">{new Date(r.created_at).toLocaleString()}</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <select
                  className="field-input !h-10 max-w-[180px]"
                  value={r.status}
                  onChange={(e) => onStatus(r.id, e.target.value as (typeof STATUSES)[number])}
                >
                  {STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {s.replace(/_/g, " ")}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => onDelete(r.id, r.request_number)}
                  disabled={deletingId === r.id}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-destructive/30 px-3 py-2 text-sm font-semibold text-destructive transition-colors hover:bg-destructive/10 disabled:opacity-50"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  {deletingId === r.id ? "Deleting…" : "Delete"}
                </button>
              </div>
            </div>

            <div className="mt-5 grid gap-5 lg:grid-cols-[1fr_220px]">
              <div className="space-y-3 text-sm">
                <div>
                  <p className="text-[0.7rem] font-bold uppercase tracking-[0.14em] text-muted-foreground">Customer</p>
                  <p className="mt-1 font-semibold text-navy">{r.full_name}</p>
                  <a
                    href={`tel:${r.phone.replace(/[^\d+]/g, "")}`}
                    className="mt-1 inline-flex items-center gap-1.5 font-semibold text-gold transition-colors hover:text-navy hover:underline"
                  >
                    <Phone className="h-3.5 w-3.5" /> {r.phone}
                  </a>
                </div>
                <div>
                  <p className="text-[0.7rem] font-bold uppercase tracking-[0.14em] text-muted-foreground">Request</p>
                  <p className="mt-1 text-navy">
                    {r.furniture_type} ×{r.quantity}
                  </p>
                  <p className="mt-1 leading-relaxed text-muted-foreground">{r.design_description}</p>
                </div>
                <div>
                  <p className="text-[0.7rem] font-bold uppercase tracking-[0.14em] text-muted-foreground">Delivery</p>
                  <p className="mt-1">{r.delivery_location}</p>
                  {(r.preferred_dimensions || r.preferred_material || r.preferred_color) && (
                    <p className="mt-1 text-muted-foreground">
                      {[r.preferred_dimensions, r.preferred_material, r.preferred_color].filter(Boolean).join(" · ")}
                    </p>
                  )}
                  {r.additional_requirements && (
                    <p className="mt-2 whitespace-pre-line text-sm text-navy">{r.additional_requirements}</p>
                  )}
                </div>
              </div>
              {r.signed_url ? (
                <a
                  href={r.signed_url}
                  target="_blank"
                  rel="noreferrer"
                  className="group block overflow-hidden rounded-xl border border-border/80 transition-all hover:border-gold/40 hover:shadow-[var(--shadow-lift)]"
                >
                  <img
                    src={r.signed_url}
                    alt="Reference"
                    className="h-48 w-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                </a>
              ) : (
                <div className="grid h-48 place-items-center rounded-xl border border-dashed border-border bg-secondary/40 text-xs text-muted-foreground">
                  <span className="inline-flex flex-col items-center gap-2">
                    <ImageIcon className="h-5 w-5 opacity-50" />
                    No photo attached
                  </span>
                </div>
              )}
            </div>
          </AdminCard>
        ))}
        {!rows.length && <AdminEmpty>No custom orders yet.</AdminEmpty>}
      </div>
    </div>
  );
}
