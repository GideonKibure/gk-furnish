import { Link, useRouterState } from "@tanstack/react-router";
import {
  FileText,
  LayoutDashboard,
  LogOut,
  Megaphone,
  Package,
  Settings,
  ShoppingBag,
  Sparkles,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { SITE } from "@/config/site";
import { cn } from "@/lib/utils";

const links: { to: string; label: string; icon: typeof LayoutDashboard; exact?: boolean }[] = [
  { to: "/admin", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { to: "/admin/products", label: "Products", icon: Package },
  { to: "/admin/orders", label: "Orders", icon: ShoppingBag },
  { to: "/admin/custom-orders", label: "Custom orders", icon: Sparkles },
  { to: "/admin/content", label: "Page content", icon: FileText },
  { to: "/admin/popups", label: "Offer popups", icon: Megaphone },
  { to: "/admin/settings", label: "Site settings", icon: Settings },
];

export function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  async function signOut() {
    await supabase.auth.signOut();
    window.location.href = "/admin/login";
  }

  return (
    <div className="admin-shell min-h-dvh bg-[linear-gradient(180deg,color-mix(in_oklab,var(--sand)_88%,white),var(--sand))]">
      <div className="flex min-h-dvh">
        <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col bg-navy text-primary-foreground md:flex lg:w-64">
          <div className="flex items-center gap-3 border-b border-white/10 px-4 py-5">
            <span className="grid h-11 w-11 place-items-center overflow-hidden rounded-full bg-white p-1 shadow-[0_0_20px_-6px_color-mix(in_oklab,var(--gold)_55%,transparent)]">
              <img src="/brand/gk-furnish-logo.svg" alt="" className="h-full w-full object-contain" />
            </span>
            <div className="min-w-0">
              <p className="truncate font-display text-base font-semibold tracking-tight">{SITE.name}</p>
              <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-gold/80">Admin portal</p>
            </div>
          </div>

          <nav className="flex flex-1 flex-col gap-1 overflow-y-auto p-3">
            {links.map(({ to, label, icon: Icon, exact }) => {
              const active = exact ? pathname === to : pathname.startsWith(to);
              return (
                <Link
                  key={to}
                  to={to as "/admin"}
                  className={cn(
                    "group flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200",
                    active
                      ? "bg-gold text-navy shadow-[var(--shadow-gold)]"
                      : "text-white/70 hover:bg-white/8 hover:text-white",
                  )}
                >
                  <Icon className={cn("h-4 w-4 shrink-0", active ? "text-navy" : "text-gold/80")} />
                  {label}
                </Link>
              );
            })}
          </nav>

          <div className="border-t border-white/10 p-3">
            <button
              type="button"
              onClick={signOut}
              className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-medium text-white/65 transition-colors hover:bg-white/8 hover:text-white"
            >
              <LogOut className="h-4 w-4" />
              Sign out
            </button>
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-20 border-b border-border/70 bg-background/90 backdrop-blur-xl md:hidden">
            <div className="flex items-center justify-between gap-2 px-3 py-3">
              <div className="flex items-center gap-2.5">
                <span className="grid h-9 w-9 place-items-center overflow-hidden rounded-full bg-white p-0.5 ring-1 ring-border">
                  <img src="/brand/gk-furnish-logo.svg" alt="" className="h-full w-full object-contain" />
                </span>
                <div>
                  <p className="font-display text-sm font-semibold text-navy">{SITE.name}</p>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Admin</p>
                </div>
              </div>
              <button type="button" onClick={signOut} className="rounded-full bg-secondary px-3 py-1.5 text-xs font-semibold text-navy">
                Sign out
              </button>
            </div>
            <nav className="flex gap-1.5 overflow-x-auto px-2 pb-3">
              {links.map(({ to, label, exact }) => {
                const active = exact ? pathname === to : pathname.startsWith(to);
                return (
                  <Link
                    key={to}
                    to={to as "/admin"}
                    className={cn(
                      "shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors",
                      active ? "bg-navy text-primary-foreground" : "bg-secondary text-navy hover:bg-secondary/80",
                    )}
                  >
                    {label}
                  </Link>
                );
              })}
            </nav>
          </header>

          <main className="flex-1 px-4 py-6 md:px-8 md:py-8 lg:px-10">{children}</main>
        </div>
      </div>
    </div>
  );
}
