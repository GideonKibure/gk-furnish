import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { FileText, Pencil } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { AdminCard, AdminEmpty, AdminPageHeader } from "@/components/admin/admin-ui";
import { listAdminPageSections, upsertAdminPageSection } from "@/lib/content.functions";

export const Route = createFileRoute("/admin/content")({
  head: () => ({
    meta: [{ title: "Page content — Admin" }, { name: "robots", content: "noindex" }],
  }),
  component: AdminContentPage,
});

type Section = Awaited<ReturnType<typeof listAdminPageSections>>[number];

function AdminContentPage() {
  const list = useServerFn(listAdminPageSections);
  const save = useServerFn(upsertAdminPageSection);
  const [sections, setSections] = useState<Section[]>([]);
  const [editing, setEditing] = useState<Section | null>(null);
  const [busy, setBusy] = useState(false);

  async function refresh() {
    setSections(await list());
  }

  useEffect(() => {
    refresh().catch((e) => toast.error(e instanceof Error ? e.message : "Load failed"));
  }, []);

  async function onSave(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!editing) return;
    const fd = new FormData(e.currentTarget);
    setBusy(true);
    try {
      await save({
        data: {
          id: editing.id,
          page_key: editing.page_key,
          section_key: editing.section_key,
          content_en: String(fd.get("content_en") ?? ""),
          content_sw: String(fd.get("content_sw") ?? ""),
        },
      });
      toast.success("Section saved");
      setEditing(null);
      await refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Save failed");
    } finally {
      setBusy(false);
    }
  }

  const grouped = sections.reduce<Record<string, Section[]>>((acc, s) => {
    (acc[s.page_key] ??= []).push(s);
    return acc;
  }, {});

  return (
    <div>
      <AdminPageHeader
        title="Page content"
        description="Edit bilingual English and Kiswahili copy shown on the public site."
      />

      {editing && (
        <AdminCard hover={false} className="mb-8 space-y-4">
          <div className="flex items-start gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-gold-soft text-navy">
              <FileText className="h-4 w-4" />
            </span>
            <div>
              <h2 className="font-display text-xl text-navy">
                {editing.page_key} / {editing.section_key}
              </h2>
              <p className="mt-0.5 text-sm text-muted-foreground">
                Update both languages so the language switcher stays accurate.
              </p>
            </div>
          </div>
          <form onSubmit={onSave} className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="field-label">English</label>
                <textarea
                  name="content_en"
                  rows={5}
                  className="field-input"
                  defaultValue={editing.content_en}
                  required
                />
              </div>
              <div>
                <label className="field-label">Kiswahili</label>
                <textarea
                  name="content_sw"
                  rows={5}
                  className="field-input"
                  defaultValue={editing.content_sw}
                />
              </div>
            </div>
            <div className="flex gap-2">
              <button type="submit" className="btn-base btn-gold" disabled={busy}>
                {busy ? "Saving…" : "Save section"}
              </button>
              <button
                type="button"
                className="btn-base btn-outline-navy"
                onClick={() => setEditing(null)}
              >
                Cancel
              </button>
            </div>
          </form>
        </AdminCard>
      )}

      <div className="space-y-6">
        {Object.entries(grouped).map(([page, items]) => (
          <section key={page}>
            <h2 className="mb-3 font-display text-xl capitalize tracking-tight text-navy">
              {page}
            </h2>
            <AdminCard hover={false} className="!p-0 overflow-hidden">
              <ul className="divide-y divide-border/70">
                {items.map((s) => (
                  <li
                    key={s.id}
                    className="group flex flex-wrap items-start justify-between gap-3 px-5 py-4 transition-colors hover:bg-secondary/40 md:px-6"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-[0.7rem] font-bold uppercase tracking-[0.14em] text-muted-foreground">
                        {s.section_key}
                      </p>
                      <p className="mt-1 line-clamp-2 text-sm text-navy">{s.content_en}</p>
                      {s.content_sw && (
                        <p className="mt-1 line-clamp-1 text-xs text-muted-foreground">
                          {s.content_sw}
                        </p>
                      )}
                    </div>
                    <button
                      type="button"
                      className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm font-semibold text-navy transition-all group-hover:border-gold/40 group-hover:bg-gold-soft"
                      onClick={() => setEditing(s)}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                      Edit
                    </button>
                  </li>
                ))}
              </ul>
            </AdminCard>
          </section>
        ))}
        {!sections.length && <AdminEmpty>No page sections yet.</AdminEmpty>}
      </div>
    </div>
  );
}
