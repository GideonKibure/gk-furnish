import { Link, useRouterState } from "@tanstack/react-router";
import { Home, Images, Package, Phone, Sparkles } from "lucide-react";
import { useLayoutEffect, useMemo, useRef, useState, type ComponentType } from "react";
import { useLang } from "@/i18n/LanguageProvider";
import { cn } from "@/lib/utils";

type NavIcon = ComponentType<{ className?: string; strokeWidth?: number | string }>;

type DockLink = {
  to: "/" | "/products" | "/custom-order" | "/gallery" | "/contact";
  label: string;
  icon: NavIcon;
  match: (pathname: string) => boolean;
};

export function MobileBottomNav() {
  const { t } = useLang();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const trackRef = useRef<HTMLDivElement>(null);
  const cellRefs = useRef<(HTMLDivElement | null)[]>([]);
  const [indicator, setIndicator] = useState({ x: 0, y: 0, w: 0, h: 0, ready: false });
  const [pressed, setPressed] = useState<string | null>(null);

  const links: DockLink[] = useMemo(
    () => [
      { to: "/", label: t.nav.home, icon: Home, match: (p) => p === "/" },
      {
        to: "/products",
        label: t.nav.products,
        icon: Package,
        match: (p) => p.startsWith("/products") || p.startsWith("/categories"),
      },
      { to: "/custom-order", label: t.nav.custom, icon: Sparkles, match: (p) => p.startsWith("/custom-order") },
      { to: "/gallery", label: t.nav.gallery, icon: Images, match: (p) => p.startsWith("/gallery") },
      { to: "/contact", label: t.nav.contact, icon: Phone, match: (p) => p.startsWith("/contact") },
    ],
    [t],
  );

  const activeIndex = Math.max(
    0,
    links.findIndex((l) => l.match(pathname)),
  );

  useLayoutEffect(() => {
    const track = trackRef.current;
    if (!track) return;

    const measure = () => {
      const cell = cellRefs.current[activeIndex];
      if (!cell) return;
      const trackBox = track.getBoundingClientRect();
      const cellBox = cell.getBoundingClientRect();
      // Compact gold circle sized to the icon bubble, not the full cell
      const size = Math.min(cellBox.width - 10, 36);
      const x = cellBox.left - trackBox.left + (cellBox.width - size) / 2;
      const y = cellBox.top - trackBox.top + 6;
      setIndicator({
        x,
        y,
        w: size,
        h: size,
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
    <nav
      aria-label={t.nav.menu}
      className="mobile-dock pointer-events-none fixed inset-x-0 bottom-0 z-50 px-3 pb-[max(0.7rem,env(safe-area-inset-bottom))] sm:px-6 lg:hidden"
    >
      <div className="mobile-dock-glow pointer-events-auto relative mx-auto w-full max-w-md sm:max-w-lg">
        <span className="mobile-dock-glow-spin" aria-hidden />
        <span className="mobile-dock-glow-pulse" aria-hidden />

        <div className="mobile-dock-shell relative">
          <div ref={trackRef} className="relative grid grid-cols-5 gap-1 p-1.5 sm:gap-1.5 sm:p-2">
            <div
              aria-hidden
              className={cn(
                "mobile-dock-indicator absolute rounded-full",
                "transition-[transform,width,height,opacity] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]",
                indicator.ready ? "opacity-100" : "opacity-0",
              )}
              style={{
                width: indicator.w,
                height: indicator.h,
                transform: `translate3d(${indicator.x}px, ${indicator.y}px, 0)`,
              }}
            />

            {links.map((l, i) => {
              const active = i === activeIndex;
              const Icon = l.icon;
              return (
                <div
                  key={l.to}
                  ref={(node) => {
                    cellRefs.current[i] = node;
                  }}
                  className="min-w-0"
                >
                  <Link
                    to={l.to}
                    onPointerDown={() => setPressed(l.to)}
                    onPointerUp={() => setPressed(null)}
                    onPointerLeave={() => setPressed(null)}
                    onClick={() => {
                      setPressed(l.to);
                      window.setTimeout(() => setPressed(null), 280);
                    }}
                    className={cn(
                      "mobile-dock-link relative z-10 flex h-full w-full flex-col items-center justify-center gap-1 rounded-full px-0.5 py-2 font-sans outline-none transition-all duration-300 sm:py-2.5",
                      active ? "text-navy" : "text-white/72 hover:text-white",
                      pressed === l.to && "scale-[0.9]",
                      active && "mobile-dock-link-active",
                    )}
                  >
                    <span
                      className={cn(
                        "grid h-8 w-8 place-items-center rounded-full transition-all duration-400 ease-[cubic-bezier(0.22,1,0.36,1)] sm:h-9 sm:w-9",
                        active && "mobile-dock-icon-pop",
                      )}
                    >
                      <Icon
                        className={cn(
                          "h-[1.2rem] w-[1.2rem] transition-transform duration-300 sm:h-5 sm:w-5",
                          active && "scale-110",
                        )}
                        strokeWidth={active ? 2.55 : 2.1}
                      />
                    </span>
                    <span
                      className={cn(
                        "max-w-full truncate px-0.5 text-center text-[0.64rem] font-bold leading-none tracking-[0.02em] sm:text-[0.72rem]",
                        active ? "text-gold" : "text-white/85",
                      )}
                    >
                      {l.label}
                    </span>
                    <span
                      className={cn(
                        "h-1 w-1 rounded-full transition-all duration-400 ease-[cubic-bezier(0.22,1,0.36,1)]",
                        active ? "scale-100 bg-gold opacity-100" : "scale-0 bg-gold opacity-0",
                      )}
                    />
                  </Link>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </nav>
  );
}
