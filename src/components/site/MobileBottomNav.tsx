import { Link, useRouterState } from "@tanstack/react-router";
import { Home, LayoutGrid, ShoppingBag, ShoppingCart, UserRound } from "lucide-react";
import { useCustomerName } from "@/hooks/use-customer-name";
import { useLang } from "@/i18n/LanguageProvider";
import { useCart } from "@/lib/cart";
import { cn } from "@/lib/utils";
import { CartCountBadge } from "./HeaderActions";
import { UserMark } from "./UserMark";

/** Fixed 4-tab bar for phones and tablets: Home, Shop, Cart, Account. */
export function MobileBottomNav() {
  const { t } = useLang();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { count } = useCart();
  const { user, letter } = useCustomerName();
  const signedIn = Boolean(user);

  const tabs = [
    signedIn
      ? {
          key: "categories",
          to: "/categories" as const,
          label: t.nav.categories,
          icon: LayoutGrid,
          active: pathname.startsWith("/categories"),
        }
      : { key: "home", to: "/" as const, label: t.nav.home, icon: Home, active: pathname === "/" },
    {
      key: "shop",
      to: "/products" as const,
      label: t.shell.shop,
      icon: ShoppingBag,
      active: pathname.startsWith("/products") || (!signedIn && pathname.startsWith("/categories")),
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
      to: signedIn ? ("/account" as const) : ("/account/login" as const),
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
                {key === "account" && signedIn ? (
                  <UserMark letter={letter} className={cn("h-7 w-7 text-xs", active && "ring-2 ring-navy")} />
                ) : (
                  <Icon className="h-[1.35rem] w-[1.35rem]" strokeWidth={active ? 2.3 : 1.8} />
                )}
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
