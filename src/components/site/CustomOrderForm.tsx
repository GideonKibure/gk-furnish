import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { ImagePlus, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Honeypot } from "@/components/site/Honeypot";
import { PhoneField } from "@/components/site/PhoneField";
import { ColorImageChoices, TextChoices } from "@/components/site/SelectChoices";
import { WhatsAppOrderLink } from "@/components/site/WhatsAppOrderLink";
import { formatPrice } from "@/config/site";
import { useAuthUser } from "@/hooks/use-auth";
import { sessionContact } from "@/hooks/use-customer-name";
import { getMyProfile } from "@/lib/account.functions";
import { compressProductPhoto } from "@/lib/compress-photo";
import { parseCustomDraft, serialiseCustomDraft, moveCustomStep, type CustomDraft } from "@/lib/custom-draft";
import { REFERENCE_BYTE_LIMIT } from "@/lib/form-timing";
import { fill } from "@/i18n/fill";
import { useLang } from "@/i18n/LanguageProvider";
import { STANDARD_COLORS } from "@/lib/color-swatches";
import { productsQuery } from "@/lib/catalog";
import { MATERIAL_OPTIONS, packPreference } from "@/lib/order-options";
import { submitCustomOrder } from "@/lib/orders.functions";
import { normaliseTzMobile } from "@/lib/phone-tz";
import { absoluteUrl } from "@/lib/seo";
import { whatsAppOrderText } from "@/lib/whatsapp";

const DRAFT_KEY = "gk-custom-draft";
const PHOTO_KEY = "gk-custom-draft-photos";
const TYPES = ["typeChair", "typeTable", "typeBed", "typeSofa", "typeShelf", "typeDesk", "typeCupboard", "typeLamp"] as const;
const BUDGETS = [
  { id: "under", label: "budgetUnder" as const, amount: 100_000 },
  { id: "mid", label: "budgetBetween" as const, min: 100_000, max: 300_000 },
  { id: "high", label: "budgetBetween" as const, min: 300_000, max: 700_000 },
  { id: "over", label: "budgetOver" as const, amount: 700_000 },
];

type Photo = { name: string; url: string; blob: Blob };

function emptyDraft(): CustomDraft {
  return {
    step: 1,
    furnitureType: "",
    description: "",
    quantity: "1",
    dimensions: "",
    materialNote: "",
    colorNote: "",
    materials: [],
    colors: [],
    budget: "",
    neededBy: "",
    finish: "",
    requirements: "",
    fullName: "",
    phone: "",
    email: "",
    location: "",
    startedAt: Date.now(),
  };
}

function blobToDataUrl(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

function dataUrlToBlob(data: string) {
  const match = data.match(/^data:([^;]+);base64,(.+)$/);
  const mime = match?.[1];
  const body = match?.[2];
  if (!mime || !body) return null;
  const bytes = Uint8Array.from(atob(body), (char) => char.charCodeAt(0));
  return new Blob([bytes], { type: mime });
}
function blobToBase64(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1] ?? "");
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

function bytesLabel(total: number) {
  if (total <= 0) return "0 KB";
  if (total < 1_000_000) return `${Math.max(1, Math.round(total / 1000))} KB`;
  return `${(total / 1_000_000).toFixed(1)} MB`;
}

/** Four short steps. The saved request uses the same fields as before. */
export function CustomOrderForm({ productSlug }: { productSlug?: string }) {
  const { t } = useLang();
  const { user } = useAuthUser();
  const heading = useRef<HTMLHeadingElement>(null);
  const named = useRef(false);
  const send = useServerFn(submitCustomOrder);
  const loadProfile = useServerFn(getMyProfile);
  const { data: catalogue = [] } = useQuery({ ...productsQuery, enabled: Boolean(productSlug) });
  const { data: profile } = useQuery({
    queryKey: ["my-profile", user?.id],
    queryFn: () => loadProfile(),
    enabled: Boolean(user),
    staleTime: 5 * 60_000,
  });
  const [draft, setDraft] = useState<CustomDraft>(emptyDraft);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [errs, setErrs] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState<{ number: string; token: string | null } | null>(null);
  const ready = useRef(false);

  useEffect(() => {
    try {
      const saved = parseCustomDraft(sessionStorage.getItem(DRAFT_KEY));
      if (saved) setDraft(saved);
      const rawPhotos = sessionStorage.getItem(PHOTO_KEY);
      if (rawPhotos) {
        const stored = JSON.parse(rawPhotos) as { name: string; data: string }[];
        if (Array.isArray(stored)) {
          const restored = stored.slice(0, 3).flatMap((photo) => {
            if (!photo.data?.startsWith("data:")) return [];
            const blob = dataUrlToBlob(photo.data);
            return blob ? [{ name: photo.name || "photo", url: URL.createObjectURL(blob), blob }] : [];
          });
          if (restored.length) setPhotos(restored);
        }
      }
    } catch {
      /* the form still works without the saved copy */
    }
    ready.current = true;
  }, []);

  useEffect(() => {
    if (!ready.current || sent) return;
    try {
      sessionStorage.setItem(DRAFT_KEY, serialiseCustomDraft(draft));
    } catch {
      /* a full browser store must not block the request */
    }
  }, [draft, sent]);

  useEffect(() => {
    if (!ready.current || sent) return;
    void (async () => {
      try {
        const packed = await Promise.all(photos.map(async (photo) => ({ name: photo.name, data: await blobToDataUrl(photo.blob) })));
        sessionStorage.setItem(PHOTO_KEY, JSON.stringify(packed));
      } catch {
        try {
          sessionStorage.removeItem(PHOTO_KEY);
        } catch {
          /* the text draft is enough */
        }
      }
    })();
  }, [photos, sent]);

  useEffect(() => {
    if (!ready.current) return;
    heading.current?.focus();
  }, [draft.step]);

  useEffect(() => {
    if (named.current || !productSlug) return;
    const match = catalogue.find((item) => item.slug === productSlug);
    if (!match) return;
    named.current = true;
    setDraft((current) => (current.furnitureType ? current : { ...current, furnitureType: match.name }));
  }, [catalogue, productSlug]);

  useEffect(() => {
    if (!user) return;
    const session = sessionContact(user);
    setDraft((current) => ({
      ...current,
      fullName: current.fullName || profile?.full_name?.trim() || session.name,
      phone: current.phone || profile?.phone?.trim() || session.phone,
      email: current.email || profile?.email?.trim() || session.email,
      location: current.location || profile?.default_location?.trim() || "",
    }));
  }, [user, profile]);

  const labels = [t.custom.wizardWhat, t.custom.wizardSize, t.custom.wizardPhotos, t.custom.wizardContact];
  const typeLabels = [
    t.custom.typeChair,
    t.custom.typeTable,
    t.custom.typeBed,
    t.custom.typeSofa,
    t.custom.typeShelf,
    t.custom.typeDesk,
    t.custom.typeCupboard,
    t.custom.typeLamp,
  ];
  const photoBytes = photos.reduce((sum, photo) => sum + photo.blob.size, 0);

  function set<K extends keyof CustomDraft>(key: K, value: CustomDraft[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  function validate(step: CustomDraft["step"]) {
    const next: Record<string, string> = {};
    if (step === 1) {
      if (!draft.furnitureType.trim()) next["furnitureType"] = t.validation.typeRequired;
      if (!draft.description.trim()) next["description"] = t.validation.descriptionRequired;
      const qty = Number(draft.quantity);
      if (!Number.isInteger(qty) || qty < 1) next["quantity"] = t.validation.quantityInvalid;
    }
    if (step === 3 && photoBytes > REFERENCE_BYTE_LIMIT) next["photos"] = t.validation.photosTooBig;
    if (step === 4) {
      if (!draft.fullName.trim()) next["fullName"] = t.validation.nameRequired;
      if (!draft.phone.trim()) next["phone"] = t.validation.phoneRequired;
      else if (!normaliseTzMobile(draft.phone)) next["phone"] = t.validation.phoneInvalid;
      if (!draft.location.trim()) next["location"] = t.validation.locationRequired;
      if (draft.email.trim() && !/^\S+@\S+\.\S+$/.test(draft.email.trim())) next["email"] = t.validation.emailInvalid;
    }
    setErrs(next);
    return Object.keys(next).length === 0;
  }

  async function addPhotos(list: FileList | null) {
    if (!list) return;
    const next = [...photos];
    for (const file of list) {
      if (next.length >= 3) break;
      try {
        const compressed = await compressProductPhoto(file);
        next.push({ name: file.name, url: URL.createObjectURL(compressed.full), blob: compressed.full });
      } catch {
        setErrs({ photos: t.validation.imageInvalid });
      }
    }
    setPhotos(next);
  }

  async function submit() {
    if (!validate(4) || busy) return;
    const phone = normaliseTzMobile(draft.phone);
    if (!phone) return;
    setBusy(true);
    try {
      const packed = await Promise.all(
        photos.map(async (photo) => ({
          name: "reference.webp",
          type: "image/webp" as const,
          base64: await blobToBase64(photo.blob),
        })),
      );
      const website = (document.getElementById("company_website") as HTMLInputElement | null)?.value ?? "";
      const sentOrder = await send({
        data: {
          full_name: draft.fullName.trim(),
          phone,
          email: draft.email.trim(),
          furniture_type: draft.furnitureType.trim().slice(0, 100),
          design_description: draft.description.trim(),
          preferred_dimensions: draft.dimensions.trim(),
          preferred_material: packPreference(draft.materials, draft.materialNote),
          preferred_color: packPreference(draft.colors, draft.colorNote),
          needed_by: draft.neededBy,
          quantity: Math.max(1, Number(draft.quantity) || 1),
          budget: draft.budget,
          finish: draft.finish.trim(),
          delivery_location: draft.location.trim(),
          additional_requirements: draft.requirements.trim(),
          company_website: website,
          started_at: draft.startedAt,
          ...(packed[0] ? { reference_image: packed[0] } : {}),
          ...(packed[1] ? { finish_image: packed[1] } : {}),
          ...(packed[2] ? { extra_image: packed[2] } : {}),
        },
      });
      try {
        sessionStorage.removeItem(DRAFT_KEY);
        sessionStorage.removeItem(PHOTO_KEY);
      } catch {
        /* the success screen still shows */
      }
      setSent({ number: sentOrder.requestNumber, token: sentOrder.trackingToken });
    } catch (err) {
      const message = err instanceof Error ? err.message : "";
      toast.error(message.includes("few minutes") ? t.validation.slowDown : t.validation.failed);
    } finally {
      setBusy(false);
    }
  }

  if (sent) {
    return (
      <div className="kpi-card !p-5 md:!p-7">
        <h2 ref={heading} tabIndex={-1} className="font-display text-xl font-bold text-navy outline-none">
          {t.success.customTitle}
        </h2>
        <p className="mt-2 text-sm text-navy">{fill(t.whatsapp.askSent, { number: sent.number })}</p>
        <h3 className="mt-4 text-sm font-bold text-navy">{t.custom.nextTitle}</h3>
        <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-navy">
          <li>{t.custom.nextReview}</li>
          <li>{t.custom.nextQuote}</li>
          <li>{t.custom.nextAdvance}</li>
          <li>{t.custom.nextBuild}</li>
        </ol>
        <div className="mt-4 flex flex-col gap-2">
          <WhatsAppOrderLink
            source="custom"
            text={whatsAppOrderText([t.whatsapp.customIntro, draft.furnitureType, sent.number, absoluteUrl("/custom-order")])}
            className="btn-base btn-outline-navy min-h-11 w-full"
          >
            {t.whatsapp.orderButton}
          </WhatsAppOrderLink>
          {sent.token ? (
            <Link to="/track/$token" params={{ token: sent.token }} className="btn-base btn-gold min-h-11 w-full">
              {t.success.reference}
            </Link>
          ) : (
            <Link to="/products" className="btn-base btn-gold min-h-11 w-full">
              {t.cart.askKeep}
            </Link>
          )}
        </div>
      </div>
    );
  }

  const invalid = (name: string) =>
    errs[name] ? { "aria-invalid": true as const, "aria-describedby": `custom-${name}-error` } : {};
  const message = (name: string) =>
    errs[name] ? (
      <p id={`custom-${name}-error`} className="field-error">
        {errs[name]}
      </p>
    ) : null;

  return (
    <form
      className="kpi-card relative !p-5 md:!p-7"
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        if (draft.step < 4) {
          if (validate(draft.step)) set("step", moveCustomStep(draft.step, "next"));
          return;
        }
        void submit();
      }}
    >
      <Honeypot />
      <h2 ref={heading} tabIndex={-1} className="font-display text-xl font-bold text-navy outline-none">
        {labels[draft.step - 1]}
      </h2>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-sand" aria-hidden>
        <div className="h-full bg-gold" style={{ width: `${draft.step * 25}%` }} />
      </div>
      <ol className="mt-3 flex flex-wrap gap-2 text-xs font-semibold text-muted-foreground">
        {labels.map((label, index) => (
          <li key={label} className={index + 1 === draft.step ? "text-navy" : undefined}>
            {index + 1}. {label}
          </li>
        ))}
      </ol>

      {draft.step === 1 && (
        <div className="mt-4 space-y-3">
          <p className="text-sm text-navy">{t.custom.schoolExample}</p>
          <div className="flex flex-wrap gap-2">
            {typeLabels.map((label, index) => (
              <button
                key={TYPES[index]}
                type="button"
                aria-pressed={draft.furnitureType === label}
                className={draft.furnitureType === label ? "btn-base min-h-11 border-2 border-gold bg-white px-3 text-navy" : "btn-base min-h-11 border border-[#E5E5E5] bg-white px-3 text-navy"}
                onClick={() => set("furnitureType", label)}
              >
                {label}
              </button>
            ))}
          </div>
          <div>
            <label className="field-label" htmlFor="furniture-type">{t.custom.type} *</label>
            <input id="furniture-type" className="field-input" enterKeyHint="next" value={draft.furnitureType} {...invalid("furnitureType")} onChange={(event) => set("furnitureType", event.target.value)} />
            {message("furnitureType")}
          </div>
          <div>
            <label className="field-label" htmlFor="design-description">{t.custom.description} *</label>
            <textarea id="design-description" rows={4} className="field-input" enterKeyHint="next" value={draft.description} {...invalid("description")} onChange={(event) => set("description", event.target.value)} />
            {message("description")}
          </div>
          <div>
            <label className="field-label" htmlFor="custom-qty">{t.custom.quantity}</label>
            <input id="custom-qty" inputMode="numeric" enterKeyHint="next" className="field-input" value={draft.quantity} {...invalid("quantity")} onChange={(event) => set("quantity", event.target.value)} />
            {message("quantity")}
          </div>
        </div>
      )}

      {draft.step === 2 && (
        <div className="mt-4 space-y-3">
          <div>
            <label className="field-label" htmlFor="custom-size">{t.custom.dimensions}</label>
            <input id="custom-size" className="field-input" enterKeyHint="next" value={draft.dimensions} onChange={(event) => set("dimensions", event.target.value)} />
          </div>
          <div>
            <p className="field-label">{t.custom.material}</p>
            <TextChoices multiple name="material" value={draft.materials} onChange={(value) => set("materials", value)} options={MATERIAL_OPTIONS.map((value) => ({ value, label: value }))} />
            <input className="field-input mt-2" enterKeyHint="next" placeholder={t.custom.materialNotePlaceholder} value={draft.materialNote} onChange={(event) => set("materialNote", event.target.value)} />
          </div>
          <div>
            <p className="field-label">{t.custom.color}</p>
            <ColorImageChoices multiple name="color" value={draft.colors} onChange={(value) => set("colors", value)} options={[...STANDARD_COLORS]} />
            <input className="field-input mt-2" enterKeyHint="next" placeholder={t.custom.colorNotePlaceholder} value={draft.colorNote} onChange={(event) => set("colorNote", event.target.value)} />
          </div>
          <div>
            <label className="field-label" htmlFor="custom-finish">{t.customExtra.finish}</label>
            <input id="custom-finish" className="field-input" enterKeyHint="next" value={draft.finish} onChange={(event) => set("finish", event.target.value)} />
          </div>
          <div className="flex flex-wrap gap-2">
            {BUDGETS.map((band) => {
              const label = band.id === "under"
                ? fill(t.shop.budgetUnder, { amount: formatPrice(band.amount ?? 0) ?? "" })
                : band.id === "over"
                  ? fill(t.shop.budgetOver, { amount: formatPrice(band.amount ?? 0) ?? "" })
                  : fill(t.shop.budgetBetween, { min: formatPrice(band.min ?? 0) ?? "", max: formatPrice(band.max ?? 0) ?? "" });
              return (
                <button key={band.id} type="button" aria-pressed={draft.budget === label} className="btn-base min-h-11 border border-[#E5E5E5] bg-white px-3 text-sm text-navy" onClick={() => set("budget", draft.budget === label ? "" : label)}>
                  {label}
                </button>
              );
            })}
          </div>
          <div>
            <label className="field-label" htmlFor="needed-by">{t.customExtra.neededBy}</label>
            <input id="needed-by" type="date" className="field-input" enterKeyHint="next" value={draft.neededBy} onChange={(event) => set("neededBy", event.target.value)} />
          </div>
        </div>
      )}

      {draft.step === 3 && (
        <div className="mt-4 space-y-3">
          <label className="btn-base btn-outline-navy min-h-11 w-full cursor-pointer">
            <ImagePlus className="h-4 w-4" />
            {t.custom.attach}
            <input type="file" accept="image/*" multiple className="sr-only" {...invalid("photos")} onChange={(event) => void addPhotos(event.target.files)} />
          </label>
          <p className="text-sm text-muted-foreground">{fill(t.custom.photoTotal, { amount: bytesLabel(photoBytes) })}</p>
          <ul className="flex flex-wrap gap-2">
            {photos.map((photo) => (
              <li key={photo.url} className="relative">
                <img src={photo.url} alt={photo.name} width={96} height={96} className="h-24 w-24 rounded-lg object-cover" />
                <button type="button" className="absolute right-1 top-1 grid h-11 w-11 place-items-center rounded-full bg-white text-navy" aria-label={t.nav.close} onClick={() => setPhotos((current) => current.filter((item) => item.url !== photo.url))}>
                  <X className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
          {message("photos")}
        </div>
      )}

      {draft.step === 4 && (
        <div className="mt-4 space-y-3">
          <div>
            <label className="field-label" htmlFor="custom-name">{t.custom.fullName} *</label>
            <input id="custom-name" autoComplete="name" enterKeyHint="next" className="field-input" value={draft.fullName} {...invalid("fullName")} onChange={(event) => set("fullName", event.target.value)} />
            {message("fullName")}
          </div>
            <PhoneField
              id="custom-phone"
              label={t.custom.phone}
              required
              value={draft.phone}
              {...(errs["phone"] ? { error: errs["phone"] } : {})}
              onChange={(value) => set("phone", value)}
            onBlur={() => {
              if (draft.phone.trim() && !normaliseTzMobile(draft.phone)) setErrs((current) => ({ ...current, phone: t.validation.phoneInvalid }));
            }}
          />
          <div>
            <label className="field-label" htmlFor="custom-email">{t.custom.email}</label>
            <input id="custom-email" type="email" inputMode="email" autoComplete="email" enterKeyHint="next" className="field-input" value={draft.email} {...invalid("email")} onChange={(event) => set("email", event.target.value)} />
            {message("email")}
          </div>
          <div>
            <label className="field-label" htmlFor="custom-place">{t.custom.location} *</label>
            <input id="custom-place" autoComplete="street-address" enterKeyHint="done" className="field-input" value={draft.location} {...invalid("location")} onChange={(event) => set("location", event.target.value)} />
            {message("location")}
          </div>
        </div>
      )}

      <div className="mt-5 flex gap-2">
        {draft.step > 1 && (
          <button type="button" className="btn-base btn-outline-navy min-h-11 flex-1" onClick={() => set("step", moveCustomStep(draft.step, "back"))}>
            {t.custom.wizardBack}
          </button>
        )}
        <button type="submit" className="btn-base btn-gold min-h-11 flex-1" disabled={busy}>
          {draft.step < 4 ? t.custom.wizardNext : busy ? t.custom.submitting : t.custom.submit}
        </button>
      </div>
    </form>
  );
}
