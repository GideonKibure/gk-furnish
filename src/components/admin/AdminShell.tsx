import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import {
  Bell,
  Boxes,
  ChevronDown,
  CreditCard,
  ExternalLink,
  Factory,
  FileText,
  FolderTree,
  Images,
  KeyRound,
  Landmark,
  LayoutDashboard,
  LogOut,
  Mail,
  Megaphone,
  Menu,
  MoreHorizontal,
  Package,
  PieChart,
  Receipt,
  Search,
  Settings,
  ShoppingBag,
  ShoppingCart,
  Sparkles,
  Star,
  Truck,
  Users,
  Wrench,
  X,
  type LucideIcon,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { SITE } from "@/config/site";
import { supabase } from "@/integrations/supabase/client";
import { adminQuickSearch, listStaffNotifications, markStaffNotificationsRead } from "@/lib/ops/portal.functions";
import { orderStatusLabel, orderStatusTone } from "@/lib/ops/status";
import { cn } from "@/lib/utils";
import { StatusPill, formatDate, tzs } from "./admin-ui";

type NavItem = { to: string; label: string; icon: LucideIcon; exact?: boolean; soon?: boolean };
type NavGroup = { label: string; items: NavItem[] };

const NAV: NavGroup[] = [
  { label: "Overview", items: [{ to: "/admin", label: "Dashboard", icon: LayoutDashboard, exact: true }] },
  {
    label: "Sales",
    items: [
      { to: "/admin/orders", label: "Orders", icon: ShoppingBag },
      { to: "/admin/custom-orders", label: "Custom requests", icon: Sparkles },
      { to: "/admin/customers", label: "Customers", icon: Users },
      { to: "/admin/payments", label: "Payments", icon: CreditCard },
    ],
  },
  {
    label: "Catalogue",
    items: [
      { to: "/admin/products", label: "Products", icon: Package },
      { to: "/admin/categories", label: "Categories", icon: FolderTree },
      { to: "/admin/services", label: "Services", icon: Wrench },
      { to: "/admin/reviews", label: "Reviews", icon: Star },
    ],
  },
  {
    label: "Content",
    items: [
      { to: "/admin/content", label: "Page content", icon: FileText },
      { to: "/admin/images", label: "Site images", icon: Images },
      { to: "/admin/popups", label: "Offer popups", icon: Megaphone },
      { to: "/admin/messages", label: "Messages", icon: Mail },
    ],
  },
  {
    label: "Operations",
    items: [
      { to: "/admin/inventory", label: "Inventory", icon: Boxes },
      { to: "/admin/production", label: "Production", icon: Factory },
      { to: "/admin/suppliers", label: "Suppliers", icon: Truck },
      { to: "/admin/purchases", label: "Purchases", icon: ShoppingCart },
    ],
  },
  {
    label: "Finance",
    items: [
      { to: "/admin/expenses", label: "Expenses", icon: Receipt },
      { to: "/admin/finance", label: "Capital & assets", icon: Landmark },
      { to: "/admin/reports", label: "Reports", icon: PieChart },
    ],
  },
  {
    label: "Settings",
    items: [
      { to: "/admin/settings", label: "Site settings", icon: Settings },
      { to: "/admin/account", label: "Account & security", icon: KeyRound },
    ],
  },
];

const TABS: NavItem[] = [
  { to: "/admin", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { to: "/admin/orders", label: "Orders", icon: ShoppingBag },
  { to: "/admin/products", label: "Products", icon: Package },
];

function isActive(pathname: string, item: NavItem) {
  if (item.soon) return false;
  const path = pathname.replace(/\/+$/, "") || "/";
  return item.exact ? path === item.to : path === item.to || path.startsWith(`${item.to}/`);
}

async function signOut() {
  await supabase.auth.signOut();
  window.location.href = "/account/login";
}

/** Close a popover on outside click or Escape. */
function useDismiss(open: boolean, close: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    function onPointer(e: PointerEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) close();
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") close();
    }
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, close]);
  return ref;
}

function useAdminEmail() {
  const [email, setEmail] = useState("");
  useEffect(() => {
    let alive = true;
    void supabase.auth.getUser().then(({ data }) => {
      if (alive) setEmail(data.user?.email ?? "");
    });
    return () => {
      alive = false;
    };
  }, []);
  return email;
}

function Logo({ className }: { className?: string }) {
  return (
    <span className={cn("grid shrink-0 place-items-center overflow-hidden rounded-full bg-white p-1", className)}>
      <img src="/brand/gk-furnish-logo.svg" alt="" className="h-full w-full object-contain" />
    </span>
  );
}

function NavList({ pathname, tone, onNavigate }: { pathname: string; tone: "dark" | "light"; onNavigate?: () => void }) {
  const dark = tone === "dark";
  return (
    <nav aria-label="Admin" className="space-y-4">
      {NAV.map((group) => (
        <div key={group.label}>
          <p
            className={cn(
              "mb-1 flex items-center gap-2 px-3 text-[0.68rem] font-semibold uppercase tracking-[0.12em]",
              dark ? "text-white/45" : "text-[#9CA3AF]",
            )}
          >
            {group.label}
            {group.items.every((i) => i.soon) && (
              <span className={cn("rounded px-1.5 py-px text-[0.6rem] tracking-wide", dark ? "bg-white/10 text-white/60" : "bg-[#F3F4F6] text-[#6B7280]")}>
                Phase 2
              </span>
            )}
          </p>
          <ul className="space-y-0.5">
            {group.items.map((item) => {
              const Icon = item.icon;
              if (item.soon) {
                return (
                  <li key={item.to}>
                    <span
                      aria-disabled="true"
                      title="Coming soon"
                      className={cn(
                        "flex cursor-not-allowed items-center gap-3 rounded-lg px-3 py-2 text-sm",
                        dark ? "text-white/35" : "text-[#9CA3AF]",
                      )}
                    >
                      <Icon className="h-4 w-4 shrink-0" />
                      <span className="flex-1">{item.label}</span>
                      <span className="text-[0.65rem] font-semibold uppercase tracking-wide">Soon</span>
                    </span>
                  </li>
                );
              }
              const active = isActive(pathname, item);
              return (
                <li key={item.to}>
                  <Link
                    to={item.to as "/admin"}
                    onClick={onNavigate}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                      active
                        ? "bg-gold font-semibold text-navy"
                        : dark
                          ? "text-white/80 hover:bg-white/8 hover:text-white"
                          : "text-[#374151] hover:bg-[#F5F6F8]",
                    )}
                  >
                    <Icon className={cn("h-4 w-4 shrink-0", active ? "text-navy" : dark ? "text-white/60" : "text-[#6B7280]")} />
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}

type SearchResult = Awaited<ReturnType<typeof adminQuickSearch>>;

function AdminSearch({ autoFocus, onDone }: { autoFocus?: boolean; onDone?: () => void }) {
  const search = useServerFn(adminQuickSearch);
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [result, setResult] = useState<SearchResult | null>(null);
  const [loading, setLoading] = useState(false);
  const close = useCallback(() => setOpen(false), []);
  const ref = useDismiss(open, close);

  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) {
      setResult(null);
      return;
    }
    setLoading(true);
    const timer = window.setTimeout(() => {
      search({ data: { q: term } })
        .then((r) => setResult(r))
        .catch(() => setResult({ orders: [], products: [] }))
        .finally(() => setLoading(false));
    }, 250);
    return () => window.clearTimeout(timer);
  }, [q, search]);

  function go(to: "/admin/orders" | "/admin/products", term: string) {
    setOpen(false);
    setQ("");
    onDone?.();
    void navigate({ to, search: { q: term } });
  }

  const hasResults = Boolean(result && (result.orders.length || result.products.length));

  return (
    <div ref={ref} className="relative w-full">
      <form
        role="search"
        onSubmit={(e) => {
          e.preventDefault();
          if (q.trim()) go("/admin/orders", q.trim());
        }}
      >
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9CA3AF]" />
        <input
          type="search"
          value={q}
          autoFocus={autoFocus}
          onFocus={() => setOpen(true)}
          onChange={(e) => {
            setQ(e.target.value);
            setOpen(true);
          }}
          placeholder="Search orders, customers, products…"
          aria-label="Search orders and products"
          className="h-10 w-full rounded-lg border border-[#E5E5E5] bg-[#F5F6F8] pl-9 pr-3 text-sm text-navy placeholder:text-[#9CA3AF] focus:border-gold focus:bg-white focus:outline-none focus:ring-2 focus:ring-gold/25"
        />
      </form>
      {open && q.trim().length >= 2 && (
        <div className="absolute left-0 right-0 top-full z-40 mt-1.5 overflow-hidden rounded-xl border border-[#E5E5E5] bg-white shadow-[0_12px_32px_-12px_rgba(20,33,61,0.25)]">
          {loading && !result ? (
            <p className="px-4 py-3 text-sm text-[#6B7280]">Searching…</p>
          ) : !hasResults ? (
            <p className="px-4 py-3 text-sm text-[#6B7280]">No orders or products match “{q.trim()}”.</p>
          ) : (
            <div className="max-h-[60vh] overflow-y-auto py-1">
              {result!.orders.length > 0 && (
                <p className="px-4 pb-1 pt-2 text-[0.68rem] font-semibold uppercase tracking-wide text-[#9CA3AF]">Orders</p>
              )}
              {result!.orders.map((o) => (
                <button
                  key={o.id}
                  type="button"
                  onClick={() => go("/admin/orders", o.order_number)}
                  className="flex w-full items-center justify-between gap-3 px-4 py-2 text-left hover:bg-[#F5F6F8]"
                >
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold text-navy">#{o.order_number}</span>
                    <span className="block truncate text-xs text-[#6B7280]">
                      {o.customer_name} · {tzs(Number(o.total_amount))}
                    </span>
                  </span>
                  <StatusPill tone={orderStatusTone(o.status)}>{orderStatusLabel(o.status)}</StatusPill>
                </button>
              ))}
              {result!.products.length > 0 && (
                <p className="px-4 pb-1 pt-2 text-[0.68rem] font-semibold uppercase tracking-wide text-[#9CA3AF]">Products</p>
              )}
              {result!.products.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => go("/admin/products", p.name)}
                  className="flex w-full items-center justify-between gap-3 px-4 py-2 text-left hover:bg-[#F5F6F8]"
                >
                  <span className="min-w-0 truncate text-sm font-medium text-navy">{p.name}</span>
                  <span className="shrink-0 text-xs text-[#6B7280]">{p.stock_quantity} in stock</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

type NotificationData = Awaited<ReturnType<typeof listStaffNotifications>>;

/** Where a staff notification should open in the portal. */
function notificationHref(n: NotificationData["items"][number]) {
  if (n.type.startsWith("review")) return "/admin/reviews";
  const orderNumber = n.type.startsWith("order") ? /\b[A-Z]{2,}-\d{4}-\d+\b/.exec(n.title)?.[0] : undefined;
  if (orderNumber) return `/admin/orders?q=${encodeURIComponent(orderNumber)}`;
  return n.link?.startsWith("/admin") ? n.link : null;
}

function NotificationBell() {
  const navigate = useNavigate();
  const load = useServerFn(listStaffNotifications);
  const markRead = useServerFn(markStaffNotificationsRead);
  const [data, setData] = useState<NotificationData | null>(null);
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);
  const ref = useDismiss(open, close);

  const refresh = useCallback(() => {
    load()
      .then(setData)
      .catch(() => setData(null));
  }, [load]);

  useEffect(() => {
    refresh();
    const timer = window.setInterval(refresh, 60_000);
    return () => window.clearInterval(timer);
  }, [refresh]);

  if (!data?.available) return null;

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={data.unread ? `Notifications, ${data.unread} unread` : "Notifications"}
        aria-expanded={open}
        className="relative grid h-10 w-10 place-items-center rounded-lg text-navy hover:bg-[#F5F6F8]"
      >
        <Bell className="h-5 w-5" />
        {data.unread > 0 && (
          <span className="absolute right-1.5 top-1.5 grid h-4 min-w-4 place-items-center rounded-full bg-[#DC2626] px-1 text-[0.6rem] font-bold text-white">
            {data.unread > 9 ? "9+" : data.unread}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute right-0 top-full z-40 mt-1.5 w-[min(22rem,calc(100vw-1.5rem))] overflow-hidden rounded-xl border border-[#E5E5E5] bg-white shadow-[0_12px_32px_-12px_rgba(20,33,61,0.25)]">
          <div className="flex items-center justify-between border-b border-[#F0F0F0] px-4 py-3">
            <p className="text-sm font-semibold text-navy">Notifications</p>
            {data.unread > 0 && (
              <button
                type="button"
                className="text-xs font-semibold text-[#B86A00] hover:underline"
                onClick={() => {
                  void markRead({ data: {} }).then(refresh);
                }}
              >
                Mark all read
              </button>
            )}
          </div>
          {data.items.length ? (
            <ul className="max-h-[60vh] divide-y divide-[#F0F0F0] overflow-y-auto">
              {data.items.map((n) => {
                const body = (
                  <>
                    <span className="flex items-start gap-2">
                      {!n.read_at && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-gold" aria-label="Unread" />}
                      <span className="min-w-0">
                        <span className="block text-sm font-medium text-navy">{n.title}</span>
                        {n.body && <span className="mt-0.5 block text-xs text-[#6B7280]">{n.body}</span>}
                        <span className="mt-1 block text-[0.7rem] text-[#9CA3AF]">{formatDate(n.created_at, true)}</span>
                      </span>
                    </span>
                  </>
                );
                const href = notificationHref(n);
                return (
                  <li key={n.id}>
                    {href ? (
                      <a
                        href={href}
                        onClick={(e) => {
                          e.preventDefault();
                          setOpen(false);
                          if (!n.read_at) void markRead({ data: { ids: [n.id] } }).then(refresh);
                          void navigate({ href });
                        }}
                        className="block px-4 py-3 hover:bg-[#F5F6F8]"
                      >
                        {body}
                      </a>
                    ) : (
                      <div className="px-4 py-3">{body}</div>
                    )}
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="px-4 py-8 text-center text-sm text-[#6B7280]">You are all caught up.</p>
          )}
        </div>
      )}
    </div>
  );
}

function AvatarMenu({ email }: { email: string }) {
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);
  const ref = useDismiss(open, close);
  const initial = (email[0] ?? "A").toUpperCase();
  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label="Account menu"
        className="flex items-center gap-2 rounded-lg p-1 pr-2 hover:bg-[#F5F6F8]"
      >
        <span className="grid h-8 w-8 place-items-center rounded-full bg-navy text-sm font-semibold text-white">{initial}</span>
        <span className="hidden text-sm font-semibold text-navy sm:block">Admin</span>
        <ChevronDown className="hidden h-4 w-4 text-[#6B7280] sm:block" />
      </button>
      {open && (
        <div className="absolute right-0 top-full z-40 mt-1.5 w-60 overflow-hidden rounded-xl border border-[#E5E5E5] bg-white py-1 shadow-[0_12px_32px_-12px_rgba(20,33,61,0.25)]">
          <div className="border-b border-[#F0F0F0] px-4 py-3">
            <p className="text-sm font-semibold text-navy">Administrator</p>
            <p className="truncate text-xs text-[#6B7280]">{email || "Signed in"}</p>
          </div>
          <Link to="/admin/account" onClick={close} className="flex items-center gap-2.5 px-4 py-2 text-sm text-[#374151] hover:bg-[#F5F6F8]">
            <KeyRound className="h-4 w-4 text-[#6B7280]" /> Account & security
          </Link>
          <Link to="/admin/settings" onClick={close} className="flex items-center gap-2.5 px-4 py-2 text-sm text-[#374151] hover:bg-[#F5F6F8]">
            <Settings className="h-4 w-4 text-[#6B7280]" /> Site settings
          </Link>
          <a href="/" target="_blank" rel="noreferrer" className="flex items-center gap-2.5 px-4 py-2 text-sm text-[#374151] hover:bg-[#F5F6F8]">
            <ExternalLink className="h-4 w-4 text-[#6B7280]" /> View storefront
          </a>
          <button
            type="button"
            onClick={() => void signOut()}
            className="flex w-full items-center gap-2.5 border-t border-[#F0F0F0] px-4 py-2 text-left text-sm text-[#DC2626] hover:bg-[#FEF2F2]"
          >
            <LogOut className="h-4 w-4" /> Logout
          </button>
        </div>
      )}
    </div>
  );
}

function MobileDrawer({
  open,
  onOpenChange,
  pathname,
  email,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pathname: string;
  email: string;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="left" className="flex w-[86%] max-w-[20rem] flex-col gap-0 border-r-0 bg-white p-0 lg:hidden">
        <div className="relative overflow-hidden border-b border-[#F0F0F0] px-5 pb-5 pt-6">
          <Logo className="h-14 w-14 ring-1 ring-[#E5E5E5]" />
          <SheetTitle className="mt-3 text-lg font-bold text-navy">{SITE.name}</SheetTitle>
          <SheetDescription className="truncate text-sm text-[#6B7280]">{email || "Admin portal"}</SheetDescription>
        </div>
        <div className="flex-1 overflow-y-auto px-3 py-4">
          <NavList pathname={pathname} tone="light" onNavigate={() => onOpenChange(false)} />
        </div>
        <div className="border-t border-[#F0F0F0] p-3">
          <button
            type="button"
            onClick={() => void signOut()}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-[#DC2626] hover:bg-[#FEF2F2]"
          >
            <LogOut className="h-4 w-4" />
            Logout
          </button>
        </div>
        <div aria-hidden className="h-2 bg-[linear-gradient(90deg,var(--navy)_0%,var(--navy)_60%,var(--gold)_60%)]" />
      </SheetContent>
    </Sheet>
  );
}

function BottomTabs({ pathname, onMore }: { pathname: string; onMore: () => void }) {
  return (
    <nav
      aria-label="Quick navigation"
      className="fixed inset-x-0 bottom-0 z-30 border-t border-[#E5E5E5] bg-white pb-[env(safe-area-inset-bottom)] lg:hidden"
    >
      <ul className="grid grid-cols-4">
        {TABS.map((tab) => {
          const active = isActive(pathname, tab);
          const Icon = tab.icon;
          return (
            <li key={tab.to}>
              <Link
                to={tab.to as "/admin"}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex h-14 flex-col items-center justify-center gap-0.5 text-[0.7rem] font-semibold",
                  active ? "text-[#B86A00]" : "text-[#6B7280]",
                )}
              >
                <Icon className="h-5 w-5" />
                {tab.label}
              </Link>
            </li>
          );
        })}
        <li>
          <button
            type="button"
            onClick={onMore}
            className="flex h-14 w-full flex-col items-center justify-center gap-0.5 text-[0.7rem] font-semibold text-[#6B7280]"
          >
            <MoreHorizontal className="h-5 w-5" />
            More
          </button>
        </li>
      </ul>
    </nav>
  );
}

/**
 * Admin layout. Legacy page markup still uses the storefront `btn-*` and `field-*` utilities; the
 * descendant overrides below give them the admin look (8px radius, compact height, no gold glow).
 */
const LEGACY_OVERRIDES = cn(
  "[&_.btn-base]:min-h-10 [&_.btn-base]:rounded-lg [&_.btn-base]:px-4 [&_.btn-base]:py-2 [&_.btn-base]:text-sm [&_.btn-base]:tracking-normal",
  "[&_.btn-gold]:shadow-none [&_.btn-base:hover]:transform-none",
  "[&_.field-input]:min-h-10 [&_.field-input]:rounded-lg [&_.field-input]:border-[#E5E5E5] [&_.field-input]:px-3 [&_.field-input]:py-2 [&_.field-input]:text-sm",
  "[&_.field-label]:text-xs [&_.field-label]:text-[#374151]",
);

export function AdminShell({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const email = useAdminEmail();
  const [drawer, setDrawer] = useState(false);
  const [mobileSearch, setMobileSearch] = useState(false);

  useEffect(() => {
    setDrawer(false);
    setMobileSearch(false);
  }, [pathname]);

  return (
    <div className={cn("admin-shell min-h-dvh bg-[#F5F6F8] text-navy", LEGACY_OVERRIDES)}>
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[248px] flex-col bg-navy text-white lg:flex">
        <Link to="/admin" className="flex items-center gap-3 px-5 py-5">
          <Logo className="h-10 w-10" />
          <span className="min-w-0">
            <span className="block truncate text-base font-bold tracking-tight">{SITE.name.toUpperCase()}</span>
            <span className="block text-[0.68rem] font-medium uppercase tracking-[0.14em] text-gold">Admin portal</span>
          </span>
        </Link>
        <div className="flex-1 overflow-y-auto px-3 pb-4 [scrollbar-color:rgba(255,255,255,0.15)_transparent] [scrollbar-width:thin]">
          <NavList pathname={pathname} tone="dark" />
        </div>
        <div className="border-t border-white/10 p-3">
          <button
            type="button"
            onClick={() => void signOut()}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-white/75 transition-colors hover:bg-white/8 hover:text-white"
          >
            <LogOut className="h-4 w-4" />
            Logout
          </button>
        </div>
      </aside>

      <div className="flex min-h-dvh min-w-0 flex-col lg:pl-[248px]">
        <header className="sticky top-0 z-20 border-b border-[#E5E5E5] bg-white">
          <div className="flex h-16 items-center gap-2 px-3 md:px-6">
            <button
              type="button"
              onClick={() => setDrawer(true)}
              aria-label="Open menu"
              className="grid h-10 w-10 place-items-center rounded-lg text-navy hover:bg-[#F5F6F8] lg:hidden"
            >
              <Menu className="h-5 w-5" />
            </button>
            <Link to="/admin" className="flex min-w-0 items-center gap-2 lg:hidden">
              <Logo className="h-8 w-8 ring-1 ring-[#E5E5E5]" />
              <span className="truncate text-sm font-bold text-navy">{SITE.name.toUpperCase()}</span>
            </Link>
            <div className="hidden max-w-md flex-1 md:ml-4 md:block lg:ml-0">
              <AdminSearch />
            </div>
            <div className="ml-auto flex items-center gap-1">
              <button
                type="button"
                onClick={() => setMobileSearch((v) => !v)}
                aria-label={mobileSearch ? "Close search" : "Search"}
                className="grid h-10 w-10 place-items-center rounded-lg text-navy hover:bg-[#F5F6F8] md:hidden"
              >
                {mobileSearch ? <X className="h-5 w-5" /> : <Search className="h-5 w-5" />}
              </button>
              <NotificationBell />
              <AvatarMenu email={email} />
            </div>
          </div>
          {mobileSearch && (
            <div className="border-t border-[#F0F0F0] px-3 py-2 md:hidden">
              <AdminSearch autoFocus onDone={() => setMobileSearch(false)} />
            </div>
          )}
        </header>

        <main className="mx-auto w-full max-w-[1400px] flex-1 px-4 pb-24 pt-5 md:px-6 md:pt-6 lg:pb-10">{children}</main>
      </div>

      <BottomTabs pathname={pathname} onMore={() => setDrawer(true)} />
      <MobileDrawer open={drawer} onOpenChange={setDrawer} pathname={pathname} email={email} />
    </div>
  );
}