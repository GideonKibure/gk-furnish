import { Link } from "@tanstack/react-router";
import { ShoppingCart, UserRound } from "lucide-react";
import { useAuthUser } from "@/hooks/use-auth";
import { fill } from "@/i18n/fill";
import { useLang } from "@/i18n/LanguageProvider";
import { useCart } from "@/lib/cart";
import { cn } from "@/lib/utils";

export function CartCountBadge({ count, className }: { count: number; className?: string }) {
  if (count <= 0) return null;
  return (
    <span
      className={cn(
        "absolute -right-1 -top-1 grid h-[1.15rem] min-w-[1.15rem] place-items-center rounded-full bg-gold px-1 text-[0.65rem] font-bold leading-none text-navy ring-2 ring-white",
        className,
      )}
    >
      {count > 99 ? "99+" : count}
    </span>
  );
}

/** Account and cart shortcuts for the site header. */
export function HeaderActions({ showAccount = true }: { showAccount?: boolean }) {
  const { t } = useLang();
  const { count } = useCart();
  const { user, ready } = useAuthUser();
  const signedOut = ready && !user;

  return (
    <div className="flex items-center gap-0.5">
      {showAccount && (
        <Link
          to={signedOut ? "/account/login" : "/account"}
          aria-label={signedOut ? t.nav.signIn : t.nav.account}
          title={signedOut ? t.nav.signIn : t.nav.account}
          className="icon-btn"
        >
          <UserRound className="h-5 w-5" strokeWidth={1.8} />
        </Link>
      )}
      <Link
        to="/cart"
        aria-label={fill(t.shell.cartCount, { count })}
        title={t.nav.cart}
        className="icon-btn relative"
      >
        <ShoppingCart className="h-5 w-5" strokeWidth={1.8} />
        <CartCountBadge count={count} />
      </Link>
    </div>
  );
}
