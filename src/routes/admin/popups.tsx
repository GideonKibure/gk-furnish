import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Megaphone, Plus } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { AdminBadge, AdminCard, AdminEmpty, AdminPageHeader } from "@/components/admin/admin-ui";
import {
  deleteAdminOfferPopup,
  listAdminOfferPopups,
  upsertAdminOfferPopup,
} from "@/lib/content.functions";

export const Route = createFileRoute("/admin/popups")({
  head: () => ({
    meta: [{ title: "Offer popups — Admin" }, { name: "robots", content: "noindex" }],
  }),
  component: AdminPopupsPage,
});

type Popup = Awaited<ReturnType<typeof listAdminOfferPopups>>[number];

function AdminPopupsPage() {
  const list = useServerFn(listAdminOfferPopups);
  const save = useServerFn(upsertAdminOfferPopup);
  const remove = useServerFn(deleteAdminOfferPopup);
  const [rows, setRows] = useState<Popup[]>([]);
  const [editing, setEditing] = useState<Popup | null>(null);
  const [creating, setCreating] = useState(false);
  const [busy, setBusy] = useState(false);
  const [previewEn, setPreviewEn] = useState("");

  async function refresh() {
    setRows(await list());
  }

  useEffect(() => {
    refresh().catch((e) => toast.error(e instanceof Error ? e.message : "Load failed"));
  }, []);

  useEffect(() => {
    if (editing) setPreviewEn(editing.message_en);
    else if (creating) setPreviewEn("");
  }, [editing, creating]);

  async function onSave(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setBusy(true);
    try {
      await save({
        data: {
          id: editing?.id,
          message_en: String(fd.get("message_en") ?? ""),
          message_sw: String(fd.get("message_sw") ?? ""),
          delay_seconds: Number(fd.get("delay_seconds") || 0),
          duration_seconds: Number(fd.get("duration_seconds") || 12),
          is_active: fd.get("is_active") === "on",
        },
      });
      toast.success("Popup saved");
      setCreating(false);
      setEditing(null);
      await refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Save failed");
    } finally {
      setBusy(false);
    }
  }

  async function onDelete(id: string) {
    if (!confirm("Delete this popup?")) return;
    try {
      await remove({ data: { id } });
      toast.success("Deleted");
      await refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Delete failed");
    }
  }

  const formOpen = creating || editing;
  const draft = editing;

  return (
    <div>
      <AdminPageHeader
        title="Offer popups"
        description="Red urgency bar above the navigation. Only one offer can be active at a time."
        action={
          <button
            type="button"
            className="btn-base btn-gold"
            onClick={() => {
              setCreating(true);
              setEditing(null);
            }}
          >
            <Plus className="h-4 w-4" />
            Add popup
          </button>
        }
      />

      {formOpen && (
        <AdminCard hover={false} className="mb-8 space-y-4">
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-red-100 text-red-700">
              <Megaphone className="h-4 w-4" />
            </span>
            <div>
              <h2 className="font-display text-xl text-navy">
                {editing ? "Edit offer" : "New offer"}
              </h2>
              <p className="text-sm text-muted-foreground">
                Live preview updates as you type the English message.
              </p>
            </div>
          </div>

          <div className="relative overflow-hidden rounded-xl bg-gradient-to-r from-red-700 via-red-600 to-rose-600 px-4 py-3.5 text-center text-sm font-semibold text-white shadow-md">
            <span className="mr-2 inline-flex rounded-full bg-white/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.14em]">
              Offer
            </span>
            {previewEn.trim() || "Your offer message appears here…"}
          </div>

          <form onSubmit={onSave} className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="field-label">Message (EN) *</label>
                <input
                  name="message_en"
                  required
                  className="field-input"
                  defaultValue={draft?.message_en ?? ""}
                  onChange={(e) => setPreviewEn(e.target.value)}
                />
              </div>
              <div>
                <label className="field-label">Message (SW)</label>
                <input
                  name="message_sw"
                  className="field-input"
                  defaultValue={draft?.message_sw ?? ""}
                />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="field-label">Show after (seconds)</label>
                <input
                  name="delay_seconds"
                  type="number"
                  min={0}
                  className="field-input"
                  defaultValue={draft?.delay_seconds ?? 3}
                />
              </div>
              <div>
                <label className="field-label">Hide after (seconds visible)</label>
                <input
                  name="duration_seconds"
                  type="number"
                  min={1}
                  className="field-input"
                  defaultValue={draft?.duration_seconds ?? 12}
                />
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm font-medium text-navy">
              <input
                type="checkbox"
                name="is_active"
                defaultChecked={draft?.is_active ?? false}
                className="accent-gold"
              />
              Active on site (deactivates other popups)
            </label>
            <div className="flex gap-2">
              <button type="submit" className="btn-base btn-gold" disabled={busy}>
                {busy ? "Saving…" : "Save popup"}
              </button>
              <button
                type="button"
                className="btn-base btn-outline-navy"
                onClick={() => {
                  setCreating(false);
                  setEditing(null);
                }}
              >
                Cancel
              </button>
            </div>
          </form>
        </AdminCard>
      )}

      <div className="space-y-3">
        {rows.map((r) => (
          <AdminCard key={r.id} className="!py-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-medium text-navy">{r.message_en}</p>
                  <AdminBadge tone={r.is_active ? "success" : "neutral"}>
                    {r.is_active ? "Active" : "Inactive"}
                  </AdminBadge>
                </div>
                {r.message_sw && (
                  <p className="mt-1 text-sm text-muted-foreground">{r.message_sw}</p>
                )}
                <p className="mt-2 text-xs text-muted-foreground">
                  Delay {r.delay_seconds}s · Visible {r.duration_seconds}s
                </p>
              </div>
              <div className="flex gap-2 text-sm font-semibold">
                <button
                  type="button"
                  className="rounded-lg border border-border px-3 py-1.5 text-navy transition-colors hover:border-gold/40 hover:bg-gold-soft"
                  onClick={() => {
                    setEditing(r);
                    setCreating(false);
                  }}
                >
                  Edit
                </button>
                <button
                  type="button"
                  className="rounded-lg border border-destructive/30 px-3 py-1.5 text-destructive transition-colors hover:bg-destructive/10"
                  onClick={() => onDelete(r.id)}
                >
                  Delete
                </button>
              </div>
            </div>
          </AdminCard>
        ))}
        {!rows.length && (
          <AdminEmpty>No offer popups yet. Add one to promote a sale or announcement.</AdminEmpty>
        )}
      </div>
    </div>
  );
}
