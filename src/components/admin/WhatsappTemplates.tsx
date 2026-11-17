import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { btn } from "@/components/admin/admin-ui";
import { TEMPLATE_KEYS, TEMPLATE_LABELS, type TemplateBook } from "@/lib/wa-template";
import { getWhatsappTemplates, saveWhatsappTemplates } from "@/lib/wa-template.functions";

/** Bilingual reply lines the owner can edit. Built-in lines are used until the column exists. */
export function WhatsappTemplates() {
  const load = useServerFn(getWhatsappTemplates);
  const save = useServerFn(saveWhatsappTemplates);
  const [book, setBook] = useState<TemplateBook | null>(null);
  const [saved, setSaved] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    load()
      .then((result) => {
        setBook(result.templates);
        setSaved(result.saved);
      })
      .catch((error) =>
        toast.error(error instanceof Error ? error.message : "Could not load replies"),
      );
  }, [load]);

  if (!book) return null;

  function update(key: keyof TemplateBook, lang: "en" | "sw", value: string) {
    setBook((current) =>
      current ? { ...current, [key]: { ...current[key], [lang]: value } } : current,
    );
  }

  return (
    <form
      className="mt-8 space-y-4 rounded-xl border border-[#E5E5E5] bg-white p-4"
      onSubmit={(event) => {
        event.preventDefault();
        if (!book) return;
        setBusy(true);
        void save({ data: book })
          .then(() => toast.success("WhatsApp replies saved"))
          .catch((error) =>
            toast.error(error instanceof Error ? error.message : "Could not save replies"),
          )
          .finally(() => setBusy(false));
      }}
    >
      <div>
        <h2 className="text-base font-semibold text-navy">WhatsApp replies</h2>
        <p className="mt-1 text-sm text-[#6B7280]">
          Placeholders: {"{name}"} {"{order_number}"} {"{amount}"} {"{tracking_link}"}. A blank
          saved line falls back to the built-in sentence.
        </p>
        {!saved && (
          <p className="mt-1 text-xs text-[#B86A00]">
            Run drizzle/migrations/0031_whatsapp_templates.sql before these edits can be stored.
          </p>
        )}
      </div>
      {TEMPLATE_KEYS.map((key) => (
        <fieldset key={key} className="grid gap-2">
          <legend className="text-sm font-semibold text-navy">{TEMPLATE_LABELS[key]}</legend>
          <label className="text-xs font-semibold text-[#6B7280]">
            English
            <textarea
              value={book[key].en}
              onChange={(event) => update(key, "en", event.target.value)}
              rows={2}
              className="mt-1 w-full rounded-lg border border-[#E5E5E5] px-3 py-2 text-sm text-navy"
            />
          </label>
          <label className="text-xs font-semibold text-[#6B7280]">
            Kiswahili
            <textarea
              value={book[key].sw}
              onChange={(event) => update(key, "sw", event.target.value)}
              rows={2}
              className="mt-1 w-full rounded-lg border border-[#E5E5E5] px-3 py-2 text-sm text-navy"
            />
          </label>
        </fieldset>
      ))}
      <button type="submit" className={btn("outline", undefined, "min-h-11")} disabled={busy}>
        {busy ? "Saving…" : "Save replies"}
      </button>
    </form>
  );
}
