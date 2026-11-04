import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, ShoppingCart, Trash2 } from "lucide-react";
import { Breadcrumbs } from "@/components/brand/Breadcrumbs";
import { EmptyState } from "@/components/brand/EmptyState";
import { QtyStepper } from "@/components/brand/QtyStepper";
import { formatPrice } from "@/config/site";
import { localized, useLang } from "@/i18n/LanguageProvider";
import { useCart } from "@/lib/cart";
import { deliveryFeeStatusFor } from "@/lib/delivery";
import { optionLabel } from "@/lib/order-options";
import { isPurchasable } from "@/lib/product-display";
import { productImageSrc } from "@/lib/product-image";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/cart")({
  head: () => ({ meta: [{ title: "Cart — GK furnish" }, { name: "robots", content: "noindex" }] }),
  component: CartPage,
});

function CartPage() {
  const { t, lang } = useLang();
  const cart = useCart();
  const blocked = cart.entries.some((e) => !e.product || e.unitPrice == null || !isPurchasable(e.product));
  const products = cart.entries.flatMap((e) => (e.product ? [e.product] : []));
  const freeDelivery = deliveryFeeStatusFor("delivery", products) === "free";

  return (
    <div className="bg-sand">
      <div className="container-page py-5 md:py-8">
        <Breadcrumbs items={[{ label: t.nav.home, href: "/" }, { label: t.cart.title }]} />
        <h1 className="display-lg mt-2">
          {t.cart.title}
          {cart.count > 0 && <span className="ml-2 text-lg font-semibold text-muted-foreground">({cart.count})</span>}
        </h1>

        <div className="mt-5 md:mt-6">
          {!cart.ready ? (
            <p className="text-sm text-muted-foreground">{t.common.loading}</p>
          ) : cart.entries.length === 0 ? (
            <EmptyState
              icon={<ShoppingCart className="h-6 w-6" />}
              title={t.cart.empty}
              action={
                <Link to="/products" className="btn-base btn-gold">
                  {t.cart.emptyCta}
                </Link>
              }
            />
          ) : (
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
              <ul className="min-w-0 space-y-3">
                {cart.entries.map((entry) => {
                  const p = entry.product;
                  const unavailable = !p || entry.unitPrice == null || !isPurchasable(p);
                  const options = [
                    entry.material && p ? optionLabel(entry.material, p.material, lang) : "",
                    entry.size && p ? optionLabel(entry.size, p.dimensions, lang) : "",
                    entry.color,
                  ].filter(Boolean);
                  return (
                    <li key={entry.key} className={cn("panel flex gap-3 p-3 sm:gap-4 sm:p-4", unavailable && "border-danger/40")}>
                      {p ? (
                        <Link to="/products/$slug" params={{ slug: p.slug }} className="shrink-0">
                          <img
                            src={productImageSrc(p)}
                            alt=""
                            className="h-20 w-20 rounded-lg border border-border object-cover sm:h-24 sm:w-24"
                          />
                        </Link>
                      ) : (
                        <span className="h-20 w-20 shrink-0 rounded-lg bg-muted sm:h-24 sm:w-24" />
                      )}
                      <div className="flex min-w-0 flex-1 flex-col">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            {p ? (
                              <Link
                                to="/products/$slug"
                                params={{ slug: p.slug }}
                                className="line-clamp-2 font-semibold text-navy hover:text-gold-ink"
                              >
                                {localized(lang, p.name, p.name_sw)}
                              </Link>
                            ) : null}
                            {options.length > 0 && <p className="mt-0.5 truncate text-sm text-muted-foreground">{options.join(" · ")}</p>}
                            {entry.unitPrice != null && (
                              <p className="mt-0.5 text-sm font-medium text-navy">{formatPrice(entry.unitPrice)}</p>
                            )}
                            {unavailable && <p className="mt-1 text-sm text-danger">{t.cart.unavailable}</p>}
                          </div>
                          <button
                            type="button"
                            onClick={() => void cart.remove(entry.key)}
                            aria-label={t.cart.remove}
                            title={t.cart.remove}
                            className="icon-btn h-9 w-9 shrink-0 text-danger hover:bg-danger-soft"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                        <div className="mt-auto flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5 pt-2">
                          <QtyStepper
                            size="sm"
                            value={entry.quantity}
                            onChange={(q) => void cart.setQuantity(entry.key, q)}
                            label={t.cart.quantity}
                          />
                          <p className="price-text shrink-0">{formatPrice(entry.lineTotal) ?? "—"}</p>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>

              <aside className="h-fit min-w-0 lg:sticky lg:top-24">
                <div className="kpi-card">
                  <h2 className="text-base font-bold">{t.checkout.summary}</h2>
                  <dl className="mt-3 space-y-2 text-sm">
                    <div className="flex justify-between">
                      <dt className="text-muted-foreground">{t.cart.subtotal}</dt>
                      <dd className="font-semibold tabular-nums text-navy">{formatPrice(cart.subtotal) ?? "—"}</dd>
                    </div>
                    <div className="flex justify-between gap-3">
                      <dt className="text-muted-foreground">{t.delivery.label}</dt>
                      <dd className={cn("text-right font-semibold", freeDelivery ? "text-success" : "text-navy")}>
                        {freeDelivery ? t.delivery.free : t.delivery.toBeConfirmed}
                      </dd>
                    </div>
                    <div className="flex justify-between border-t border-border pt-2 text-base">
                      <dt className="font-bold text-navy">{t.checkout.total}</dt>
                      <dd className="price-text">{formatPrice(cart.subtotal) ?? "—"}</dd>
                    </div>
                  </dl>
                  <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                    {freeDelivery ? t.delivery.freeNote : `${t.delivery.pendingNote} ${t.delivery.collectionNote}`}
                  </p>
                  {blocked ? (
                    <p className="mt-4 text-sm text-danger">{t.cart.unavailable}</p>
                  ) : (
                    <Link to="/checkout" className="btn-base btn-gold btn-lg mt-4 w-full">
                      {t.cart.checkout}
                      <ArrowRight className="h-4 w-4" />
                    </Link>
                  )}
                  <Link to="/products" className="btn-base btn-ghost mt-2 w-full">
                    {t.cart.keepShopping}
                  </Link>
                  <p className="mt-2 text-center text-xs text-muted-foreground">{t.cart.priceNote}</p>
                </div>
              </aside>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
