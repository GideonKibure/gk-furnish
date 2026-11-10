import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Pencil, Plus, Trash2, X } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { toast } from "sonner";
import {
  AdminCard,
  AdminEmpty,
  AdminLoading,
  AdminNotice,
  AdminPageHeader,
  DataTable,
  StatusPill,
  btn,
  type Column,
} from "@/components/admin/admin-ui";
import { deleteAdminService, listAdminServices, upsertAdminService } from "@/lib/ops/catalogue.functions";

export const Route = createFileRoute("/admin/services")({
  head: () => ({ meta: [{ title: "Services — Admin" }, { name: "robots", content: "noindex" }] }),
  component: AdminServicesPage,
});

type Listed = Awaited<ReturnType<typeof listAdminServices>>;
type Row = Listed["data"][number];

function AdminServicesPage() {
  const list = useServerFn(listAdminServices);
  const save = useServerFn(upsertAdminService);
  const remove = useServerFn(deleteAdminService);
  const [listed, setListed] = useState<Listed | null>(null);
  const [editing, setEditing] = useState<Row | "new" | null>(null);
  const [busy, setBusy] = useState(false);

  async function refresh() {
    const next = await list();
    setListed(next);
    setEditing((current) => (current && current !== "new" ? (next.data.find((row) => row.id === current.id) ?? null) : current));
  }

  useEffect(() => {
    refresh().catch((e) => toast.error(e instanceof Error ? e.message : "Load failed"));
  }, []);

  async function onSave(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setBusy(true);
    try {
      await save({
        data: {
          ...(editing && editing !== "new" ? { id: editing.id } : {}),
          name: String(fd.get("name") ?? ""),
          name_sw: String(fd.get("name_sw") ?? ""),
          description: String(fd.get("description") ?? ""),
          description_sw: String(fd.get("description_sw") ?? ""),
          sort_order: Math.max(0, Number(fd.get("sort_order") || 0)),
          is_published: fd.get("is_published") === "on",
        },
      });
      toast.success(editing === "new" ? "Service added" : "Service updated");
      setEditing(null);
      await refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Save failed", { duration: 8000 });
    } finally {
      setBusy(false);
    }
  }

  async function onDelete(row: Row) {
    if (!confirm(`Delete the service “${row.name}”?`)) return;
    try {
      await remove({ data: { id: row.id } });
      toast.success("Service deleted");
      if (editing !== "new" && editing?.id === row.id) setEditing(null);
      await refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Delete failed");
    }
  }

  const rows = listed?.data ?? [];
  const columns: Column<Row>[] = [
    {
      key: "name",
      header: "Service",
      cell: (row) => (
        <div className="min-w-0">
          <p className="truncate font-semibold text-navy">{row.name}</p>
          <p className="truncate text-xs text-[#6B7280]">{row.name_sw || row.description || "—"}</p>
        </div>
      ),
    },
    {
      key: "status",
      header: "On the site",
      cell: (row) => <StatusPill tone={row.is_published ? "success" : "neutral"}>{row.is_published ? "Published" : "Hidden"}</StatusPill>,
    },
    {
      key: "actions",
      header: <span className="sr-only">Actions</span>,
      align: "right",
      cell: (row) => (
        <div className="flex justify-end gap-1.5">
          <button type="button" className={btn("outline", "sm")} onClick={() => setEditing(row)}>
            <Pencil className="h-3.5 w-3.5" /> Edit
          </button>
          <button type="button" className={btn("danger", "sm")} onClick={() => void onDelete(row)}>
            <Trash2 className="h-3.5 w-3.5" /> Delete
          </button>
        </div>
      ),
    },
  ];

  const current = editing && editing !== "new" ? editing : null;

  return (
    <div>
      <AdminPageHeader
        title="Services"
        description="Workshop services shown on the customer homepage. Hidden services stay off the site."
        action={
          <button type="button" className={btn("gold")} onClick={() => setEditing("new")} disabled={listed?.available === false}>
            <Plus className="h-4 w-4" /> Add service
          </button>
        }
      />

      {listed && !listed.available && <AdminNotice tone="pending">{listed.reason}</AdminNotice>}

      {editing && (
        <AdminCard className="mb-6">
          <form key={current?.id ?? "new"} onSubmit={onSave} className="grid gap-3 md:grid-cols-2">
            <div className="flex items-center justify-between gap-2 md:col-span-2">
              <h2 className="text-base font-semibold text-navy">{current ? `Edit ${current.name}` : "New service"}</h2>
              <button type="button" className={btn("ghost", "sm")} onClick={() => setEditing(null)} aria-label="Close form">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div>
              <label className="field-label">Name (EN) *</label>
              <input name="name" required className="field-input" defaultValue={current?.name ?? ""} />
            </div>
            <div>
              <label className="field-label">Name (SW)</label>
              <input name="name_sw" className="field-input" defaultValue={current?.name_sw ?? ""} />
            </div>
            <div>
              <label className="field-label">Description (EN)</label>
              <textarea name="description" rows={3} className="field-input" defaultValue={current?.description ?? ""} />
            </div>
            <div>
              <label className="field-label">Description (SW)</label>
              <textarea name="description_sw" rows={3} className="field-input" defaultValue={current?.description_sw ?? ""} />
            </div>
            <div>
              <label className="field-label">Order</label>
              <input name="sort_order" type="number" min={0} className="field-input" defaultValue={current?.sort_order ?? rows.length} />
            </div>
            <label className="flex items-center gap-2 self-end pb-2 text-sm text-navy">
              <input type="checkbox" name="is_published" defaultChecked={current?.is_published ?? true} className="h-4 w-4 accent-[#14213D]" />
              Show on the customer homepage
            </label>
            <div className="flex gap-2 md:col-span-2">
              <button type="submit" className="btn-base btn-gold" disabled={busy}>
                {busy ? "Saving…" : "Save"}
              </button>
              <button type="button" className="btn-base btn-outline-navy" onClick={() => setEditing(null)}>
                Cancel
              </button>
            </div>
          </form>
        </AdminCard>
      )}

      {!listed ? (
        <AdminLoading label="Loading services…" />
      ) : (
        <DataTable
          columns={columns}
          rows={rows}
          rowKey={(row) => row.id}
          mobileCard={(row) => (
            <div>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate font-semibold text-navy">{row.name}</p>
                  <p className="truncate text-xs text-[#6B7280]">{row.name_sw || row.description || "—"}</p>
                </div>
                <StatusPill tone={row.is_published ? "success" : "neutral"}>{row.is_published ? "Published" : "Hidden"}</StatusPill>
              </div>
              <div className="mt-3 flex justify-end gap-1.5 border-t border-[#F0F0F0] pt-3">
                <button type="button" className={btn("outline", "sm")} onClick={() => setEditing(row)}>
                  <Pencil className="h-3.5 w-3.5" /> Edit
                </button>
                <button type="button" className={btn("danger", "sm")} onClick={() => void onDelete(row)}>
                  <Trash2 className="h-3.5 w-3.5" /> Delete
                </button>
              </div>
            </div>
          )}
          empty={
            <AdminEmpty title="No services yet" action={listed.available ? <button type="button" className={btn("gold")} onClick={() => setEditing("new")}><Plus className="h-4 w-4" /> Add service</button> : undefined}>
              Add a service such as custom furniture, repairs, or delivery.
            </AdminEmpty>
          }
        />
      )}
    </div>
  );
}
