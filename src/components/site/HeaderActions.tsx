import { Link } from "@tanstack/react-router";
import { ShoppingBag, UserRound } from "lucide-react";
import { useAuthUser } from "@/hooks/use-auth";
import { useLang } from "@/i18n/LanguageProvider";
import { useCart } from "@/lib/cart";
import { cn } from "@/lib/utils";

/** Cart (with item count) and account shortcuts for the site header. */
export function HeaderActions({ dark = false }: { dark?: boolean }) {
  const { t } = useLang();
  const { count } = useCart();
  const { user } = useAuthUser();
  const tone = dark
    ? "text-white/85 hover:bg-white/10 hover:text-white"
    : "text-navy hover:bg-secondary";

  return (
    <div className="flex items-center gap-0.5 sm:gap-1">
      <Link
        to={user ? "/account" : "/account/login"}
        aria-label={user ? t.nav.account : t.nav.signIn}
        title={user ? t.nav.account : t.nav.signIn}
        className={cn("grid h-8 w-8 place-items-center rounded-full transition-colors sm:h-9 sm:w-9", tone)}
      >
        <UserRound className="h-[1.15rem] w-[1.15rem]" />
      </Link>
      <Link
        to="/cart"
        aria-label={`${t.nav.cart} (${count})`}
        title={t.nav.cart}
        className={cn("relative grid h-8 w-8 place-items-center rounded-full transition-colors sm:h-9 sm:w-9", tone)}
      >
        <ShoppingBag className="h-[1.15rem] w-[1.15rem]" />
        {count > 0 && (
          <span className="absolute -right-0.5 -top-0.5 grid h-[1.15rem] min-w-[1.15rem] place-items-center rounded-full bg-gold px-1 text-[0.65rem] font-bold leading-none text-navy shadow-sm">
            {count > 99 ? "99+" : count}
          </span>
        )}
      </Link>
    </div>
  );
}
