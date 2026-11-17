import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { btn } from "@/components/admin/admin-ui";
import { supabase } from "@/integrations/supabase/client";
import { signProductPhotoUpload, upsertAdminProduct } from "@/lib/admin.functions";
import {
  clearProductDraft,
  quickAddPayload,
  readProductDraft,
  writeProductDraft,
} from "@/lib/quick-add";

type Category = { id: string; name: string };

/** Short product form for a phone. The full form stays one tap away. */
export function QuickAddProduct({
  categories,
  onCreated,
  onMore,
}: {
  categories: Category[];
  onCreated: () => void;
  onMore: () => void;
}) {
  const save = useServerFn(upsertAdminProduct);
  const signPhoto = useServerFn(signProductPhotoUpload);
  const [name, setName] = useState("");
  const [nameSw, setNameSw] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [price, setPrice] = useState("");
  const [stock, setStock] = useState("0");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const draft = readProductDraft();
    if (!draft) return;
    setName(draft.name);
    setNameSw(draft.nameSw);
    setCategoryId(draft.categoryId);
    setPrice(draft.price);
    setStock(draft.stock);
  }, []);

  useEffect(() => {
    writeProductDraft({ name, nameSw, categoryId, price, stock });
  }, [name, nameSw, categoryId, price, stock]);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    const payload = quickAddPayload({ name, nameSw, categoryId, price, stock });
    if (!payload.ok) {
      toast.error(payload.error);
      return;
    }
    setBusy(true);
    try {
      const angle_urls: { slot: number; url: string }[] = [];
      if (file) {
        const { compressProductPhoto } = await import("@/lib/compress-photo");
        const compressed = await compressProductPhoto(file);
        const signed = await signPhoto({ data: { ext: "webp" } });
        const [fullUp, cardUp] = await Promise.all([
          supabase.storage
            .from("product-images")
            .uploadToSignedUrl(signed.full.path, signed.full.token, compressed.full, {
              contentType: "image/webp",
            }),
          supabase.storage
            .from("product-images")
            .uploadToSignedUrl(signed.card.path, signed.card.token, compressed.card, {
              contentType: "image/webp",
            }),
        ]);
        if (fullUp.error || cardUp.error)
          throw new Error(fullUp.error?.message ?? cardUp.error?.message ?? "Photo upload failed");
        angle_urls.push({ slot: 0, url: signed.publicUrl });
      }
      await save({ data: { ...payload.data, ...(angle_urls.length ? { angle_urls } : {}) } });
      clearProductDraft();
      setName("");
      setNameSw("");
      setPrice("");
      setStock("0");
      setFile(null);
      toast.success("Draft saved");
      onCreated();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save the product");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      onSubmit={(event) => void onSubmit(event)}
      className="mb-4 grid gap-3 rounded-xl border border-[#E5E5E5] bg-white p-4 lg:hidden"
    >
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-base font-semibold text-navy">Quick add</h2>
        <button type="button" className={btn("outline", "sm")} onClick={onMore}>
          Add more details
        </button>
      </div>
      <label className="text-sm font-semibold text-navy">
        Photo
        <input
          type="file"
          accept="image/*"
          className="mt-1 block w-full text-sm"
          onChange={(event) => setFile(event.target.files?.[0] ?? null)}
        />
      </label>
      <label className="text-sm font-semibold text-navy">
        Name
        <input
          value={name}
          onChange={(event) => setName(event.target.value)}
          className="mt-1 h-11 w-full rounded-lg border border-[#E5E5E5] px-3 text-sm"
        />
      </label>
      <label className="text-sm font-semibold text-navy">
        Kiswahili name (optional)
        <input
          value={nameSw}
          onChange={(event) => setNameSw(event.target.value)}
          className="mt-1 h-11 w-full rounded-lg border border-[#E5E5E5] px-3 text-sm"
        />
      </label>
      <label className="text-sm font-semibold text-navy">
        Category
        <select
          value={categoryId}
          onChange={(event) => setCategoryId(event.target.value)}
          className="mt-1 h-11 w-full rounded-lg border border-[#E5E5E5] bg-white px-3 text-sm"
        >
          <option value="">Choose</option>
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </select>
      </label>
      <label className="text-sm font-semibold text-navy">
        Price in TZS
        <input
          inputMode="numeric"
          value={price}
          onChange={(event) => setPrice(event.target.value)}
          placeholder="Leave empty to ask for the price"
          className="mt-1 h-11 w-full rounded-lg border border-[#E5E5E5] px-3 text-sm"
        />
      </label>
      <label className="text-sm font-semibold text-navy">
        Stock
        <input
          inputMode="numeric"
          value={stock}
          onChange={(event) => setStock(event.target.value)}
          className="mt-1 h-11 w-full rounded-lg border border-[#E5E5E5] px-3 text-sm"
        />
      </label>
      <button type="submit" className={btn("gold", undefined, "min-h-11")} disabled={busy}>
        {busy ? "Saving…" : "Save draft"}
      </button>
      <p className="text-xs text-[#6B7280]">
        Saved as a draft, so it stays off the shop until you publish it.
      </p>
    </form>
  );
}
