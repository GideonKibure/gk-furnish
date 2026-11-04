import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { ImagePlus, Pencil, Plus, Trash2, X } from "lucide-react";
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
import { IMAGES, imageFor } from "@/data/images";
import { setAdminSiteImage } from "@/lib/content.functions";
import { imageFileToUpload } from "@/lib/ops/files";
import { deleteAdminCategory, listAdminCategoryRows, upsertAdminCategory } from "@/lib/ops/catalogue.functions";
import { categoryImageSlot, REMOVED_IMAGE } from "@/lib/site-images";

export const Route = createFileRoute("/admin/categories")({
  head: () => ({ meta: [{ title: "Categories — Admin" }, { name: "robots", content: "noindex" }] }),
  component: AdminCategoriesPage,
});

type Data = Awaited<ReturnType<typeof listAdminCategoryRows>>;
type Row = Data["rows"][number];

const IMAGE_KEYS = Object.keys(IMAGES) as (keyof typeof IMAGES)[];

function categoryImage(c: Pick<Row, "photo_url" | "image_key">) {
  if (c.photo_url && c.photo_url !== REMOVED_IMAGE) return c.photo_url;
  return imageFor(c.image_key);
}

function AdminCategoriesPage() {
  const list = useServerFn(listAdminCategoryRows);
  const remove = useServerFn(deleteAdminCategory);
  const [data, setData] = useState<Data | null>(null);
  const [editing, setEditing] = useState<Row | "new" | null>(null);

  async function refresh() {
    const next = await list();
    setData(next);
    setEditing((current) => (current && current !== "new" ? (next.rows.find((r) => r.id === current.id) ?? null) : current));
  }

  useEffect(() => {
    refresh().catch((e) => toast.error(e instanceof Error ? e.message : "Load failed"));
  }, []);

  async function onDelete(c: Row) {
    if (!confirm(`Delete the category “${c.name}”?`)) return;
    try {
      await remove({ data: { id: c.id } });
      toast.success("Category deleted");
      if (editing !== "new" && editing?.id === c.id) setEditing(null);
      await refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Delete failed", { duration: 8000 });
    }
  }

  const columns: Column<Row>[] = [
    {
      key: "name",
      header: "Category",
      cell: (c) => (
        <div className="flex items-center gap-3">
          <img src={categoryImage(c)} alt="" className="h-11 w-11 shrink-0 rounded-lg object-cover ring-1 ring-[#E5E5E5]" />
          <div className="min-w-0">
            <p className="truncate font-semibold text-navy">{c.name}</p>
            <p className="truncate text-xs text-[#6B7280]">{c.name_sw || "—"}</p>
          </div>
        </div>
      ),
    },
    { key: "slug", header: "Link", className: "hidden lg:table-cell", cell: (c) => <code className="text-xs text-[#374151]">/{c.slug}</code> },
    { key: "products", header: "Products", align: "right", cell: (c) => <span className="font-medium text-navy">{c.product_count}</span> },
    { key: "sort", header: "Order", align: "right", className: "hidden lg:table-cell", cell: (c) => c.sort_order },
    {
      key: "status",
      header: "Status",
      cell: (c) => <StatusPill tone={c.is_active ? "success" : "neutral"}>{c.is_active ? "Active" : "Hidden"}</StatusPill>,
    },
    {
      key: "actions",
      header: <span className="sr-only">Actions</span>,
      align: "right",
      cell: (c) => (
        <div className="flex justify-end gap-1.5">
          <button type="button" className={btn("outline", "sm")} onClick={() => setEditing(c)}>
            <Pencil className="h-3.5 w-3.5" /> Edit
          </button>
          <button type="button" className={btn("danger", "sm")} onClick={() => void onDelete(c)} aria-label={`Delete ${c.name}`}>
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      ),
    },
  ];

  return (
    <div>
      <AdminPageHeader
        title="Categories"
        description="Group products in the shop. Hidden categories stay in the portal but disappear from the storefront."
        action={
          <button type="button" className={btn("gold")} onClick={() => setEditing("new")}>
            <Plus className="h-4 w-4" /> Add category
          </button>
        }
      />

      {data && !data.activeReady && (
        <div className="mb-4">
          <AdminNotice tone="pending">Hiding categories needs the 0007 database update. Everything else works now.</AdminNotice>
        </div>
      )}

      {editing && (
        <CategoryForm
          key={editing === "new" ? "new" : editing.id}
          row={editing === "new" ? null : editing}
          nextSort={(data?.rows.reduce((m, r) => Math.max(m, r.sort_order), 0) ?? 0) + 1}
          onClose={() => setEditing(null)}
          onSaved={refresh}
        />
      )}

      {!data ? (
        <AdminLoading label="Loading categories…" />
      ) : (
        <DataTable
          rows={data.rows}
          columns={columns}
          rowKey={(c) => c.id}
          empty={<AdminEmpty title="No categories yet">Add a category, then assign products to it.</AdminEmpty>}
          mobileCard={(c) => (
            <div className="flex items-center gap-3">
              <img src={categoryImage(c)} alt="" className="h-14 w-14 shrink-0 rounded-lg object-cover ring-1 ring-[#E5E5E5]" />
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <p className="truncate font-semibold text-navy">{c.name}</p>
                  <StatusPill tone={c.is_active ? "success" : "neutral"}>{c.is_active ? "Active" : "Hidden"}</StatusPill>
                </div>
                <p className="text-xs text-[#6B7280]">
                  {c.product_count} product{c.product_count === 1 ? "" : "s"} · /{c.slug}
                </p>
                <div className="mt-2 flex gap-1.5">
                  <button type="button" className={btn("outline", "sm")} onClick={() => setEditing(c)}>
                    <Pencil className="h-3.5 w-3.5" /> Edit
                  </button>
                  <button type="button" className={btn("danger", "sm")} onClick={() => void onDelete(c)}>
                    <Trash2 className="h-3.5 w-3.5" /> Delete
                  </button>
                </div>
              </div>
            </div>
          )}
        />
      )}
    </div>
  );
}

function CategoryForm({
  row,
  nextSort,
  onClose,
  onSaved,
}: {
  row: Row | null;
  nextSort: number;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const save = useServerFn(upsertAdminCategory);
  const setImage = useServerFn(setAdminSiteImage);
  const [busy, setBusy] = useState<string | null>(null);
  const [imageKey, setImageKey] = useState(row?.image_key ?? "");

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setBusy("save");
    try {
      const r = await save({
        data: {
          ...(row ? { id: row.id } : {}),
          name: String(fd.get("name") ?? ""),
          name_sw: String(fd.get("name_sw") ?? ""),
          slug: String(fd.get("slug") ?? ""),
          description: String(fd.get("description") ?? ""),
          description_sw: String(fd.get("description_sw") ?? ""),
          image_key: imageKey,
          sort_order: Math.max(0, Math.round(Number(fd.get("sort_order") || 0))),
          is_active: fd.get("is_active") === "on",
        },
      });
      toast.success(row ? "Category updated" : "Category created");
      if (r.notice) toast.info(r.notice, { duration: 10000 });
      onClose();
      await onSaved();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Save failed");
    } finally {
      setBusy(null);
    }
  }

  async function onPhoto(file: File | null, action: "upload" | "reset") {
    if (!row) return;
    setBusy("photo");
    try {
      await setImage({
        data: {
          slot: categoryImageSlot(row.slug),
          action,
          ...(action === "upload" && file ? { file: await imageFileToUpload(file) } : {}),
        },
      });
      toast.success(action === "upload" ? "Photo uploaded" : "Back to the built-in photo");
      await onSaved();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Photo upload failed");
    } finally {
      setBusy(null);
    }
  }

  const preview = row ? categoryImage({ photo_url: row.photo_url, image_key: imageKey }) : imageFor(imageKey);
  const hasUpload = Boolean(row?.photo_url && row.photo_url !== REMOVED_IMAGE);

  return (
    <AdminCard className="mb-5">
      <form onSubmit={onSubmit} className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_16rem]">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="flex items-center justify-between sm:col-span-2">
            <h2 className="text-base font-semibold text-navy">{row ? `Edit ${row.name}` : "New category"}</h2>
            <button type="button" className={btn("ghost", "sm")} onClick={onClose} aria-label="Close form">
              <X className="h-4 w-4" />
            </button>
          </div>
          <div>
            <label className="field-label">Name (EN) *</label>
            <input name="name" required className="field-input" defaultValue={row?.name ?? ""} />
          </div>
          <div>
            <label className="field-label">Name (SW)</label>
            <input name="name_sw" className="field-input" defaultValue={row?.name_sw ?? ""} />
          </div>
          <div>
            <label className="field-label">Link name (slug)</label>
            <input name="slug" className="field-input font-mono" placeholder="auto from name" defaultValue={row?.slug ?? ""} />
            <p className="mt-1 text-xs text-[#6B7280]">Used in the shop address. Changing it breaks old links.</p>
          </div>
          <div>
            <label className="field-label">Display order</label>
            <input name="sort_order" type="number" min={0} className="field-input" defaultValue={row?.sort_order ?? nextSort} />
          </div>
          <div>
            <label className="field-label">Description (EN)</label>
            <textarea name="description" rows={3} className="field-input" defaultValue={row?.description ?? ""} />
          </div>
          <div>
            <label className="field-label">Description (SW)</label>
            <textarea name="description_sw" rows={3} className="field-input" defaultValue={row?.description_sw ?? ""} />
          </div>
          <label className="flex items-center gap-2 text-sm text-navy sm:col-span-2">
            <input type="checkbox" name="is_active" defaultChecked={row?.is_active ?? true} className="h-4 w-4 accent-[#14213D]" />
            Show this category in the shop
          </label>
          <div className="flex gap-2 sm:col-span-2">
            <button type="submit" className={btn("gold")} disabled={busy !== null}>
              {busy === "save" ? "Saving…" : "Save category"}
            </button>
            <button type="button" className={btn("outline")} onClick={onClose}>
              Cancel
            </button>
          </div>
        </div>

        <div className="space-y-2">
          <p className="field-label">Image</p>
          <img src={preview} alt="" className="aspect-[4/3] w-full rounded-lg object-cover ring-1 ring-[#E5E5E5]" />
          <label className="block">
            <span className="mb-1 block text-xs text-[#6B7280]">Built-in photo</span>
            <select className="field-input" value={imageKey} onChange={(e) => setImageKey(e.target.value)}>
              <option value="">Default</option>
              {IMAGE_KEYS.map((k) => (
                <option key={k} value={k}>
                  {k}
                </option>
              ))}
            </select>
          </label>
          {row ? (
            <div className="flex flex-wrap gap-2">
              <label className={btn("outline", "sm", "cursor-pointer")}>
                <ImagePlus className="h-3.5 w-3.5" />
                {busy === "photo" ? "Uploading…" : hasUpload ? "Replace photo" : "Upload photo"}
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="sr-only"
                  disabled={busy !== null}
                  onChange={(e) => {
                    const file = e.target.files?.[0] ?? null;
                    e.target.value = "";
                    if (file) void onPhoto(file, "upload");
                  }}
                />
              </label>
              {hasUpload && (
                <button type="button" className={btn("ghost", "sm")} disabled={busy !== null} onClick={() => void onPhoto(null, "reset")}>
                  Use built-in
                </button>
              )}
            </div>
          ) : (
            <p className="text-xs text-[#6B7280]">Save the category first to upload your own photo.</p>
          )}
          {hasUpload && <p className="text-xs text-[#6B7280]">An uploaded photo replaces the built-in one.</p>}
        </div>
      </form>
    </AdminCard>
  );
}
