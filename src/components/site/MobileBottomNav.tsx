import { Link, useRouterState } from "@tanstack/react-router";
import { Home, ShoppingBag, ShoppingCart, UserRound } from "lucide-react";
import { useAuthUser } from "@/hooks/use-auth";
import { useLang } from "@/i18n/LanguageProvider";
import { useCart } from "@/lib/cart";
import { cn } from "@/lib/utils";
import { CartCountBadge } from "./HeaderActions";

/** Fixed 4-tab bar for phones and tablets: Home, Shop, Cart, Account. */
export function MobileBottomNav() {
  const { t } = useLang();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { count } = useCart();
  const { user, ready } = useAuthUser();
  const signedOut = ready && !user;

  const tabs = [
    { key: "home", to: "/" as const, label: t.nav.home, icon: Home, active: pathname === "/" },
    {
      key: "shop",
      to: "/products" as const,
      label: t.shell.shop,
      icon: ShoppingBag,
      active: pathname.startsWith("/products") || pathname.startsWith("/categories"),
    },
    {
      key: "cart",
      to: "/cart" as const,
      label: t.shell.cart,
      icon: ShoppingCart,
      active: pathname.startsWith("/cart") || pathname.startsWith("/checkout"),
      badge: count,
    },
    {
      key: "account",
      to: signedOut ? ("/account/login" as const) : ("/account" as const),
      label: t.shell.account,
      icon: UserRound,
      active: pathname.startsWith("/account"),
    },
  ];

  return (
    <nav aria-label={t.nav.menu} className="tabbar lg:hidden">
      <ul className="mx-auto grid h-16 max-w-lg grid-cols-4">
        {tabs.map(({ key, to, label, icon: Icon, active, badge }) => (
          <li key={key}>
            <Link
              to={to}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex h-full flex-col items-center justify-center gap-1 text-[0.7rem] font-semibold transition-colors",
                active ? "text-gold-ink" : "text-muted-foreground hover:text-navy",
              )}
            >
              <span className="relative">
                <Icon className="h-[1.35rem] w-[1.35rem]" strokeWidth={active ? 2.3 : 1.8} />
                {badge ? <CartCountBadge count={badge} /> : null}
              </span>
              {label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
