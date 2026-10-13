import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { ImagePlus, Pencil, Plus, Trash2, X } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { AdminBadge, AdminCard, AdminEmpty, AdminPageHeader } from "@/components/admin/admin-ui";
import { HexSwatch } from "@/components/site/SelectChoices";
import { formatPrice, formatPriceSpan } from "@/config/site";
import {
  deleteAdminProduct,
  listAdminCategories,
  listAdminProducts,
  signProductVideoUpload,
  updateProductStock,
  upsertAdminProduct,
} from "@/lib/admin.functions";
import { supabase } from "@/integrations/supabase/client";
import { imageFor } from "@/data/images";
import {
  encodeOptionPrices,
  joinOptionList,
  normalizeHex,
  optionPriceKey,
  optionPriceRows,
  parseCatalogColor,
  parseOptionList,
  parseOptionPrices,
  publicFeatures,
  serializeCatalogColor,
  type CatalogColor,
  type OptionPrice,
} from "@/lib/order-options";
import { PRODUCT_ANGLE_SLOTS, productImageSrc, sortedProductImages } from "@/lib/product-image";

function padFeatures(list: string[] | null | undefined) {
  const cleaned = publicFeatures(list).map((s) => s.trim()).filter(Boolean);
  if (cleaned.length >= 3) return cleaned;
  return [...cleaned, ...Array(3 - cleaned.length).fill("")];
}

async function fileToUpload(file: File) {
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type) || file.size > 5_000_000) {
    throw new Error("Use JPG/PNG/WebP under 5MB");
  }
  const buf = await file.arrayBuffer();
  const bytes = new Uint8Array(buf);
  let binary = "";
  bytes.forEach((b) => {
    binary += String.fromCharCode(b);
  });
  return {
    name: file.name,
    type: file.type as "image/jpeg" | "image/png" | "image/webp",
    base64: btoa(binary),
  };
}

type ProductRow = Awaited<ReturnType<typeof listAdminProducts>>[number];
type Cat = Awaited<ReturnType<typeof listAdminCategories>>[number];

type AngleSlotState = {
  existingUrl: string | null;
  previewUrl: string | null;
  file: File | null;
  clear: boolean;
};

function emptyVideo(): AngleSlotState {
  return { existingUrl: null, previewUrl: null, file: null, clear: false };
}

function videoFromProduct(p: ProductRow | null): AngleSlotState {
  if (!p) return emptyVideo();
  const row = sortedProductImages(p.product_images).find((item) => (item.sort_order ?? 0) === 2);
  const url = row?.image_url?.trim() || null;
  return { existingUrl: url, previewUrl: url, file: null, clear: false };
}

function emptyAngleSlots(): AngleSlotState[] {
  return PRODUCT_ANGLE_SLOTS.map(() => ({
    existingUrl: null,
    previewUrl: null,
    file: null,
    clear: false,
  }));
}

function anglesFromProduct(p: ProductRow | null): AngleSlotState[] {
  const slots = emptyAngleSlots();
  if (!p) return slots;
  const rows = sortedProductImages(p.product_images);
  for (const row of rows) {
    const order = row.sort_order ?? 0;
    if (order < 0 || order > 1) continue;
    const url = row.image_url?.trim() || (row.image_key ? imageFor(row.image_key) : null);
    slots[order] = { existingUrl: row.image_url?.trim() || null, previewUrl: url, file: null, clear: false };
  }
  if (!rows.length) {
    const url = p.image_url?.trim() || (p.image_key ? imageFor(p.image_key) : null);
    if (url) {
      slots[0] = { existingUrl: p.image_url?.trim() || null, previewUrl: url, file: null, clear: false };
    }
  }
  return slots;
}

function OptionNameList({
  label,
  hint,
  placeholder,
  rows,
  draft,
  onDraft,
  onAdd,
  onRename,
  onRemove,
}: {
  label: string;
  hint: string;
  placeholder: string;
  rows: string[];
  draft: string;
  onDraft: (value: string) => void;
  onAdd: () => void;
  onRename: (index: number, next: string) => boolean;
  onRemove: (value: string) => void;
}) {
  const [editing, setEditing] = useState<number | null>(null);
  const [text, setText] = useState("");

  function startEdit(index: number) {
    setEditing(index);
    setText(rows[index] ?? "");
  }

  function commit() {
    if (editing == null) return;
    if (onRename(editing, text)) setEditing(null);
  }

  return (
    <div className="md:col-span-2">
      <label className="field-label">{label}</label>
      <p className="mb-2 text-xs text-muted-foreground">{hint}</p>
      <div className="flex gap-2">
        <input
          className="field-input"
          value={draft}
          placeholder={placeholder}
          onChange={(e) => onDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key !== "Enter") return;
            e.preventDefault();
            onAdd();
          }}
        />
        <button type="button" className="btn-base btn-outline-navy shrink-0" onClick={onAdd}>
          Add
        </button>
      </div>
      {rows.length > 0 && (
        <ul className="mt-3 flex flex-wrap gap-2">
          {rows.map((row, index) => (
            <li key={`${row}-${index}`} className="inline-flex items-center gap-1 rounded-full border border-border bg-secondary/40 py-1 pl-3 pr-1 text-sm text-navy">
              {editing === index ? (
                <input
                  className="field-input !h-7 w-36 !px-2 !text-sm"
                  value={text}
                  autoFocus
                  onChange={(e) => setText(e.target.value)}
                  onBlur={commit}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      commit();
                    }
                    if (e.key === "Escape") setEditing(null);
                  }}
                />
              ) : (
                <span>{row}</span>
              )}
              <button
                type="button"
                className="grid h-6 w-6 place-items-center rounded-full text-muted-foreground hover:text-navy"
                onClick={() => (editing === index ? commit() : startEdit(index))}
                aria-label={`Edit ${row}`}
              >
                <Pencil className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                className="grid h-6 w-6 place-items-center rounded-full text-muted-foreground hover:text-destructive"
                onClick={() => onRemove(row)}
                aria-label={`Remove ${row}`}
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export const Route = createFileRoute("/admin/products")({
  head: () => ({ meta: [{ title: "Products — Admin" }, { name: "robots", content: "noindex" }] }),
  component: AdminProductsPage,
});

function AdminProductsPage() {
  const listProducts = useServerFn(listAdminProducts);
  const listCats = useServerFn(listAdminCategories);
  const save = useServerFn(upsertAdminProduct);
  const signVideo = useServerFn(signProductVideoUpload);
  const remove = useServerFn(deleteAdminProduct);
  const setStock = useServerFn(updateProductStock);

  const [products, setProducts] = useState<ProductRow[]>([]);
  const [cats, setCats] = useState<Cat[]>([]);
  const [editing, setEditing] = useState<ProductRow | null>(null);
  const [creating, setCreating] = useState(false);
  const [busy, setBusy] = useState(false);
  const [featureRows, setFeatureRows] = useState<string[]>(["", "", ""]);
  const [angles, setAngles] = useState<AngleSlotState[]>(emptyAngleSlots);
  const [video, setVideo] = useState<AngleSlotState>(emptyVideo);
  const [colorRows, setColorRows] = useState<CatalogColor[]>([]);
  const [draftHex, setDraftHex] = useState("#8B5A2B");
  const [draftColorName, setDraftColorName] = useState("");
  const [materialRows, setMaterialRows] = useState<string[]>([]);
  const [materialDraft, setMaterialDraft] = useState("");
  const [dimensionRows, setDimensionRows] = useState<string[]>([]);
  const [dimensionDraft, setDimensionDraft] = useState("");
  const [priceMap, setPriceMap] = useState<Record<string, string>>({});

  async function refresh() {
    const [p, c] = await Promise.all([listProducts(), listCats()]);
    setProducts(p);
    setCats(c);
  }

  useEffect(() => {
    refresh().catch((e) => toast.error(e instanceof Error ? e.message : "Load failed"));
  }, []);

  async function onStockBlur(id: string, stock: number, available: boolean) {
    try {
      await setStock({ data: { id, stock_quantity: stock, is_available: available } });
      toast.success("Stock updated");
      await refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Stock update failed");
    }
  }

  async function onDelete(id: string) {
    if (!confirm("Delete this product?")) return;
    try {
      await remove({ data: { id } });
      toast.success("Deleted");
      await refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Delete failed");
    }
  }

  function resetFormExtras(p: ProductRow | null) {
    setFeatureRows(padFeatures(p?.features));
    setAngles(anglesFromProduct(p));
    setVideo(videoFromProduct(p));
    setColorRows((p?.available_colors ?? []).map(parseCatalogColor));
    setDraftHex("#8B5A2B");
    setDraftColorName("");
    setMaterialRows(parseOptionList(p?.material));
    setMaterialDraft("");
    setDimensionRows(parseOptionList(p?.dimensions));
    setDimensionDraft("");
    const nextPrices: Record<string, string> = {};
    for (const row of parseOptionPrices(p?.features)) {
      nextPrices[optionPriceKey(row.material, row.dimension)] = String(row.price);
    }
    setPriceMap(nextPrices);
  }

  function renameOption(kind: "material" | "dimension", index: number, next: string) {
    const rows = kind === "material" ? materialRows : dimensionRows;
    const current = rows[index];
    const cleaned = next.trim();
    if (!current || !cleaned) return false;
    if (rows.some((row, i) => i !== index && row.toLowerCase() === cleaned.toLowerCase())) return false;
    if (cleaned === current) return true;
    const setRows = kind === "material" ? setMaterialRows : setDimensionRows;
    setRows(rows.map((row, i) => (i === index ? cleaned : row)));
    setPriceMap((map) => {
      const renamed: Record<string, string> = { ...map };
      for (const key of Object.keys(map)) {
        const [material = "", dimension = ""] = key.split("\u001f");
        const hit = kind === "material" ? material === current : dimension === current;
        if (!hit) continue;
        const value = map[key] ?? "";
        delete renamed[key];
        renamed[optionPriceKey(kind === "material" ? cleaned : material, kind === "dimension" ? cleaned : dimension)] = value;
      }
      return renamed;
    });
    return true;
  }

  function removeOption(kind: "material" | "dimension", value: string) {
    if (kind === "material") setMaterialRows((rows) => rows.filter((row) => row !== value));
    else setDimensionRows((rows) => rows.filter((row) => row !== value));
    setPriceMap((map) => {
      const next = { ...map };
      for (const key of Object.keys(next)) {
        const [material = "", dimension = ""] = key.split("\u001f");
        if ((kind === "material" && material === value) || (kind === "dimension" && dimension === value)) delete next[key];
      }
      return next;
    });
  }

  function openCreate() {
    setCreating(true);
    setEditing(null);
    resetFormExtras(null);
  }

  function openEdit(p: ProductRow) {
    setEditing(p);
    setCreating(false);
    resetFormExtras(p);
  }

  function closeForm() {
    setAngles((prev) => {
      prev.forEach((slot) => {
        if (slot.file && slot.previewUrl?.startsWith("blob:")) URL.revokeObjectURL(slot.previewUrl);
      });
      return emptyAngleSlots();
    });
    setVideo((prev) => {
      if (prev.file && prev.previewUrl?.startsWith("blob:")) URL.revokeObjectURL(prev.previewUrl);
      return emptyVideo();
    });
    setCreating(false);
    setEditing(null);
  }

  function setVideoFile(file: File | null) {
    setVideo((prev) => {
      if (prev.file && prev.previewUrl?.startsWith("blob:")) URL.revokeObjectURL(prev.previewUrl);
      if (!file) {
        return { existingUrl: prev.existingUrl, previewUrl: prev.clear ? null : prev.existingUrl, file: null, clear: prev.clear };
      }
      return { existingUrl: prev.existingUrl, previewUrl: URL.createObjectURL(file), file, clear: false };
    });
  }

  function clearVideo() {
    setVideo((prev) => {
      if (prev.file && prev.previewUrl?.startsWith("blob:")) URL.revokeObjectURL(prev.previewUrl);
      return { existingUrl: prev.existingUrl, previewUrl: null, file: null, clear: Boolean(prev.existingUrl) };
    });
  }

  function setAngleFile(slot: number, file: File | null) {
    setAngles((prev) =>
      prev.map((row, i) => {
        if (i !== slot) return row;
        if (row.file && row.previewUrl?.startsWith("blob:")) URL.revokeObjectURL(row.previewUrl);
        if (!file) {
          return {
            existingUrl: row.existingUrl,
            previewUrl: row.clear ? null : row.existingUrl,
            file: null,
            clear: row.clear,
          };
        }
        return {
          existingUrl: row.existingUrl,
          previewUrl: URL.createObjectURL(file),
          file,
          clear: false,
        };
      }),
    );
  }

  function clearAngle(slot: number) {
    setAngles((prev) =>
      prev.map((row, i) => {
        if (i !== slot) return row;
        if (row.file && row.previewUrl?.startsWith("blob:")) URL.revokeObjectURL(row.previewUrl);
        return {
          existingUrl: row.existingUrl,
          previewUrl: null,
          file: null,
          clear: Boolean(row.existingUrl),
        };
      }),
    );
  }

  async function onSave(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const basePrice = Number(fd.get("price") || 0);
    const optionPrices: OptionPrice[] = [];
    const cell = (material: string, dimension: string) => {
      const raw = priceMap[optionPriceKey(material, dimension)];
      if (raw == null || raw.trim() === "") return basePrice;
      const amount = Number(raw);
      return Number.isFinite(amount) && amount >= 0 ? amount : basePrice;
    };
    if (materialRows.length && dimensionRows.length) {
      for (const material of materialRows) {
        for (const dimension of dimensionRows) optionPrices.push({ material, dimension, price: cell(material, dimension) });
      }
    } else if (materialRows.length) {
      for (const material of materialRows) optionPrices.push({ material, dimension: "", price: cell(material, "") });
    } else if (dimensionRows.length) {
      for (const dimension of dimensionRows) optionPrices.push({ material: "", dimension, price: cell("", dimension) });
    }
    const features = [...featureRows.map((s) => s.trim()).filter(Boolean), ...encodeOptionPrices(optionPrices)];
    const colors = colorRows.map((color) => color.stored);

    try {
      const angle_uploads: { slot: number; file: Awaited<ReturnType<typeof fileToUpload>> }[] = [];
      for (let slot = 0; slot < angles.length; slot++) {
        const a = angles[slot];
        if (!a?.file) continue;
        angle_uploads.push({ slot, file: await fileToUpload(a.file) });
      }
      const clear_angle_slots = angles
        .map((a, slot) => (a?.clear && !a.file ? slot : -1))
        .filter((slot) => slot >= 0);

      let video_url = "";
      if (video.file) {
        if (!["video/mp4", "video/webm"].includes(video.file.type) || video.file.size > 20_000_000) {
          throw new Error("Use an MP4 or WebM video under 20MB");
        }
        const ext = video.file.type === "video/webm" ? "webm" : "mp4";
        const signed = await signVideo({ data: { ext } });
        const { error: upErr } = await supabase.storage
          .from("product-images")
          .uploadToSignedUrl(signed.path, signed.token, video.file, { contentType: video.file.type });
        if (upErr) throw new Error(upErr.message);
        video_url = signed.publicUrl;
      }

      setBusy(true);
      await save({
        data: {
          id: editing?.id,
          category_id: String(fd.get("category_id")),
          name: String(fd.get("name")),
          name_sw: String(fd.get("name_sw") ?? ""),
          slug: String(fd.get("slug") ?? ""),
          description: String(fd.get("description") ?? ""),
          description_sw: String(fd.get("description_sw") ?? ""),
          short_description: String(fd.get("short_description") ?? ""),
          price: Number(fd.get("price") || 0),
          material: joinOptionList(materialRows),
          dimensions: joinOptionList(dimensionRows),
          features,
          available_colors: colors,
          stock_quantity: Number(fd.get("stock_quantity") || 0),
          is_available: fd.get("is_available") === "on",
          is_featured: fd.get("is_featured") === "on",
          image_key: String(fd.get("image_key") ?? ""),
          angle_uploads: angle_uploads.length ? angle_uploads : undefined,
          clear_angle_slots: clear_angle_slots.length ? clear_angle_slots : undefined,
          video_url,
          clear_video: Boolean(video.clear && !video.file),
        },
      });
      toast.success(editing ? "Product updated" : "Product created");
      closeForm();
      await refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Save failed");
    } finally {
      setBusy(false);
    }
  }

  const formOpen = creating || editing;

  return (
    <div>
      <AdminPageHeader
        title="Products"
        description="Add, edit, stock and remove catalogue items — including three view-angle photos."
        action={
          <button type="button" className="btn-base btn-gold" onClick={openCreate}>
            Add product
          </button>
        }
      />

      {formOpen && (
        <AdminCard hover={false} className="mb-6 grid gap-3 md:grid-cols-2">
          <form onSubmit={onSave} className="contents">
            <h2 className="font-display text-xl text-navy md:col-span-2">
              {editing ? "Edit product" : "New product"}
            </h2>
            <div>
              <label className="field-label">Name (EN) *</label>
              <input name="name" required className="field-input" defaultValue={editing?.name ?? ""} />
            </div>
            <div>
              <label className="field-label">Name (SW)</label>
              <input name="name_sw" className="field-input" defaultValue={editing?.name_sw ?? ""} />
            </div>
            <div>
              <label className="field-label">Slug</label>
              <input name="slug" className="field-input" placeholder="auto from name" defaultValue={editing?.slug ?? ""} />
            </div>
            <div>
              <label className="field-label">Category *</label>
              <select
                name="category_id"
                required
                className="field-input"
                defaultValue={editing?.category_id ?? cats[0]?.id}
              >
                {cats.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="field-label">Price (TZS) *</label>
              <input
                name="price"
                type="number"
                min={0}
                step={100}
                required
                className="field-input"
                defaultValue={editing?.price ?? 0}
              />
            </div>
            <div>
              <label className="field-label">Stock *</label>
              <input
                name="stock_quantity"
                type="number"
                min={0}
                required
                className="field-input"
                defaultValue={editing?.stock_quantity ?? 0}
              />
            </div>
            <OptionNameList
              label="Materials customers can choose"
              hint="Add, rename or remove each material. Prices for every size are set below."
              placeholder="e.g. Hardwood"
              rows={materialRows}
              draft={materialDraft}
              onDraft={setMaterialDraft}
              onAdd={() => {
                const next = materialDraft.trim();
                if (!next || materialRows.some((row) => row.toLowerCase() === next.toLowerCase())) return;
                setMaterialRows((list) => [...list, next]);
                setMaterialDraft("");
              }}
              onRename={(index, next) => renameOption("material", index, next)}
              onRemove={(value) => removeOption("material", value)}
            />
            <OptionNameList
              label="Dimensions customers can choose"
              hint="Add, rename or remove each size, for example 4ft x 6ft."
              placeholder="e.g. 5ft x 6ft"
              rows={dimensionRows}
              draft={dimensionDraft}
              onDraft={setDimensionDraft}
              onAdd={() => {
                const next = dimensionDraft.trim();
                if (!next || dimensionRows.some((row) => row.toLowerCase() === next.toLowerCase())) return;
                setDimensionRows((list) => [...list, next]);
                setDimensionDraft("");
              }}
              onRename={(index, next) => renameOption("dimension", index, next)}
              onRemove={(value) => removeOption("dimension", value)}
            />
            {(materialRows.length > 0 || dimensionRows.length > 0) && (
              <div className="md:col-span-2">
                <label className="field-label">Price for each material and size</label>
                <p className="mb-2 text-xs text-muted-foreground">
                  Each material paired with each size has its own price. Empty cells use the product price above.
                </p>
                <div className="overflow-x-auto rounded-xl border border-border">
                  <table className="w-full min-w-[20rem] text-sm">
                    <thead>
                      <tr className="bg-secondary/50 text-left">
                        {materialRows.length > 0 && <th className="p-2 font-medium text-navy">Material</th>}
                        {(dimensionRows.length ? dimensionRows : [""]).map((dimension) => (
                          <th key={dimension || "price"} className="p-2 font-medium text-navy">
                            {dimension || "Price (TZS)"}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {(materialRows.length ? materialRows : [""]).map((material) => (
                        <tr key={material || "price-row"} className="border-t border-border">
                          {materialRows.length > 0 && <td className="p-2 font-medium text-navy">{material}</td>}
                          {(dimensionRows.length ? dimensionRows : [""]).map((dimension) => {
                            const key = optionPriceKey(material, dimension);
                            return (
                              <td key={key} className="p-2">
                                <input
                                  type="number"
                                  min={0}
                                  step={100}
                                  className="field-input !h-9 min-w-28"
                                  placeholder={String(editing?.price ?? 0)}
                                  value={priceMap[key] ?? ""}
                                  onChange={(e) => setPriceMap((map) => ({ ...map, [key]: e.target.value }))}
                                  aria-label={`Price for ${[material, dimension].filter(Boolean).join(" and ") || "this option"}`}
                                />
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
            <div className="md:col-span-2">
              <label className="field-label">Short description</label>
              <input
                name="short_description"
                className="field-input"
                defaultValue={editing?.short_description ?? ""}
              />
            </div>
            <div>
              <label className="field-label">Description (EN)</label>
              <textarea name="description" rows={3} className="field-input" defaultValue={editing?.description ?? ""} />
            </div>
            <div>
              <label className="field-label">Description (SW)</label>
              <textarea
                name="description_sw"
                rows={3}
                className="field-input"
                defaultValue={editing?.description_sw ?? ""}
              />
            </div>
            <div className="md:col-span-2">
              <div className="mb-2 flex items-center justify-between gap-2">
                <label className="field-label !mb-0">Unique features</label>
                <button
                  type="button"
                  className="inline-flex items-center gap-1 text-xs font-semibold text-navy underline-offset-2 hover:underline"
                  onClick={() => setFeatureRows((rows) => [...rows, ""])}
                >
                  <Plus className="h-3.5 w-3.5" />
                  Add feature
                </button>
              </div>
              <p className="mb-3 text-xs text-muted-foreground">
                Start with three highlights — add or remove as needed. Shown as feature cards on the product page.
              </p>
              <div className="space-y-2">
                {featureRows.map((row, i) => (
                  <div key={i} className="flex gap-2">
                    <span className="grid h-10 w-8 shrink-0 place-items-center rounded-lg bg-secondary text-xs font-bold text-navy">
                      {i + 1}
                    </span>
                    <input
                      className="field-input"
                      value={row}
                      placeholder={
                        i === 0
                          ? "e.g. Solid hardwood frame"
                          : i === 1
                            ? "e.g. Fits hostel rooms"
                            : i === 2
                              ? "e.g. Easy to assemble"
                              : "Another unique feature"
                      }
                      onChange={(e) =>
                        setFeatureRows((rows) => rows.map((r, idx) => (idx === i ? e.target.value : r)))
                      }
                    />
                    <button
                      type="button"
                      className="grid h-10 w-10 shrink-0 place-items-center rounded-lg border border-border text-muted-foreground hover:border-destructive/40 hover:text-destructive"
                      onClick={() =>
                        setFeatureRows((rows) => (rows.length <= 1 ? [""] : rows.filter((_, idx) => idx !== i)))
                      }
                      aria-label="Remove feature"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
            <div className="md:col-span-2">
              <label className="field-label">Colours customers can choose</label>
              <p className="mb-3 text-xs text-muted-foreground">
                Pick a colour from the hexagon, or type a hex code, then add it to this product.
              </p>
              <div className="flex flex-wrap items-end gap-3">
                <label className="relative grid h-14 w-14 cursor-pointer place-items-center">
                  <HexSwatch hex={normalizeHex(draftHex) ?? "#8B5A2B"} className="h-14 w-14" />
                  <input
                    type="color"
                    value={normalizeHex(draftHex) ?? "#8B5A2B"}
                    onChange={(e) => setDraftHex(e.target.value.toUpperCase())}
                    className="absolute inset-0 cursor-pointer opacity-0"
                    aria-label="Choose a hex colour"
                  />
                </label>
                <div>
                  <label className="field-label" htmlFor="color-hex">Hex</label>
                  <input
                    id="color-hex"
                    className="field-input w-32 font-mono uppercase"
                    value={draftHex}
                    onChange={(e) => setDraftHex(e.target.value)}
                    placeholder="#8B5A2B"
                  />
                </div>
                <div>
                  <label className="field-label" htmlFor="color-name">Name (optional)</label>
                  <input
                    id="color-name"
                    className="field-input w-40"
                    value={draftColorName}
                    onChange={(e) => setDraftColorName(e.target.value)}
                    placeholder="Walnut"
                  />
                </div>
                <button
                  type="button"
                  className="btn-base btn-outline-navy"
                  onClick={() => {
                    const stored = serializeCatalogColor(draftHex, draftColorName);
                    if (!stored) {
                      toast.error("Enter a hex colour like #8B5A2B");
                      return;
                    }
                    if (colorRows.some((row) => row.stored.toLowerCase() === stored.toLowerCase())) return;
                    setColorRows((rows) => [...rows, parseCatalogColor(stored)]);
                    setDraftColorName("");
                  }}
                >
                  Add colour
                </button>
              </div>
              {colorRows.length > 0 && (
                <ul className="mt-4 flex flex-wrap gap-3">
                  {colorRows.map((row) => (
                    <li key={row.stored} className="flex items-center gap-2 rounded-xl border border-border bg-background px-2 py-2">
                      <HexSwatch hex={row.hex} label={row.label} />
                      <span className="text-sm text-navy">
                        {row.label}
                        {row.hex && row.label !== row.hex && (
                          <span className="mt-0.5 block font-mono text-[0.65rem] text-muted-foreground">{row.hex}</span>
                        )}
                      </span>
                      <button
                        type="button"
                        className="grid h-7 w-7 place-items-center rounded-full text-muted-foreground hover:text-destructive"
                        onClick={() => setColorRows((rows) => rows.filter((item) => item.stored !== row.stored))}
                        aria-label={`Remove ${row.label}`}
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="md:col-span-2">
              <label className="field-label">Bundled image key (fallback)</label>
              <input
                name="image_key"
                className="field-input max-w-md"
                placeholder="chairs, tables…"
                defaultValue={editing?.image_key ?? ""}
              />
            </div>

            <div className="md:col-span-2">
              <label className="field-label">Product photos</label>
              <p className="mb-3 text-xs text-muted-foreground">
                Add two photos and one video. Photos: JPG, PNG or WebP · max 5MB each.
              </p>
              <div className="grid gap-3 sm:grid-cols-3">
                {PRODUCT_ANGLE_SLOTS.map((meta, slot) => {
                  const a = angles[slot] ?? emptyAngleSlots()[slot]!;
                  const shown = a.previewUrl;
                  return (
                    <div
                      key={meta.order}
                      className="overflow-hidden rounded-2xl border border-border/80 bg-secondary/30 transition-colors hover:border-gold/35"
                    >
                      <div className="relative aspect-[4/5] bg-background">
                        {shown ? (
                          <img src={shown} alt="" className="h-full w-full object-cover" />
                        ) : (
                          <div className="grid h-full place-items-center text-muted-foreground">
                            <span className="inline-flex flex-col items-center gap-2 text-xs">
                              <ImagePlus className="h-6 w-6 opacity-50" />
                              No photo
                            </span>
                          </div>
                        )}
                        {shown && (
                          <button
                            type="button"
                            onClick={() => clearAngle(slot)}
                            className="absolute right-2 top-2 grid h-8 w-8 place-items-center rounded-full bg-navy/80 text-white transition-colors hover:bg-destructive"
                            aria-label={`Remove ${meta.label}`}
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                      <div className="space-y-2 p-3">
                        <div>
                          <p className="text-sm font-semibold text-navy">{meta.label}</p>
                          <p className="text-[0.7rem] text-muted-foreground">{meta.hint}</p>
                        </div>
                        <label className="btn-base btn-outline-navy !h-9 w-full cursor-pointer text-xs">
                          {shown ? "Replace" : "Upload"}
                          <input
                            type="file"
                            accept="image/jpeg,image/png,image/webp"
                            className="sr-only"
                            onChange={(e) => setAngleFile(slot, e.target.files?.[0] ?? null)}
                          />
                        </label>
                      </div>
                    </div>
                  );
                })}
                <div className="overflow-hidden rounded-2xl border border-border/80 bg-secondary/30 transition-colors hover:border-gold/35">
                  <div className="relative aspect-[4/5] bg-background">
                    {video.previewUrl ? (
                      <video src={video.previewUrl} muted playsInline controls className="h-full w-full object-cover" />
                    ) : (
                      <div className="grid h-full place-items-center text-muted-foreground">
                        <span className="inline-flex flex-col items-center gap-2 text-xs">
                          <ImagePlus className="h-6 w-6 opacity-50" />
                          No video
                        </span>
                      </div>
                    )}
                    {video.previewUrl && (
                      <button
                        type="button"
                        onClick={clearVideo}
                        className="absolute right-2 top-2 grid h-8 w-8 place-items-center rounded-full bg-navy/80 text-white transition-colors hover:bg-destructive"
                        aria-label="Remove video"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                  <div className="space-y-2 p-3">
                    <div>
                      <p className="text-sm font-semibold text-navy">Product video</p>
                      <p className="text-[0.7rem] text-muted-foreground">Loops when the product card is on screen. MP4 or WebM · max 20MB.</p>
                    </div>
                    <label className="btn-base btn-outline-navy !h-9 w-full cursor-pointer text-xs">
                      {video.previewUrl ? "Replace" : "Upload"}
                      <input
                        type="file"
                        accept="video/mp4,video/webm"
                        className="sr-only"
                        onChange={(e) => setVideoFile(e.target.files?.[0] ?? null)}
                      />
                    </label>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-6 md:col-span-2">
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" name="is_available" defaultChecked={editing?.is_available ?? true} /> Available
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" name="is_featured" defaultChecked={editing?.is_featured ?? false} /> Featured
              </label>
            </div>
            <div className="flex gap-2 md:col-span-2">
              <button type="submit" className="btn-base btn-gold" disabled={busy}>
                {busy ? "Saving…" : "Save"}
              </button>
              <button type="button" className="btn-base btn-outline-navy" onClick={closeForm}>
                Cancel
              </button>
            </div>
          </form>
        </AdminCard>
      )}

      {!products.length ? (
        <AdminEmpty>No products yet. Add your first catalogue item.</AdminEmpty>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-border/80 bg-background shadow-[var(--shadow-card)]">
          <table className="w-full min-w-[800px] text-left text-sm">
            <thead className="border-b border-border/80 bg-secondary/50 text-[0.7rem] font-bold uppercase tracking-[0.12em] text-muted-foreground">
              <tr>
                <th className="p-4">Product</th>
                <th className="p-4">Photos</th>
                <th className="p-4">Price</th>
                <th className="p-4">Stock</th>
                <th className="p-4">Status</th>
                <th className="p-4">Actions</th>
              </tr>
            </thead>
            <tbody>
              {products.map((p) => {
                const angleCount = sortedProductImages(p.product_images).filter(
                  (r) => r.image_url && (r.sort_order ?? 0) <= 1,
                ).length;
                const hasVideo = sortedProductImages(p.product_images).some(
                  (r) => r.image_url && (r.sort_order ?? 0) === 2,
                );
                return (
                  <tr key={p.id} className="border-b border-border/60 transition-colors hover:bg-secondary/35">
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        <img
                          src={productImageSrc(p)}
                          alt=""
                          className="h-12 w-12 rounded-xl object-cover ring-1 ring-border/60"
                        />
                        <div>
                          <p className="font-medium text-navy">{p.name}</p>
                          <p className="text-xs text-muted-foreground">{p.slug}</p>
                        </div>
                      </div>
                    </td>
                    <td className="p-4">
                      <AdminBadge tone={angleCount >= 2 ? "success" : angleCount > 0 ? "gold" : "neutral"}>
                        {angleCount}/2 photos{hasVideo ? " · video" : ""}
                      </AdminBadge>
                    </td>
                    <td className="p-4 font-medium text-navy">
                      {formatPriceSpan(optionPriceRows(p).map((row) => row.price)) ?? formatPrice(p.price) ?? "—"}
                    </td>
                    <td className="p-4">
                      <input
                        type="number"
                        min={0}
                        className="field-input !h-9 w-24"
                        defaultValue={p.stock_quantity}
                        onBlur={(e) =>
                          onStockBlur(p.id, Math.max(0, Number(e.target.value) || 0), p.is_available)
                        }
                      />
                    </td>
                    <td className="p-4">
                      <AdminBadge tone={p.is_available ? "gold" : "neutral"}>
                        {p.is_available ? "Available" : "Unavailable"}
                      </AdminBadge>
                    </td>
                    <td className="p-4">
                      <div className="flex gap-2">
                        <button
                          type="button"
                          className="rounded-lg border border-border px-3 py-1.5 text-sm font-semibold text-navy transition-colors hover:border-gold/40 hover:bg-gold-soft"
                          onClick={() => openEdit(p)}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          className="rounded-lg border border-destructive/30 px-3 py-1.5 text-sm font-semibold text-destructive transition-colors hover:bg-destructive/10"
                          onClick={() => onDelete(p.id)}
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
