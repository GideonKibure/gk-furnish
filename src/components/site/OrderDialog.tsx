import { useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ColorImageChoices, TextChoices } from "@/components/site/SelectChoices";
import { formatPrice } from "@/config/site";
import { localized, useLang } from "@/i18n/LanguageProvider";
import type { Product } from "@/lib/catalog";
import { parseCatalogColor, parseOptionList } from "@/lib/order-options";
import { submitOrderWithPayment } from "@/lib/payments.functions";

function todayIso() {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

export function OrderDialog({
  product,
  open,
  onOpenChange,
  initialQty = 1,
  initialColor = "",
  initialSize = "",
  initialMaterial = "",
}: {
  product: Product;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  initialQty?: number;
  initialColor?: string;
  initialSize?: string;
  initialMaterial?: string;
}) {
  const { t, lang } = useLang();
  const nav = useNavigate();
  const send = useServerFn(submitOrderWithPayment);
  const colors = product.available_colors.map(parseCatalogColor);
  const materials = parseOptionList(product.material);
  const dimensions = parseOptionList(product.dimensions);
  const [qty, setQty] = useState(initialQty);
  const [color, setColor] = useState(
    initialColor && colors.some((item) => item.stored === initialColor) ? initialColor : "",
  );
  const [size, setSize] = useState(
    initialSize && dimensions.includes(initialSize) ? initialSize : "",
  );
  const [material, setMaterial] = useState(
    initialMaterial && materials.includes(initialMaterial) ? initialMaterial : "",
  );
  const [neededBy, setNeededBy] = useState("");
  const [paymentKind, setPaymentKind] = useState<"advance" | "full">("advance");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const name = localized(lang, product.name, product.name_sw);
  const lineTotal = product.price * qty;
  const total = formatPrice(lineTotal);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const v = (k: string) => String(fd.get(k) ?? "").trim();
    const f = {
      customer_name: v("customer_name"),
      phone: v("phone"),
      email: v("email"),
      delivery_location: v("delivery_location"),
      notes: v("notes"),
      preferred_color: colors.find((item) => item.stored === color)?.label ?? "",
      preferred_size: size,
      preferred_material: material,
      needed_by: neededBy,
    };
    const errs: Record<string, string> = {};
    if (!f.customer_name) errs["customer_name"] = t.validation.nameRequired;
    if (!f.phone) errs["phone"] = t.validation.phoneRequired;
    else if (!/^[+\d\s()-]{7,20}$/.test(f.phone)) errs["phone"] = t.validation.phoneInvalid;
    if (f.email && !/^\S+@\S+\.\S+$/.test(f.email)) errs["email"] = t.validation.emailInvalid;
    if (dimensions.length && !f.preferred_size) errs["preferred_size"] = t.validation.sizeRequired;
    if (colors.length && !color) errs["preferred_color"] = t.validation.colorRequired;
    if (materials.length && !f.preferred_material)
      errs["preferred_material"] = t.validation.materialRequired;
    if (!f.needed_by) errs["needed_by"] = t.validation.dateRequired;
    if (!f.delivery_location) errs["delivery_location"] = t.validation.locationRequired;
    if (qty < 1) errs["quantity"] = t.validation.quantityInvalid;
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setBusy(true);
    try {
      const r = await send({
        data: {
          ...f,
          product_id: product.id,
          quantity: qty,
          payment_kind: paymentKind,
        },
      });
      onOpenChange(false);
      nav({
        to: "/order-success",
        search: {
          ref: r.orderNumber,
          item: r.productName,
          qty: r.quantity,
          total: r.total,
          kind: r.paymentKind,
          pay: r.paymentStatus,
          msg: r.message,
          name: r.customerName,
          phone: r.phone,
          email: r.email || undefined,
          color: r.preferredColor,
          size: r.preferredSize,
          material: r.preferredMaterial,
          needed: r.neededBy,
          location: r.deliveryLocation,
        },
      });
    } catch {
      toast.error(t.validation.failed);
    } finally {
      setBusy(false);
    }
  }

  const err = (k: string) =>
    errors[k] && <p className="mt-1 text-xs text-destructive">{errors[k]}</p>;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl text-navy">{t.order.title}</DialogTitle>
          <DialogDescription>{t.order.intro}</DialogDescription>
        </DialogHeader>
        <div className="rounded-xl bg-sand p-4 text-sm">
          <span className="text-muted-foreground">{t.order.product}: </span>
          <strong className="text-navy">{name}</strong>
          {formatPrice(product.price) && (
            <span className="ml-2 font-semibold">{formatPrice(product.price)}</span>
          )}
        </div>
        <form onSubmit={onSubmit} noValidate className="grid gap-4">
          <div>
            <label className="field-label" htmlFor="o-name">
              {t.order.name} *
            </label>
            <input id="o-name" name="customer_name" className="field-input" autoComplete="name" />
            {err("customer_name")}
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="field-label" htmlFor="o-phone">
                {t.order.phone} *
              </label>
              <input
                id="o-phone"
                name="phone"
                type="tel"
                inputMode="tel"
                className="field-input"
                placeholder="+255…"
              />
              {err("phone")}
            </div>
            <div>
              <label className="field-label" htmlFor="o-email">
                {t.order.email}
              </label>
              <input id="o-email" name="email" type="email" className="field-input" />
              {err("email")}
            </div>
          </div>
          <div>
            <label className="field-label" htmlFor="o-qty">
              {t.order.quantity}
            </label>
            <input
              id="o-qty"
              type="number"
              min={1}
              max={100}
              value={qty}
              onChange={(e) => setQty(Math.max(1, Number(e.target.value) || 1))}
              className="field-input"
            />
            {err("quantity")}
          </div>
          {colors.length > 0 && (
            <div>
              <p className="field-label">{t.order.color} *</p>
              <ColorImageChoices
                name="preferred_color"
                value={color}
                onChange={setColor}
                options={colors}
              />
              {err("preferred_color")}
            </div>
          )}
          {dimensions.length > 0 && (
            <div>
              <p className="field-label">{t.detail.dimensions} *</p>
              <TextChoices
                name="preferred_size"
                value={size}
                onChange={setSize}
                options={dimensions.map((value) => ({ value, label: value }))}
              />
              {err("preferred_size")}
            </div>
          )}
          {materials.length > 0 && (
            <div>
              <p className="field-label">{t.order.material} *</p>
              <TextChoices
                name="preferred_material"
                value={material}
                onChange={setMaterial}
                options={materials.map((value) => ({ value, label: value }))}
              />
              {err("preferred_material")}
            </div>
          )}
          <div>
            <label className="field-label" htmlFor="o-needed">
              {t.order.neededBy} *
            </label>
            <input
              id="o-needed"
              name="needed_by"
              type="date"
              min={todayIso()}
              value={neededBy}
              onChange={(e) => setNeededBy(e.target.value)}
              className="field-input"
            />
            <p className="mt-1.5 text-xs text-muted-foreground">{t.order.completionNote}</p>
            {err("needed_by")}
          </div>
          <div>
            <label className="field-label" htmlFor="o-loc">
              {t.order.location} *
            </label>
            <input id="o-loc" name="delivery_location" className="field-input" />
            {err("delivery_location")}
          </div>
          <div>
            <label className="field-label" htmlFor="o-notes">
              {t.order.notes}
            </label>
            <textarea id="o-notes" name="notes" rows={3} className="field-input" />
          </div>

          <fieldset className="rounded-xl border border-border p-4">
            <legend className="px-1 text-sm font-semibold text-navy">{t.order.paymentTitle}</legend>
            <div className="grid gap-2 sm:grid-cols-2">
              <label
                className={`cursor-pointer rounded-lg border px-3 py-3 text-sm transition-colors ${paymentKind === "advance" ? "border-gold bg-gold-soft" : "border-border"}`}
              >
                <input
                  type="radio"
                  className="sr-only"
                  checked={paymentKind === "advance"}
                  onChange={() => setPaymentKind("advance")}
                />
                <span className="font-semibold text-navy">{t.order.payAdvance}</span>
              </label>
              <label
                className={`cursor-pointer rounded-lg border px-3 py-3 text-sm transition-colors ${paymentKind === "full" ? "border-gold bg-gold-soft" : "border-border"}`}
              >
                <input
                  type="radio"
                  className="sr-only"
                  checked={paymentKind === "full"}
                  onChange={() => setPaymentKind("full")}
                />
                <span className="font-semibold text-navy">{t.order.payFull}</span>
              </label>
            </div>
          </fieldset>

          {total && (
            <p className="text-sm text-muted-foreground">
              {t.order.estimate}: <strong className="text-navy">{total}</strong>
            </p>
          )}
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              className="btn-base btn-outline-navy"
              onClick={() => onOpenChange(false)}
            >
              {t.order.cancel}
            </button>
            <button type="submit" className="btn-base btn-gold" disabled={busy}>
              {busy ? t.order.submitting : t.order.submit}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
