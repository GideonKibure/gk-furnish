import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { ArrowDown, ArrowUp, ImageOff, ImagePlus, RotateCcw, Save, Trash2, Upload } from "lucide-react";
import { useEffect, useMemo, useState, type ChangeEvent } from "react";
import { toast } from "sonner";
import { AdminBadge, AdminCard, AdminPageHeader } from "@/components/admin/admin-ui";
import { IMAGES, imageFor } from "@/data/images";
import { resolveSiteImage } from "@/hooks/use-site-images";
import { categoriesQuery } from "@/lib/catalog";
import { listAdminPageSections, saveAdminGallery, setAdminSiteImage } from "@/lib/content.functions";
import {
  categoryImageSlot,
  DEFAULT_GALLERY,
  GALLERY_GROUPS,
  GALLERY_SLOT,
  parseGallery,
  REMOVED_IMAGE,
  SITE_IMAGE_SLOTS,
  SITE_PAGES,
  siteImageValues,
  type GalleryGroup,
  type GalleryItem,
  type SitePage,
} from "@/lib/site-images";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/admin/images")({
  head: () => ({ meta: [{ title: "Site images — Admin" }, { name: "robots", content: "noindex" }] }),
  component: AdminImagesPage,
});

const IMG_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
const MAX_BYTES = 5 * 1024 * 1024;

const GROUP_LABELS: Record<GalleryGroup, string> = {
  chairs: "Chairs",
  tables: "Tables",
  beds: "Beds",
  lamps: "Lamps",
  custom: "Custom projects",
  workshop: "Workshop",
};

type UploadFile = { name: string; type: (typeof IMG_TYPES)[number]; base64: string };

function toBase64(file: File) {
  return new Promise<string>((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(String(r.result).split(",")[1] ?? "");
    r.onerror = () => rej(r.error);
    r.readAsDataURL(file);
  });
}

async function readImageFile(e: ChangeEvent<HTMLInputElement>): Promise<UploadFile | null> {
  const file = e.target.files?.[0];
  e.target.value = "";
  if (!file) return null;
  if (!(IMG_TYPES as readonly string[]).includes(file.type)) {
    toast.error("Use a JPG, PNG or WebP image");
    return null;
  }
  if (file.size > MAX_BYTES) {
    toast.error("Image must be 5MB or smaller");
    return null;
  }
  return { name: file.name, type: file.type as UploadFile["type"], base64: await toBase64(file) };
}

type SlotView = { id: string; label: string; hint: string; fallback: string | null };

function AdminImagesPage() {
  const list = useServerFn(listAdminPageSections);
  const [values, setValues] = useState<Map<string, string>>(new Map());
  const [loaded, setLoaded] = useState(false);
  const { data: categories = [] } = useQuery(categoriesQuery);

  async function refresh() {
    setValues(siteImageValues(await list()));
    setLoaded(true);
  }

  useEffect(() => {
    refresh().catch((e) => toast.error(e instanceof Error ? e.message : "Load failed"));
  }, []);

  function slotsFor(page: SitePage): SlotView[] {
    const fixed = SITE_IMAGE_SLOTS.filter((s) => s.page === page).map((s) => ({
      id: s.id,
      label: s.label,
      hint: s.hint,
      fallback: s.fallback ? IMAGES[s.fallback] : null,
    }));
    if (page !== "categories") return fixed;
    const cats = categories.map((c) => ({
      id: categoryImageSlot(c.slug),
      label: `${c.name} category image`,
      hint: "Shown on the Home and Categories pages.",
      fallback: imageFor(c.image_key),
    }));
    return [...fixed, ...cats];
  }

  function onSlotSaved(slot: string, value: string | null) {
    setValues((prev) => {
      const next = new Map(prev);
      if (value) next.set(slot, value);
      else next.delete(slot);
      return next;
    });
  }

  return (
    <div>
      <AdminPageHeader
        title="Site images"
        description="Replace, remove or restore the photos shown on the public pages. Changes appear on the site within a minute."
      />

      <nav className="mb-8 flex flex-wrap gap-2">
        {SITE_PAGES.map((p) => (
          <a
            key={p.id}
            href={`#images-${p.id}`}
            className="rounded-full bg-secondary px-3.5 py-1.5 text-sm font-semibold text-navy transition-colors hover:bg-gold-soft"
          >
            {p.label}
          </a>
        ))}
      </nav>

      {!loaded ? (
        <p className="text-sm text-muted-foreground">Loading images…</p>
      ) : (
        <div className="space-y-10">
          {SITE_PAGES.map((p) => (
            <section key={p.id} id={`images-${p.id}`} className="scroll-mt-24">
              <h2 className="mb-4 font-display text-2xl tracking-tight text-navy">{p.label}</h2>
              <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
                {slotsFor(p.id).map((slot) => (
                  <SlotCard key={slot.id} slot={slot} value={values.get(slot.id)} onSaved={onSlotSaved} />
                ))}
              </div>
              {p.id === "gallery" && <GalleryEditor raw={values.get(GALLERY_SLOT)} onSaved={refresh} />}
              {p.id === "products" && (
                <p className="mt-4 text-sm text-muted-foreground">
                  Product photos and videos are managed on the Products page of this portal.
                </p>
              )}
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

function SlotCard({
  slot,
  value,
  onSaved,
}: {
  slot: SlotView;
  value: string | undefined;
  onSaved: (slot: string, value: string | null) => void;
}) {
  const save = useServerFn(setAdminSiteImage);
  const [busy, setBusy] = useState(false);
  const removed = value === REMOVED_IMAGE;
  const custom = Boolean(value) && !removed;
  const src = removed ? null : value ? resolveSiteImage(value) : slot.fallback;

  async function run(action: "upload" | "remove" | "reset", file?: UploadFile) {
    setBusy(true);
    try {
      const r = await save({ data: { slot: slot.id, action, ...(file ? { file } : {}) } });
      onSaved(slot.id, r.value);
      toast.success(action === "upload" ? "Image updated" : action === "remove" ? "Image removed" : "Original image restored");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    } finally {
      setBusy(false);
    }
  }

  async function onFile(e: ChangeEvent<HTMLInputElement>) {
    const file = await readImageFile(e);
    if (file) await run("upload", file);
  }

  return (
    <AdminCard hover={false} className="flex flex-col !p-0 overflow-hidden">
      <div className="relative aspect-[16/10] bg-secondary">
        {src ? (
          <img src={src} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="grid h-full place-items-center text-muted-foreground">
            <span className="flex flex-col items-center gap-2 text-sm">
              <ImageOff className="h-6 w-6" />
              {removed ? "Removed from the page" : "No image set"}
            </span>
          </div>
        )}
        <span className="absolute left-3 top-3">
          <AdminBadge tone={custom ? "gold" : removed ? "danger" : "neutral"}>
            {custom ? "Custom" : removed ? "Removed" : slot.fallback ? "Original" : "Empty"}
          </AdminBadge>
        </span>
      </div>
      <div className="flex flex-1 flex-col p-4">
        <p className="font-semibold text-navy">{slot.label}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">{slot.hint}</p>
        <div className="mt-4 flex flex-wrap gap-2">
          <label
            className={cn(
              "inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-navy px-3 py-2 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90",
              busy && "pointer-events-none opacity-50",
            )}
          >
            <Upload className="h-3.5 w-3.5" />
            {busy ? "Saving…" : src ? "Replace" : "Upload"}
            <input type="file" accept={IMG_TYPES.join(",")} className="sr-only" onChange={onFile} disabled={busy} />
          </label>
          {src && (
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                if (confirm(`Remove “${slot.label}” from the page?`)) void run("remove");
              }}
              className="inline-flex items-center gap-1.5 rounded-lg border border-destructive/30 px-3 py-2 text-sm font-semibold text-destructive transition-colors hover:bg-destructive/10 disabled:opacity-50"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Remove
            </button>
          )}
          {value && (
            <button
              type="button"
              disabled={busy}
              onClick={() => void run("reset")}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm font-semibold text-navy transition-colors hover:border-gold/40 hover:bg-gold-soft disabled:opacity-50"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              {slot.fallback ? "Restore original" : "Clear"}
            </button>
          )}
        </div>
      </div>
    </AdminCard>
  );
}

function GalleryEditor({ raw, onSaved }: { raw: string | undefined; onSaved: () => Promise<void> }) {
  const save = useServerFn(saveAdminGallery);
  const saved = useMemo(() => parseGallery(raw) ?? DEFAULT_GALLERY, [raw]);
  const [items, setItems] = useState<GalleryItem[]>(saved);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [newGroup, setNewGroup] = useState<GalleryGroup>("custom");
  const [newCaption, setNewCaption] = useState("");
  const [newCaptionSw, setNewCaptionSw] = useState("");

  useEffect(() => {
    setItems(saved);
    setDirty(false);
  }, [saved]);

  async function persist(next: GalleryItem[], upload?: { id: string; file: UploadFile }, message = "Gallery saved") {
    setBusy(true);
    try {
      const result = await save({
        data: {
          items: next.map((item) => ({
            id: item.id,
            src: item.src,
            group: item.group,
            caption: item.caption,
            caption_sw: item.caption_sw,
            ...(upload && upload.id === item.id ? { file: upload.file } : {}),
          })),
        },
      });
      setItems(result);
      setDirty(false);
      toast.success(message);
      await onSaved();
      return true;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
      return false;
    } finally {
      setBusy(false);
    }
  }

  function edit(id: string, patch: Partial<GalleryItem>) {
    setItems((prev) => prev.map((item) => (item.id === id ? { ...item, ...patch } : item)));
    setDirty(true);
  }

  function move(index: number, dir: -1 | 1) {
    const target = index + dir;
    if (target < 0 || target >= items.length) return;
    const next = [...items];
    const [item] = next.splice(index, 1);
    if (!item) return;
    next.splice(target, 0, item);
    void persist(next, undefined, "Order updated");
  }

  async function onReplace(id: string, e: ChangeEvent<HTMLInputElement>) {
    const file = await readImageFile(e);
    if (file) await persist(items, { id, file }, "Photo replaced");
  }

  async function onAdd(e: ChangeEvent<HTMLInputElement>) {
    const file = await readImageFile(e);
    if (!file) return;
    const id = crypto.randomUUID();
    const ok = await persist(
      [...items, { id, src: "", group: newGroup, caption: newCaption.trim(), caption_sw: newCaptionSw.trim() }],
      { id, file },
      "Photo added",
    );
    if (ok) {
      setNewCaption("");
      setNewCaptionSw("");
    }
  }

  async function onReset() {
    if (!confirm("Restore the original gallery? Photos you uploaded to the gallery will be deleted.")) return;
    setBusy(true);
    try {
      await save({ data: { reset: true, items: [] } });
      toast.success("Original gallery restored");
      await onSaved();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Reset failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-6">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h3 className="font-display text-xl text-navy">Gallery photos</h3>
          <p className="text-sm text-muted-foreground">
            Shown on the Gallery page. The first 8 also appear on the Home page.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {dirty && (
            <button type="button" disabled={busy} onClick={() => void persist(items)} className="btn-base btn-gold">
              <Save className="h-4 w-4" />
              {busy ? "Saving…" : "Save captions"}
            </button>
          )}
          <button type="button" disabled={busy} onClick={onReset} className="btn-base btn-outline-navy">
            <RotateCcw className="h-4 w-4" />
            Restore original gallery
          </button>
        </div>
      </div>

      <AdminCard hover={false} className="mb-5">
        <p className="font-semibold text-navy">Add a photo</p>
        <div className="mt-3 grid gap-3 md:grid-cols-[10rem_1fr_1fr_auto] md:items-end">
          <div>
            <label className="field-label">Group</label>
            <select className="field-input" value={newGroup} onChange={(e) => setNewGroup(e.target.value as GalleryGroup)}>
              {GALLERY_GROUPS.map((g) => (
                <option key={g} value={g}>
                  {GROUP_LABELS[g]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="field-label">Caption (English)</label>
            <input className="field-input" maxLength={200} value={newCaption} onChange={(e) => setNewCaption(e.target.value)} />
          </div>
          <div>
            <label className="field-label">Caption (Kiswahili)</label>
            <input className="field-input" maxLength={200} value={newCaptionSw} onChange={(e) => setNewCaptionSw(e.target.value)} />
          </div>
          <label className={cn("btn-base btn-navy cursor-pointer", busy && "pointer-events-none opacity-50")}>
            <ImagePlus className="h-4 w-4" />
            Choose photo
            <input type="file" accept={IMG_TYPES.join(",")} className="sr-only" onChange={onAdd} disabled={busy} />
          </label>
        </div>
      </AdminCard>

      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        {items.map((item, index) => (
          <AdminCard key={item.id} hover={false} className="flex flex-col !p-0 overflow-hidden">
            <div className="relative aspect-[4/3] bg-secondary">
              <img src={resolveSiteImage(item.src)} alt="" className="h-full w-full object-cover" />
              <span className="absolute left-3 top-3">
                <AdminBadge tone={index < 8 ? "gold" : "neutral"}>
                  #{index + 1}
                  {index < 8 ? " · on Home" : ""}
                </AdminBadge>
              </span>
            </div>
            <div className="flex flex-1 flex-col gap-3 p-4">
              <div>
                <label className="field-label">Group</label>
                <select
                  className="field-input"
                  value={item.group}
                  onChange={(e) => edit(item.id, { group: e.target.value as GalleryGroup })}
                >
                  {GALLERY_GROUPS.map((g) => (
                    <option key={g} value={g}>
                      {GROUP_LABELS[g]}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="field-label">Caption (English)</label>
                <input
                  className="field-input"
                  maxLength={200}
                  value={item.caption}
                  onChange={(e) => edit(item.id, { caption: e.target.value })}
                />
              </div>
              <div>
                <label className="field-label">Caption (Kiswahili)</label>
                <input
                  className="field-input"
                  maxLength={200}
                  value={item.caption_sw}
                  onChange={(e) => edit(item.id, { caption_sw: e.target.value })}
                />
              </div>
              <div className="mt-auto flex flex-wrap gap-2 pt-1">
                <label
                  className={cn(
                    "inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-navy px-3 py-2 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90",
                    busy && "pointer-events-none opacity-50",
                  )}
                >
                  <Upload className="h-3.5 w-3.5" />
                  Replace
                  <input
                    type="file"
                    accept={IMG_TYPES.join(",")}
                    className="sr-only"
                    onChange={(e) => void onReplace(item.id, e)}
                    disabled={busy}
                  />
                </label>
                <button
                  type="button"
                  aria-label="Move earlier"
                  disabled={busy || index === 0}
                  onClick={() => move(index, -1)}
                  className="grid h-9 w-9 place-items-center rounded-lg border border-border text-navy transition-colors hover:bg-gold-soft disabled:opacity-40"
                >
                  <ArrowUp className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  aria-label="Move later"
                  disabled={busy || index === items.length - 1}
                  onClick={() => move(index, 1)}
                  className="grid h-9 w-9 place-items-center rounded-lg border border-border text-navy transition-colors hover:bg-gold-soft disabled:opacity-40"
                >
                  <ArrowDown className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    if (confirm("Remove this photo from the gallery?")) {
                      void persist(
                        items.filter((x) => x.id !== item.id),
                        undefined,
                        "Photo removed",
                      );
                    }
                  }}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-destructive/30 px-3 py-2 text-sm font-semibold text-destructive transition-colors hover:bg-destructive/10 disabled:opacity-50"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Remove
                </button>
              </div>
            </div>
          </AdminCard>
        ))}
      </div>
      {!items.length && (
        <p className="rounded-2xl border border-dashed border-border bg-background/70 px-6 py-10 text-center text-sm text-muted-foreground">
          The gallery is empty. Add a photo above.
        </p>
      )}
    </div>
  );
}
