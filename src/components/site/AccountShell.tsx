import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import {
  Bell,
  LayoutDashboard,
  Loader2,
  LogOut,
  MapPin,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import type { ReactNode } from "react";
import { Breadcrumbs } from "@/components/brand/Breadcrumbs";
import { useRequireCustomer } from "@/hooks/use-require-customer";
import { supabase } from "@/integrations/supabase/client";
import { useLang } from "@/i18n/LanguageProvider";
import { getMyRole, listMyNotifications } from "@/lib/account.functions";
import { cn } from "@/lib/utils";

export type AccountSection = "overview" | "addresses" | "requests" | "notifications";

/** Shared layout for signed-in customer pages: sidebar (chips on mobile) plus content. */
export function AccountShell({
  active,
  title,
  children,
  crumbs,
}: {
  active: AccountSection;
  title: string;
  children: ReactNode;
  crumbs?: { label: string; href?: string }[];
}) {
  const { t } = useLang();
  const nav = useNavigate();
  const { user } = useRequireCustomer();
  const loadRole = useServerFn(getMyRole);
  const loadNotes = useServerFn(listMyNotifications);
  const { data: role } = useQuery({
    queryKey: ["my-role", user?.id],
    queryFn: () => loadRole(),
    enabled: Boolean(user),
    staleTime: 5 * 60_000,
  });
  const { data: notes } = useQuery({
    queryKey: ["my-notifications", user?.id],
    queryFn: () => loadNotes(),
    enabled: Boolean(user),
    staleTime: 30_000,
    retry: false,
  });

  async function signOut() {
    await supabase.auth.signOut();
    void nav({ to: "/" });
  }

  const links = [
    {
      key: "overview" as const,
      to: "/account" as const,
      label: t.accountNav.overview,
      icon: LayoutDashboard,
    },
    {
      key: "addresses" as const,
      to: "/account/addresses" as const,
      label: t.accountNav.addresses,
      icon: MapPin,
    },
    {
      key: "requests" as const,
      to: "/account/requests" as const,
      label: t.accountNav.requests,
      icon: Sparkles,
    },
    {
      key: "notifications" as const,
      to: "/account/notifications" as const,
      label: t.accountNav.notifications,
      icon: Bell,
      badge: notes?.unread ?? 0,
    },
  ];

  return (
    <div className="bg-sand">
      <div className="container-page py-5 md:py-8">
        <Breadcrumbs
          items={
            crumbs ?? [
              { label: t.nav.home, href: "/" },
              { label: t.account.title, href: "/account" },
              { label: title },
            ]
          }
        />
        <h1 className="display-lg mt-2">{title}</h1>
        {user?.email && <p className="mt-0.5 text-sm text-muted-foreground">{user.email}</p>}

        <div className="mt-5 grid gap-5 lg:grid-cols-[14.5rem_minmax(0,1fr)] lg:gap-8">
          <aside className="min-w-0">
            <nav
              aria-label={t.account.title}
              className="flex gap-2 overflow-x-auto no-scrollbar lg:sticky lg:top-24 lg:flex-col lg:gap-1 lg:rounded-xl lg:border lg:border-border lg:bg-white lg:p-2"
            >
              {links.map(({ key, to, label, icon: Icon, badge }) => (
                <Link
                  key={key}
                  to={to}
                  aria-current={active === key ? "page" : undefined}
                  className={cn(
                    "flex shrink-0 items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                    active === key
                      ? "bg-gold text-navy"
                      : "border border-border bg-white text-navy hover:bg-muted lg:border-0 lg:bg-transparent",
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {label}
                  {badge ? (
                    <span className="ml-auto grid h-5 min-w-5 place-items-center rounded-full bg-navy px-1.5 text-[0.65rem] font-bold text-white">
                      {badge}
                    </span>
                  ) : null}
                </Link>
              ))}
              {role?.isAdmin && (
                <Link
                  to="/admin"
                  className="flex shrink-0 items-center gap-2.5 rounded-lg border border-border bg-white px-3 py-2 text-sm font-medium text-navy hover:bg-muted lg:border-0 lg:bg-transparent"
                >
                  <ShieldCheck className="h-4 w-4" />
                  {t.account.adminPortal}
                </Link>
              )}
              <button
                type="button"
                onClick={() => void signOut()}
                className="flex shrink-0 items-center gap-2.5 rounded-lg border border-border bg-white px-3 py-2 text-left text-sm font-medium text-danger hover:bg-danger-soft lg:border-0 lg:bg-transparent"
              >
                <LogOut className="h-4 w-4" />
                {t.account.signOut}
              </button>
            </nav>
          </aside>
          <div className="min-w-0">
            {user ? (
              children
            ) : (
              <p className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                {t.common.loading}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
