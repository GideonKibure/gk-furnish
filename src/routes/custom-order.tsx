import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { ArrowRight, ImagePlus, MessageCircle, Phone, Sparkles } from "lucide-react";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/site/PageHeader";
import { Reveal } from "@/components/site/Reveal";
import { ColorImageChoices, TextChoices } from "@/components/site/SelectChoices";
import { telLink, waLink } from "@/config/site";
import { useLang } from "@/i18n/LanguageProvider";
import { STANDARD_COLORS } from "@/lib/color-swatches";
import { BED_SIZES, MATERIAL_OPTIONS } from "@/lib/order-options";
import { submitCustomOrder } from "@/lib/orders.functions";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/custom-order")({
  head: () => ({
    meta: [
      { title: "Custom Furniture Order — GK furnish" },
      {
        name: "description",
        content: "Describe the furniture you need and get a quote before any work starts.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { property: "og:title", content: "Custom Furniture Order — GK furnish" },
      { property: "og:description", content: "Furniture built to your size, material and colour." },
    ],
  }),
  component: Custom,
});

const IMG_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;

function toBase64(file: File) {
  return new Promise<string>((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(String(r.result).split(",")[1] ?? "");
    r.onerror = () => rej(r.error);
    r.readAsDataURL(file);
  });
}

function Custom() {
  const { t } = useLang();
  const nav = useNavigate();
  const send = useServerFn(submitCustomOrder);
  const [errs, setErrs] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [showExtras, setShowExtras] = useState(false);
  const [furnitureType, setFurnitureType] = useState("");
  const [color, setColor] = useState("");
  const [material, setMaterial] = useState("");
  const [bedSize, setBedSize] = useState("");
  const [neededBy, setNeededBy] = useState("");
  const bed = /\bbed\b|\bkitanda\b/i.test(furnitureType);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const v = (k: string) => String(fd.get(k) ?? "").trim();
    const f = {
      full_name: v("full_name"),
      phone: v("phone"),
      email: v("email"),
      furniture_type: v("furniture_type"),
      design_description: v("design_description"),
      preferred_dimensions: bed ? bedSize : v("preferred_dimensions"),
      preferred_material: material,
      preferred_color: color,
      needed_by: neededBy,
      budget_range: "",
      delivery_location: v("delivery_location"),
      additional_requirements: v("additional_requirements"),
      quantity: Math.max(1, Number(v("quantity")) || 1),
    };
    const file = fd.get("reference_image");
    const img = file instanceof File && file.size > 0 ? file : null;
    const x: Record<string, string> = {};
    if (!f.full_name) x["full_name"] = t.validation.nameRequired;
    if (!f.phone) x["phone"] = t.validation.phoneRequired;
    else if (!/^[+\d\s()-]{7,20}$/.test(f.phone)) x["phone"] = t.validation.phoneInvalid;
    if (!f.furniture_type) x["furniture_type"] = t.validation.typeRequired;
    if (!f.design_description) x["design_description"] = t.validation.descriptionRequired;
    if (!f.delivery_location) x["delivery_location"] = t.validation.locationRequired;
    if (!f.needed_by) x["needed_by"] = t.validation.dateRequired;
    if (bed && !f.preferred_dimensions) x["preferred_dimensions"] = t.validation.sizeRequired;
    if (f.email && !/^\S+@\S+\.\S+$/.test(f.email)) x["email"] = t.validation.emailInvalid;
    if (img && (!IMG_TYPES.includes(img.type as (typeof IMG_TYPES)[number]) || img.size > 5 * 1024 * 1024)) {
      x["reference_image"] = t.validation.imageInvalid;
    }
    setErrs(x);
    if (Object.keys(x).length) return;
    setBusy(true);
    try {
      const reference_image = img
        ? { name: img.name, type: img.type as (typeof IMG_TYPES)[number], base64: await toBase64(img) }
        : undefined;
      const r = await send({ data: { ...f, reference_image } });
      nav({
        to: "/order-success",
        search: {
          ref: r.requestNumber,
          item: r.type,
          qty: r.quantity,
          custom: true,
          name: f.full_name,
          phone: f.phone,
          email: f.email || undefined,
          color: f.preferred_color || undefined,
          size: f.preferred_dimensions || undefined,
          material: f.preferred_material || undefined,
          needed: f.needed_by,
          location: f.delivery_location,
        },
      });
    } catch {
      toast.error(t.validation.failed);
    } finally {
      setBusy(false);
    }
  }

  const fieldErr = (n: string) =>
    errs[n] ? <p className="mt-1 text-xs text-destructive">{errs[n]}</p> : null;

  return (
    <>
      <PageHeader title={t.custom.title} subtitle={t.custom.subtitle} />

      <section className="container-page pb-16 md:pb-24">
        <div className="grid gap-10 lg:grid-cols-[1fr_1.15fr] lg:gap-14">
          <Reveal variant="left" className="space-y-6">
            <div className="rounded-[1.75rem] bg-navy p-7 text-primary-foreground md:p-9">
              <p className="eyebrow !text-gold">{t.custom.howEyebrow}</p>
              <h2 className="mt-2 font-display text-3xl leading-tight">{t.custom.howTitle}</h2>
              <ol className="mt-6 space-y-4">
                {[t.custom.step1, t.custom.step2, t.custom.step3].map((step, i) => (
                  <li key={step} className="flex gap-3 text-sm text-white/80">
                    <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-gold text-xs font-bold text-navy">
                      {i + 1}
                    </span>
                    <span className="pt-1">{step}</span>
                  </li>
                ))}
              </ol>
            </div>

            <div className="rounded-[1.75rem] border border-border bg-sand/60 p-6 md:p-7">
              <p className="text-sm font-semibold text-navy">{t.custom.preferContact}</p>
              <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                <a href={waLink(t.whatsapp.general)} target="_blank" rel="noreferrer" className="btn-base btn-gold flex-1">
                  <MessageCircle className="h-4 w-4" />
                  WhatsApp
                </a>
                <a href={telLink()} className="btn-base btn-outline-navy flex-1">
                  <Phone className="h-4 w-4" />
                  {t.common.call}
                </a>
              </div>
              <p className="mt-4 text-sm text-muted-foreground">
                {t.custom.orBrowse}{" "}
                <Link to="/products" className="font-semibold text-navy underline-offset-2 hover:underline">
                  {t.nav.products}
                </Link>
              </p>
            </div>
          </Reveal>

          <Reveal variant="right">
            <form
              onSubmit={onSubmit}
              noValidate
              className="rounded-[1.75rem] border border-border bg-background p-6 shadow-[var(--shadow-card)] md:p-8"
            >
              <div className="mb-6 flex items-start gap-3">
                <span className="grid h-11 w-11 place-items-center rounded-full bg-gold text-navy">
                  <Sparkles className="h-5 w-5" />
                </span>
                <div>
                  <h2 className="font-display text-2xl text-navy">{t.custom.formTitle}</h2>
                  <p className="mt-1 text-sm text-muted-foreground">{t.custom.formIntro}</p>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <p className="mb-3 text-xs font-bold uppercase tracking-[0.14em] text-gold">{t.custom.contactSection}</p>
                </div>
                <div>
                  <label className="field-label" htmlFor="full_name">
                    {t.custom.fullName} *
                  </label>
                  <input id="full_name" name="full_name" className="field-input" autoComplete="name" />
                  {fieldErr("full_name")}
                </div>
                <div>
                  <label className="field-label" htmlFor="phone">
                    {t.custom.phone} *
                  </label>
                  <input id="phone" name="phone" type="tel" className="field-input" placeholder="+255…" autoComplete="tel" />
                  {fieldErr("phone")}
                </div>
                <div className="sm:col-span-2">
                  <label className="field-label" htmlFor="email">
                    {t.custom.email}
                  </label>
                  <input id="email" name="email" type="email" className="field-input" autoComplete="email" />
                  {fieldErr("email")}
                </div>
                <div className="sm:col-span-2">
                  <label className="field-label" htmlFor="delivery_location">
                    {t.custom.location} *
                  </label>
                  <input id="delivery_location" name="delivery_location" className="field-input" placeholder="Mbeya, hostel, street…" />
                  {fieldErr("delivery_location")}
                </div>

                <div className="sm:col-span-2 pt-2">
                  <p className="mb-3 text-xs font-bold uppercase tracking-[0.14em] text-gold">{t.custom.designSection}</p>
                </div>
                <div className="sm:col-span-2">
                  <label className="field-label" htmlFor="furniture_type">
                    {t.custom.type} *
                  </label>
                  <input
                    id="furniture_type"
                    name="furniture_type"
                    className="field-input"
                    placeholder={t.custom.typePlaceholder}
                    value={furnitureType}
                    onChange={(e) => setFurnitureType(e.target.value)}
                  />
                  {fieldErr("furniture_type")}
                </div>
                <div className="sm:col-span-2">
                  <label className="field-label" htmlFor="design_description">
                    {t.custom.description} *
                  </label>
                  <textarea
                    id="design_description"
                    name="design_description"
                    rows={4}
                    className="field-input"
                    placeholder={t.custom.descriptionPlaceholder}
                  />
                  {fieldErr("design_description")}
                </div>
                <div>
                  <label className="field-label" htmlFor="quantity">
                    {t.custom.quantity}
                  </label>
                  <input id="quantity" name="quantity" type="number" min={1} defaultValue={1} className="field-input" />
                </div>
                <div>
                  <label className="field-label" htmlFor="reference_image">
                    {t.custom.attach}
                  </label>
                  <label
                    htmlFor="reference_image"
                    className={cn(
                      "flex cursor-pointer items-center gap-2 rounded-xl border border-dashed border-border bg-sand/40 px-3 py-2.5 text-sm text-muted-foreground transition-colors hover:border-gold hover:bg-gold-soft/40",
                    )}
                  >
                    <ImagePlus className="h-4 w-4 shrink-0 text-navy" />
                    <span className="truncate">{preview ? t.custom.photoChosen : t.custom.attachHint}</span>
                  </label>
                  <input
                    id="reference_image"
                    name="reference_image"
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="sr-only"
                    onChange={(e) => {
                      const fl = e.target.files?.[0];
                      setPreview(fl ? URL.createObjectURL(fl) : null);
                    }}
                  />
                  {preview && <img src={preview} alt="" className="mt-3 h-28 w-28 rounded-xl object-cover" />}
                  {fieldErr("reference_image")}
                </div>

                {bed && (
                  <div className="sm:col-span-2">
                    <p className="field-label">{t.order.size} *</p>
                    <TextChoices
                      name="bed_size"
                      value={bedSize}
                      onChange={setBedSize}
                      options={BED_SIZES.map((value) => ({ value, label: value }))}
                    />
                    {fieldErr("preferred_dimensions")}
                  </div>
                )}
                <div className="sm:col-span-2">
                  <p className="field-label">{t.custom.material}</p>
                  <TextChoices
                    name="preferred_material"
                    value={material}
                    onChange={setMaterial}
                    options={MATERIAL_OPTIONS.map((value) => ({ value, label: value }))}
                  />
                </div>
                <div className="sm:col-span-2">
                  <p className="field-label">{t.custom.color}</p>
                  <ColorImageChoices name="preferred_color" value={color} onChange={setColor} options={[...STANDARD_COLORS]} />
                </div>
                <div className="sm:col-span-2">
                  <label className="field-label" htmlFor="needed_by">
                    {t.order.neededBy} *
                  </label>
                  <input
                    id="needed_by"
                    name="needed_by"
                    type="date"
                    min={(() => {
                      const d = new Date();
                      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
                    })()}
                    value={neededBy}
                    onChange={(e) => setNeededBy(e.target.value)}
                    className="field-input"
                  />
                  <p className="mt-1.5 text-xs text-muted-foreground">{t.order.completionNote}</p>
                  {fieldErr("needed_by")}
                </div>

                <div className="sm:col-span-2">
                  <button
                    type="button"
                    onClick={() => setShowExtras((v) => !v)}
                    className="text-sm font-semibold text-navy underline-offset-2 hover:underline"
                  >
                    {showExtras ? t.custom.hideExtras : t.custom.showExtras}
                  </button>
                </div>

                {showExtras && (
                  <>
                    {!bed && (
                      <div>
                        <label className="field-label" htmlFor="preferred_dimensions">
                          {t.custom.dimensions}
                        </label>
                        <input id="preferred_dimensions" name="preferred_dimensions" className="field-input" />
                      </div>
                    )}
                    <div className={bed ? "sm:col-span-2" : undefined}>
                      <label className="field-label" htmlFor="additional_requirements">
                        {t.custom.requirements}
                      </label>
                      <textarea id="additional_requirements" name="additional_requirements" rows={3} className="field-input" />
                    </div>
                  </>
                )}
              </div>

              <button type="submit" disabled={busy} className="btn-base btn-gold mt-6 w-full">
                {busy ? t.custom.submitting : t.custom.submit}
                {!busy && <ArrowRight className="h-4 w-4" />}
              </button>
            </form>
          </Reveal>
        </div>
      </section>
    </>
  );
}
