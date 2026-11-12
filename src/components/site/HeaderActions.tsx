import { Link } from "@tanstack/react-router";
import { ShoppingCart, UserRound } from "lucide-react";
import { useCustomerName } from "@/hooks/use-customer-name";
import { fill } from "@/i18n/fill";
import { useLang } from "@/i18n/LanguageProvider";
import { useCart } from "@/lib/cart";
import { cn } from "@/lib/utils";
import { useAuthPopup } from "@/hooks/use-auth-popup";
import { UserMark } from "./UserMark";

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
  const { user, ready, name, letter } = useCustomerName();
  const { open } = useAuthPopup();
  const signedOut = ready && !user;
  const firstName = name.split(/\s+/)[0] ?? "";

  return (
    <div className="flex items-center gap-0.5">
      {showAccount &&
        (signedOut ? (
          <button
            type="button"
            aria-label={t.nav.signIn}
            title={t.nav.signIn}
            onClick={() => open({ reason: "account", mode: "signin" })}
            className="icon-btn auth-wave"
          >
            <UserRound className="h-5 w-5" strokeWidth={1.8} />
          </button>
        ) : (
          <Link
            to="/account"
            aria-label={name || t.nav.account}
            title={name || t.nav.account}
            className="inline-flex h-10 items-center gap-2 rounded-full py-1 pl-1 pr-1 transition-colors hover:bg-muted lg:pr-2.5"
          >
            <UserMark letter={letter} />
            {firstName ? (
              <span className="hidden max-w-28 truncate text-sm font-semibold text-navy lg:inline">
                {firstName}
              </span>
            ) : null}
          </Link>
        ))}
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
