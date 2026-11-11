import { Link, useRouterState } from "@tanstack/react-router";
import { Menu, Search, X } from "lucide-react";
import { useEffect, useState } from "react";
import { useAuthUser } from "@/hooks/use-auth";
import { useLang } from "@/i18n/LanguageProvider";
import { cn } from "@/lib/utils";
import { BrandLogo } from "./BrandLogo";
import { HeaderActions } from "./HeaderActions";
import { HeaderSearch } from "./HeaderSearch";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { MobileBottomNav } from "./MobileBottomNav";
import { MobileMenuSheet } from "./MobileMenuSheet";

type NavLink = {
  to: "/" | "/products" | "/services" | "/categories" | "/custom-order" | "/about" | "/contact";
  label: string;
  match: (pathname: string) => boolean;
};

export function SiteHeader({ offerVisible = false }: { offerVisible?: boolean }) {
  const { t } = useLang();
  const { user } = useAuthUser();
  const signedIn = Boolean(user);
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 4);
    on();
    window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, []);

  useEffect(() => {
    setSearchOpen(false);
    setMenuOpen(false);
  }, [pathname]);

  const shop: NavLink = { to: "/products", label: t.shell.shop, match: (p) => p.startsWith("/products") };
  const services: NavLink = { to: "/services", label: t.nav.services, match: (p) => p.startsWith("/services") };
  const categories: NavLink = { to: "/categories", label: t.nav.categories, match: (p) => p.startsWith("/categories") };
  const custom: NavLink = { to: "/custom-order", label: t.nav.custom, match: (p) => p.startsWith("/custom-order") };
  const contact: NavLink = { to: "/contact", label: t.nav.contact, match: (p) => p.startsWith("/contact") };
  const links: NavLink[] = signedIn
    ? [shop, services, categories, custom, contact]
    : [
        { to: "/", label: t.nav.home, match: (p) => p === "/" },
        shop,
        services,
        categories,
        custom,
        { to: "/about", label: t.nav.about, match: (p) => p.startsWith("/about") },
        contact,
      ];

  return (
    <>
      <a
        href="#main"
        className="sr-only z-[60] rounded-md bg-navy px-3 py-2 text-sm font-semibold text-white focus:not-sr-only focus:fixed focus:left-3 focus:top-3"
      >
        {t.shell.skip}
      </a>
      <header
        className={cn(
          "sticky z-40 border-b bg-white transition-shadow duration-200",
          offerVisible ? "top-[2.75rem]" : "top-0",
          scrolled ? "border-border shadow-[0_2px_12px_rgb(20_33_61/0.06)]" : "border-border",
        )}
      >
        <div className="container-page flex h-14 items-center gap-3 lg:h-[4.5rem] lg:gap-6">
          <Link to={signedIn ? "/products" : "/"} className="flex min-w-0 shrink-0 items-center" aria-label="GK Furnish">
            <BrandLogo
              markClassName="h-8 lg:h-10"
              wordmarkClassName="!text-base sm:!text-lg lg:!text-xl max-[340px]:hidden"
              tagline={undefined}
            />
          </Link>

          <nav aria-label="Primary" className="hidden min-w-0 flex-1 items-center justify-center gap-1 lg:flex">
            {links.map((l) => {
              const active = l.match(pathname);
              return (
                <Link
                  key={l.to}
                  to={l.to}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "whitespace-nowrap rounded-full px-3.5 py-2 text-[0.9rem] font-medium transition-colors",
                    active ? "bg-gold font-semibold text-navy" : "text-navy/70 hover:bg-sand hover:text-navy",
                  )}
                >
                  {l.label}
                </Link>
              );
            })}
          </nav>

          <div className="ml-auto flex shrink-0 items-center gap-1 lg:ml-0 lg:gap-2">
            <HeaderSearch className="hidden w-60 xl:block 2xl:w-72" />
            <button
              type="button"
              className="icon-btn xl:hidden"
              aria-label={t.shell.searchLabel}
              aria-expanded={searchOpen}
              onClick={() => setSearchOpen((v) => !v)}
            >
              {searchOpen ? <X className="h-5 w-5" /> : <Search className="h-5 w-5" strokeWidth={1.8} />}
            </button>
            <span className="hidden sm:inline-flex">
              <LanguageSwitcher compact />
            </span>
            <HeaderActions showAccount />
            <button
              type="button"
              className="icon-btn lg:hidden"
              aria-label={t.shell.openMenu}
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen(true)}
            >
              <Menu className="h-5 w-5" />
            </button>
          </div>
        </div>
        {searchOpen && (
          <div className="border-t border-border bg-white xl:hidden">
            <div className="container-page py-2.5">
              <HeaderSearch autoFocus onDone={() => setSearchOpen(false)} />
            </div>
          </div>
        )}
      </header>

      <MobileMenuSheet open={menuOpen} onOpenChange={setMenuOpen} />
      <MobileBottomNav />
    </>
  );
}
