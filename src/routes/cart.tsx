import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Minus, Plus, ShoppingBag, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/site/PageHeader";
import { formatPrice } from "@/config/site";
import { localized, useLang } from "@/i18n/LanguageProvider";
import { useCart } from "@/lib/cart";
import { optionLabel } from "@/lib/order-options";
import { productImageSrc } from "@/lib/product-image";

export const Route = createFileRoute("/cart")({
  head: () => ({ meta: [{ title: "Cart — GK furnish" }, { name: "robots", content: "noindex" }] }),
  component: CartPage,
});

function CartPage() {
  const { t, lang } = useLang();
  const cart = useCart();
  const blocked = cart.entries.some((e) => !e.product || e.unitPrice == null);

  return (
    <>
      <PageHeader title={t.cart.title} subtitle={t.cart.subtitle} />
      <div className="container-page section-y">
        {!cart.ready ? (
          <p className="text-sm text-muted-foreground">{t.common.loading}</p>
        ) : cart.entries.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-border bg-background/70 px-6 py-16 text-center">
            <ShoppingBag className="mx-auto h-10 w-10 text-gold" />
            <p className="mt-4 text-lg font-semibold text-navy">{t.cart.empty}</p>
            <Link to="/products" className="btn-base btn-gold mt-6">
              {t.cart.emptyCta}
            </Link>
          </div>
        ) : (
          <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_22rem]">
            <ul className="space-y-4">
              {cart.entries.map((entry) => {
                const p = entry.product;
                const options = [
                  entry.material && p ? optionLabel(entry.material, p.material, lang) : "",
                  entry.size && p ? optionLabel(entry.size, p.dimensions, lang) : "",
                  entry.color,
                ].filter(Boolean);
                return (
                  <li
                    key={entry.key}
                    className="flex gap-4 rounded-2xl border border-border/80 bg-background p-4 shadow-[var(--shadow-card)]"
                  >
                    {p && (
                      <img
                        src={productImageSrc(p)}
                        alt=""
                        className="h-24 w-24 shrink-0 rounded-xl object-cover sm:h-28 sm:w-28"
                      />
                    )}
                    <div className="flex min-w-0 flex-1 flex-col">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          {p ? (
                            <Link
                              to="/products/$slug"
                              params={{ slug: p.slug }}
                              className="font-semibold text-navy hover:underline"
                            >
                              {localized(lang, p.name, p.name_sw)}
                            </Link>
                          ) : (
                            <p className="text-sm text-destructive">{t.cart.unavailable}</p>
                          )}
                          {options.length > 0 && <p className="mt-0.5 text-sm text-muted-foreground">{options.join(" · ")}</p>}
                          {p && entry.unitPrice == null && <p className="mt-1 text-sm text-destructive">{t.cart.unavailable}</p>}
                        </div>
                        <p className="shrink-0 font-semibold tabular-nums text-navy">{formatPrice(entry.lineTotal) ?? "—"}</p>
                      </div>
                      <div className="mt-auto flex items-center justify-between gap-3 pt-3">
                        <div className="inline-flex items-center rounded-full border border-border bg-background p-0.5">
                          <button
                            type="button"
                            aria-label="Decrease quantity"
                            className="grid h-8 w-8 place-items-center rounded-full hover:bg-secondary disabled:opacity-40"
                            disabled={entry.quantity <= 1}
                            onClick={() => void cart.setQuantity(entry.key, entry.quantity - 1)}
                          >
                            <Minus className="h-3.5 w-3.5" />
                          </button>
                          <span className="w-8 text-center text-sm font-semibold tabular-nums">{entry.quantity}</span>
                          <button
                            type="button"
                            aria-label="Increase quantity"
                            className="grid h-8 w-8 place-items-center rounded-full hover:bg-secondary"
                            onClick={() => void cart.setQuantity(entry.key, entry.quantity + 1)}
                          >
                            <Plus className="h-3.5 w-3.5" />
                          </button>
                        </div>
                        <button
                          type="button"
                          onClick={() => void cart.remove(entry.key)}
                          className="inline-flex items-center gap-1.5 text-sm font-semibold text-destructive hover:underline"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          {t.cart.remove}
                        </button>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>

            <aside className="h-fit rounded-2xl border border-border/80 bg-background p-5 shadow-[var(--shadow-card)] lg:sticky lg:top-28">
              <div className="flex items-center justify-between text-lg font-semibold text-navy">
                <span>{t.cart.subtotal}</span>
                <span className="tabular-nums">{formatPrice(cart.subtotal) ?? "—"}</span>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">{t.cart.priceNote}</p>
              {blocked ? (
                <p className="mt-5 text-sm text-destructive">{t.cart.unavailable}</p>
              ) : (
                <Link to="/checkout" className="btn-base btn-gold group mt-5 w-full">
                  {t.cart.checkout}
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                </Link>
              )}
              <Link to="/products" className="btn-base btn-outline-navy mt-3 w-full">
                {t.cart.keepShopping}
              </Link>
            </aside>
          </div>
        )}
      </div>
    </>
  );
}
