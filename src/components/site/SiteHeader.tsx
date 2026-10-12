import { Link, useRouterState } from "@tanstack/react-router";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useLang } from "@/i18n/LanguageProvider";
import { BrandLogo } from "./BrandLogo";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { MobileBottomNav } from "./MobileBottomNav";
import { cn } from "@/lib/utils";
import { SITE } from "@/config/site";

type DesktopLink = {
  to: "/" | "/products" | "/categories" | "/custom-order" | "/gallery" | "/about" | "/contact";
  label: string;
  match: (pathname: string) => boolean;
};

export function SiteHeader({ offerVisible = false }: { offerVisible?: boolean }) {
  const { t } = useLang();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const isHome = pathname === "/";
  const [scrolled, setScrolled] = useState(false);
  const [navHidden, setNavHidden] = useState(false);
  const lastY = useRef(0);
  const overlay = isHome && !scrolled;
  const trackRef = useRef<HTMLDivElement>(null);
  const cellRefs = useRef<(HTMLAnchorElement | null)[]>([]);
  const [indicator, setIndicator] = useState({ x: 0, w: 0, ready: false });

  const links: DesktopLink[] = useMemo(
    () => [
      { to: "/", label: t.nav.home, match: (p) => p === "/" },
      { to: "/products", label: t.nav.products, match: (p) => p.startsWith("/products") },
      { to: "/categories", label: t.nav.categories, match: (p) => p.startsWith("/categories") },
      { to: "/custom-order", label: t.nav.custom, match: (p) => p.startsWith("/custom-order") },
      { to: "/gallery", label: t.nav.gallery, match: (p) => p.startsWith("/gallery") },
      { to: "/about", label: t.nav.about, match: (p) => p.startsWith("/about") },
      { to: "/contact", label: t.nav.contact, match: (p) => p.startsWith("/contact") },
    ],
    [t],
  );

  const activeIndex = links.findIndex((l) => l.match(pathname));

  useEffect(() => {
    lastY.current = window.scrollY;
    const on = () => {
      const y = window.scrollY;
      setScrolled(y > 12);
      const delta = y - lastY.current;
      if (y < 48) {
        setNavHidden(false);
      } else if (delta > 8) {
        setNavHidden(true);
      } else if (delta < -8) {
        setNavHidden(false);
      }
      lastY.current = y;
    };
    window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, []);

  // Show nav again when the route changes
  useEffect(() => {
    setNavHidden(false);
    lastY.current = window.scrollY;
  }, [pathname]);

  useLayoutEffect(() => {
    const track = trackRef.current;
    if (!track || activeIndex < 0) {
      setIndicator((prev) => ({ ...prev, ready: false }));
      return;
    }

    const measure = () => {
      const cell = cellRefs.current[activeIndex];
      if (!cell) return;
      const trackBox = track.getBoundingClientRect();
      const cellBox = cell.getBoundingClientRect();
      setIndicator({
        x: cellBox.left - trackBox.left,
        w: cellBox.width,
        ready: true,
      });
    };

    measure();
    requestAnimationFrame(measure);

    const ro = new ResizeObserver(() => requestAnimationFrame(measure));
    ro.observe(track);
    cellRefs.current.forEach((el) => el && ro.observe(el));
    window.addEventListener("resize", measure);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [activeIndex, pathname, links]);

  return (
    <>
      {/* Compact header — mobile / tablet (bottom dock carries primary nav) */}
      <header
        className={cn(
          "z-40 border-b border-transparent transition-[top,box-shadow,border-color,background-color,color] duration-300 lg:hidden",
          isHome ? "fixed inset-x-0" : "sticky",
          offerVisible ? "top-[3.25rem] sm:top-[3.5rem]" : "top-0",
          overlay
            ? "bg-transparent text-white !shadow-none"
            : scrolled
              ? "border-border/60 bg-background/90 shadow-[var(--shadow-card)] backdrop-blur-xl"
              : "bg-background/90 backdrop-blur-xl !shadow-none",
        )}
      >
        <div className="container-page flex h-16 items-center justify-between gap-4">
          <Link to="/" className="group shrink-0 transition-transform duration-300 hover:scale-[1.02]">
            <BrandLogo
              light={overlay}
              markClassName="h-10 drop-shadow-sm"
              wordmarkClassName={overlay ? "text-white" : "text-navy"}
            />
          </Link>
          <LanguageSwitcher dark={overlay} />
        </div>
      </header>

      {/* Desktop floating navy dock — hides on scroll down, returns on scroll up */}
      <header
        className={cn(
          "desktop-dock pointer-events-none z-40 hidden lg:block",
          "fixed inset-x-0 transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]",
          offerVisible ? "top-[3.5rem]" : "top-0",
          navHidden ? "-translate-y-[120%]" : "translate-y-0",
        )}
      >
        <div className="container-page pointer-events-none px-4 pt-4 pb-2 xl:px-6">
          <div
            className={cn(
              "desktop-dock-glow pointer-events-auto mx-auto max-w-6xl transition-[box-shadow,transform] duration-500",
              scrolled && "desktop-dock-glow-scrolled",
            )}
          >
            <span className="desktop-dock-glow-spin" aria-hidden />
            <span className="desktop-dock-glow-pulse" aria-hidden />

            <div className="desktop-dock-shell flex items-center gap-3 px-2.5 py-2 xl:gap-4 xl:px-3">
              <Link
                to="/"
                className="desktop-dock-brand group flex shrink-0 items-center gap-2 rounded-full py-1 pl-1 pr-3 transition-transform duration-300 hover:scale-[1.02]"
              >
                <span className="desktop-dock-mark grid h-10 w-10 place-items-center overflow-hidden rounded-full bg-white/95 p-0.5">
                  <img
                    src="/brand/gk-furnish-logo.svg"
                    alt=""
                    className="h-full w-full object-contain"
                  />
                </span>
                <span className="hidden font-display text-[1.05rem] font-semibold tracking-tight text-white xl:inline">
                  {SITE.name}
                </span>
              </Link>

              <div className="desktop-dock-divider hidden h-7 w-px shrink-0 sm:block" aria-hidden />

              <nav
                ref={trackRef}
                aria-label="Primary"
                className="relative flex min-w-0 flex-1 items-center justify-center gap-0.5"
              >
                <div
                  aria-hidden
                  className={cn(
                    "desktop-dock-indicator absolute top-0.5 bottom-0.5 rounded-full",
                    "transition-[transform,width,opacity] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]",
                    indicator.ready ? "opacity-100" : "opacity-0",
                  )}
                  style={{
                    width: indicator.w,
                    transform: `translate3d(${indicator.x}px, 0, 0)`,
                  }}
                />

                {links.map((l, i) => {
                  const active = i === activeIndex;
                  return (
                    <Link
                      key={l.to}
                      ref={(node) => {
                        cellRefs.current[i] = node;
                      }}
                      to={l.to}
                      className={cn(
                        "desktop-dock-link relative z-10 rounded-full px-3 py-2 font-sans text-[0.8125rem] font-medium tracking-wide outline-none transition-colors duration-300 xl:px-3.5",
                        active
                          ? "text-navy"
                          : "text-white/70 hover:text-white",
                        active && "desktop-dock-link-active font-semibold",
                      )}
                    >
                      {l.label}
                    </Link>
                  );
                })}
              </nav>

              <div className="desktop-dock-divider hidden h-7 w-px shrink-0 sm:block" aria-hidden />

              <div className="flex shrink-0 items-center gap-2 pr-0.5">
                <LanguageSwitcher dark />
                <Link to="/products" className="desktop-dock-cta">
                  {t.nav.orderNow}
                </Link>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Clearance for the fixed floating desktop dock (non-home only) */}
      {!isHome && <div className="hidden h-[5rem] lg:block" aria-hidden />}

      <MobileBottomNav />
    </>
  );
}
