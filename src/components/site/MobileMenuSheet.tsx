import { useQuery } from "@tanstack/react-query";
import { Link, useRouterState } from "@tanstack/react-router";
import {
  CircleHelp,
  Home,
  Images,
  Info,
  LayoutGrid,
  ListChecks,
  Mail,
  MessageCircle,
  Phone,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  UserRound,
  Wrench,
} from "lucide-react";
import { useCustomerName } from "@/hooks/use-customer-name";
import { useLang } from "@/i18n/LanguageProvider";
import { useAuthPopup } from "@/hooks/use-auth-popup";
import { settingsToSite, siteSettingsQuery } from "@/lib/site-content";
import { cn } from "@/lib/utils";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { BrandLogo } from "./BrandLogo";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { UserMark } from "./UserMark";

type MenuLink = {
  to:
    | "/"
    | "/products"
    | "/services"
    | "/categories"
    | "/custom-order"
    | "/gallery"
    | "/about"
    | "/process"
    | "/faq"
    | "/contact"
    | "/privacy"
    | "/account"
    | "/account/login";
  label: string;
  icon: typeof Home;
  exact?: boolean;
};

export function MobileMenuSheet({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { t } = useLang();
  const { user, ready, name, letter } = useCustomerName();
  const { open: openAuth } = useAuthPopup();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { data: settings } = useQuery(siteSettingsQuery);
  const site = settingsToSite(settings);
  const signedOut = ready && !user;

  const links: MenuLink[] = [
    { to: "/", label: t.nav.home, icon: Home, exact: true },
    { to: "/products", label: t.shell.shop, icon: ShoppingBag },
    { to: "/services", label: t.nav.services, icon: Wrench },
    { to: "/categories", label: t.nav.categories, icon: LayoutGrid },
    { to: "/custom-order", label: t.nav.custom, icon: Sparkles },
    { to: "/gallery", label: t.nav.gallery, icon: Images },
    { to: "/about", label: t.nav.about, icon: Info },
    { to: "/process", label: t.nav.process, icon: ListChecks },
    { to: "/faq", label: t.nav.faq, icon: CircleHelp },
    { to: "/contact", label: t.nav.contact, icon: Mail },
    { to: "/privacy", label: t.privacy.link, icon: ShieldCheck },
  ];
  const menuLinks = user ? links.filter((link) => link.to !== "/" && link.to !== "/about") : links;
  const accountLink: MenuLink = signedOut
    ? { to: "/account/login", label: t.nav.signIn, icon: UserRound }
    : { to: "/account", label: t.nav.account, icon: UserRound };

  const wa = `https://wa.me/${site.whatsappNumber}?text=${encodeURIComponent(t.whatsapp.general)}`;
  const dial = site.phoneDial.startsWith("+")
    ? site.phoneDial
    : `+${site.phoneDial.replace(/\D/g, "")}`;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="flex w-[86vw] max-w-sm flex-col gap-0 overflow-y-auto p-0"
      >
        <div className="border-b border-border px-5 pb-4 pt-5">
          <BrandLogo showWordmark={false} markClassName="h-16" tagline={t.shell.tagline} />
          <SheetTitle className="sr-only">{t.shell.menuTitle}</SheetTitle>
          <SheetDescription className="sr-only">{t.shell.trust}</SheetDescription>
          {!signedOut && (
            <Link
              to="/account"
              onClick={() => onOpenChange(false)}
              className="mt-4 flex items-center gap-3 rounded-xl bg-navy px-3 py-3 text-white"
            >
              <UserMark letter={letter} />
              <span className="min-w-0">
                <span className="block truncate text-sm font-semibold">{name || t.nav.account}</span>
                {user?.email ? <span className="block truncate text-xs text-white/70">{user.email}</span> : null}
              </span>
            </Link>
          )}
        </div>
        <nav aria-label={t.shell.menuTitle} className="flex-1 px-3 py-3">
          <ul className="space-y-0.5">
            {[...menuLinks, accountLink].map(({ to, label, icon: Icon, exact }) => {
              const active = exact
                ? pathname === to
                : pathname === to || pathname.startsWith(`${to}/`);
              if (to === "/account/login") {
                return (
                  <li key={to}>
                    <button
                      type="button"
                      onClick={() => {
                        onOpenChange(false);
                        openAuth({ reason: "account", mode: "signin" });
                      }}
                      className="auth-wave flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-[0.95rem] font-medium text-navy hover:bg-muted"
                    >
                      <Icon className="h-[1.15rem] w-[1.15rem]" strokeWidth={1.8} />
                      {label}
                    </button>
                  </li>
                );
              }
              return (
                <li key={to}>
                  <Link
                    to={to}
                    onClick={() => onOpenChange(false)}
                    className={cn(
                      "flex items-center gap-3 rounded-lg px-3 py-2.5 text-[0.95rem] font-medium transition-colors",
                      active ? "bg-gold text-navy" : "text-navy hover:bg-muted",
                    )}
                  >
                    <Icon className="h-[1.15rem] w-[1.15rem]" strokeWidth={1.8} />
                    {label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
        <div className="space-y-3 border-t border-border px-5 py-4">
          <LanguageSwitcher />
          <div className="grid grid-cols-2 gap-2">
            <a href={wa} target="_blank" rel="noreferrer" className="btn-base btn-gold btn-sm">
              <MessageCircle className="h-4 w-4" />
              {t.common.whatsapp}
            </a>
            <a href={`tel:${dial}`} className="btn-base btn-outline-navy btn-sm">
              <Phone className="h-4 w-4" />
              {t.common.call}
            </a>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
