import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ColorImageChoices, TextChoices } from "@/components/site/SelectChoices";
import { formatPrice, formatPriceSpan } from "@/config/site";
import { localized, useLang } from "@/i18n/LanguageProvider";
import { useCart } from "@/lib/cart";
import type { Product } from "@/lib/catalog";
import { optionLabel, optionPriceRows, parseCatalogColor, parseOptionList, selectedOptionPrice } from "@/lib/order-options";
import { isPurchasable } from "@/lib/product-display";
import { QtyStepper } from "@/components/brand/QtyStepper";

export type ProductChoice = { quantity: number; material: string; size: string; color: string };

/** Options the customer still has to pick before the piece can go in the cart. */
export function missingChoices(product: Product, choice: Omit<ProductChoice, "quantity">) {
  const missing: ("material" | "size" | "color")[] = [];
  if (parseOptionList(product.material).length && !choice.material) missing.push("material");
  if (parseOptionList(product.dimensions).length && !choice.size) missing.push("size");
  if (product.available_colors.length && !choice.color) missing.push("color");
  return missing;
}

/** Add a fully chosen piece to the cart, then show a toast or open checkout. */
export function useAddToCart() {
  const cart = useCart();
  const nav = useNavigate();
  const { t } = useLang();
  return async (product: Product, choice: ProductChoice, buyNow = false) => {
    await cart.add({
      product_id: product.id,
      quantity: choice.quantity,
      material: choice.material,
      size: choice.size,
      color: choice.color,
    });
    if (buyNow) {
      sessionStorage.setItem("gk-checkout-start", "payment");
      void nav({ to: "/checkout" });
      return;
    }
    toast.success(t.cart.added, {
      action: { label: t.cart.viewCart, onClick: () => void nav({ to: "/cart" }) },
    });
  };
}

/** Pick colour, size, material and quantity, then add to the cart or buy now. */
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
  const addToCart = useAddToCart();
  const colors = product.available_colors.map(parseCatalogColor);
  const materials = parseOptionList(product.material);
  const dimensions = parseOptionList(product.dimensions);
  const [qty, setQty] = useState(initialQty);
  const [color, setColor] = useState(initialColor && colors.some((item) => item.stored === initialColor) ? initialColor : "");
  const [size, setSize] = useState(initialSize && dimensions.includes(initialSize) ? initialSize : "");
  const [material, setMaterial] = useState(initialMaterial && materials.includes(initialMaterial) ? initialMaterial : "");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const name = localized(lang, product.name, product.name_sw);
  const canBuy = isPurchasable(product);
  const unitPrice = selectedOptionPrice(product, material, size);
  const total = unitPrice != null ? formatPrice(unitPrice * qty) : null;
  const unitLabel = unitPrice != null
    ? formatPrice(unitPrice)
    : formatPriceSpan(optionPriceRows(product).map((row) => row.price)) ?? formatPrice(product.price);

  async function submit(buyNow: boolean) {
    const colorLabel = colors.find((item) => item.stored === color)?.label ?? "";
    const missing = missingChoices(product, { material, size, color: colorLabel });
    const errs: Record<string, string> = {};
    if (missing.includes("size")) errs["size"] = t.validation.sizeRequired;
    if (missing.includes("color")) errs["color"] = t.validation.colorRequired;
    if (missing.includes("material")) errs["material"] = t.validation.materialRequired;
    if (qty < 1) errs["quantity"] = t.validation.quantityInvalid;
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setBusy(true);
    try {
      await addToCart(product, { quantity: qty, material, size, color: colorLabel }, buyNow);
      onOpenChange(false);
    } catch {
      toast.error(t.validation.failed);
    } finally {
      setBusy(false);
    }
  }

  const err = (k: string) => errors[k] && <p className="mt-1 text-xs text-destructive">{errors[k]}</p>;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-display text-xl font-bold text-navy">{t.cart.chooseTitle}</DialogTitle>
          <DialogDescription>{t.order.intro}</DialogDescription>
        </DialogHeader>
        <div className="rounded-xl bg-sand p-4 text-sm">
          <span className="text-muted-foreground">{t.order.product}: </span>
          <strong className="text-navy">{name}</strong>
          {unitLabel && <span className="ml-2 font-semibold">{unitLabel}</span>}
        </div>
        <div className="grid gap-4">
          {colors.length > 0 && (
            <div>
              <p className="field-label">{t.order.color} *</p>
              <ColorImageChoices name="preferred_color" value={color} onChange={setColor} options={colors} />
              {err("color")}
            </div>
          )}
          {dimensions.length > 0 && (
            <div>
              <p className="field-label">{t.detail.dimensions} *</p>
              <TextChoices
                name="preferred_size"
                value={size}
                onChange={setSize}
                options={dimensions.map((value) => ({ value, label: optionLabel(value, product.dimensions, lang) }))}
              />
              {err("size")}
            </div>
          )}
          {materials.length > 0 && (
            <div>
              <p className="field-label">{t.order.material} *</p>
              <TextChoices
                name="preferred_material"
                value={material}
                onChange={setMaterial}
                options={materials.map((value) => ({ value, label: optionLabel(value, product.material, lang) }))}
              />
              {err("material")}
            </div>
          )}
          <div>
            <p className="field-label">{t.order.quantity}</p>
            <QtyStepper value={qty} onChange={setQty} label={t.order.quantity} />
            {err("quantity")}
          </div>
          {total && <p className="text-sm text-muted-foreground">{t.order.estimate}: <strong className="text-navy">{total}</strong></p>}
          <div className="grid grid-cols-2 gap-3">
            <button type="button" className="btn-base btn-gold" disabled={busy || !canBuy} onClick={() => void submit(false)}>
              {t.cart.add}
            </button>
            <button type="button" className="btn-base btn-navy" disabled={busy || !canBuy} onClick={() => void submit(true)}>
              {t.cart.buyNow}
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
