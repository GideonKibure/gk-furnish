import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import {
  AlertTriangle,
  ArrowUpRight,
  CheckCircle2,
  Clock3,
  FileText,
  Megaphone,
  Package,
  Settings,
  ShoppingBag,
  Sparkles,
  Wallet,
} from "lucide-react";
import { useEffect, useState } from "react";
import { AdminBadge, AdminCard, AdminEmpty, AdminPageHeader, AdminStatCard } from "@/components/admin/admin-ui";
import { formatPrice, SITE } from "@/config/site";
import { getAdminDashboard } from "@/lib/admin.functions";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/admin/")({
  head: () => ({
    meta: [{ title: "Admin dashboard — GK furnish" }, { name: "robots", content: "noindex" }],
  }),
  component: AdminDashboard,
});

function statusTone(status: string): "neutral" | "gold" | "success" | "danger" {
  if (status === "completed") return "success";
  if (status === "cancelled" || status === "failed") return "danger";
  if (["in_production", "ready", "out_for_delivery", "quoted", "in_progress"].includes(status)) return "gold";
  return "neutral";
}

function AdminDashboard() {
  const load = useServerFn(getAdminDashboard);
  const [data, setData] = useState<Awaited<ReturnType<typeof load>> | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    load()
      .then(setData)
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load"));
  }, [load]);

  if (error) {
    return (
      <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-6 md:p-8">
        <p className="font-display text-xl text-destructive">Access error</p>
        <p className="mt-2 text-sm text-muted-foreground">{error}</p>
        <p className="mt-3 text-sm">
          Ensure your Auth user is listed in <code className="rounded bg-muted px-1.5 py-0.5">admin_users</code>.
        </p>
        <Link to="/admin/login" className="btn-base btn-outline-navy mt-5 inline-flex">
          Back to login
        </Link>
      </div>
    );
  }

  if (!data) {
    return (
      <AdminEmpty>
        <span className="inline-flex items-center gap-2">
          <span className="h-2 w-2 animate-pulse rounded-full bg-gold" />
          Loading dashboard…
        </span>
      </AdminEmpty>
    );
  }

  const attention = data.ordersNotDone + data.lowStock + data.customOpen + data.outOfStock;
  const shortcuts = [
    { to: "/admin/orders" as const, label: "Manage orders", desc: "Walk-in and online", Icon: ShoppingBag },
    { to: "/admin/products" as const, label: "Edit products", desc: "Stock, photos, features", Icon: Package },
    { to: "/admin/custom-orders" as const, label: "Custom requests", desc: "Quotes and builds", Icon: Sparkles },
    { to: "/admin/popups" as const, label: "Offer popup", desc: "Homepage banner", Icon: Megaphone },
    { to: "/admin/content" as const, label: "Page content", desc: "EN / SW copy", Icon: FileText },
    { to: "/admin/settings" as const, label: "Site settings", desc: "Contact & socials", Icon: Settings },
  ];

  return (
    <div className="space-y-8">
      <AdminPageHeader
        title="Dashboard"
        description="Live snapshot of orders, payments, stock and custom requests."
      />

      {/* Hero overview */}
      <section className="relative overflow-hidden rounded-[1.75rem] bg-navy px-6 py-7 text-primary-foreground shadow-[var(--shadow-lift)] md:px-8 md:py-8">
        <div
          aria-hidden
          className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full bg-gold/25 blur-3xl"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -bottom-24 left-10 h-48 w-48 rounded-full bg-gold/10 blur-3xl"
        />
        <div className="relative flex flex-wrap items-end justify-between gap-6">
          <div className="min-w-0">
            <p className="text-[0.7rem] font-bold uppercase tracking-[0.16em] text-gold/90">Workshop overview</p>
            <h2 className="mt-2 font-display text-3xl tracking-tight md:text-4xl">
              Welcome back to {SITE.name}
            </h2>
            <p className="mt-2 max-w-xl text-sm text-white/65 md:text-base">
              {attention > 0
                ? `${attention} item${attention === 1 ? "" : "s"} need attention across orders, stock and custom work.`
                : "Everything looks clear — no urgent stock or order alerts."}
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 backdrop-blur">
              <p className="text-[0.65rem] font-bold uppercase tracking-[0.14em] text-white/50">Orders</p>
              <p className="mt-1 font-display text-2xl text-white">{data.ordersTotal}</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 backdrop-blur">
              <p className="text-[0.65rem] font-bold uppercase tracking-[0.14em] text-white/50">Revenue</p>
              <p className="mt-1 font-display text-xl text-gold sm:text-2xl">
                {formatPrice(data.revenueTotal) ?? "—"}
              </p>
            </div>
            <div className="col-span-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 backdrop-blur sm:col-span-1">
              <p className="text-[0.65rem] font-bold uppercase tracking-[0.14em] text-white/50">Open custom</p>
              <p className="mt-1 font-display text-2xl text-white">{data.customOpen}</p>
            </div>
          </div>
        </div>
      </section>

      {/* Orders */}
      <section>
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="font-display text-xl text-navy">Orders pipeline</h2>
          <Link to="/admin/orders" className="text-sm font-semibold text-gold hover:underline">
            View all
          </Link>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Link to="/admin/orders" className="block focus-visible:outline-none">
            <AdminStatCard
              label="Not done"
              value={data.ordersNotDone}
              hint="Pending / confirmed"
              icon={<Clock3 className="h-4 w-4" />}
              tone={data.ordersNotDone > 0 ? "warn" : "default"}
            />
          </Link>
          <Link to="/admin/orders" className="block focus-visible:outline-none">
            <AdminStatCard
              label="In progress"
              value={data.ordersInProgress}
              hint="Production to delivery"
              icon={<Package className="h-4 w-4" />}
              tone="gold"
            />
          </Link>
          <Link to="/admin/orders" className="block focus-visible:outline-none">
            <AdminStatCard
              label="Completed"
              value={data.ordersDone}
              hint="Fulfilled"
              icon={<CheckCircle2 className="h-4 w-4" />}
              tone="success"
            />
          </Link>
          <Link to="/admin/orders" className="block focus-visible:outline-none">
            <AdminStatCard
              label="All orders"
              value={data.ordersTotal}
              hint="All time"
              icon={<ShoppingBag className="h-4 w-4" />}
            />
          </Link>
        </div>
      </section>

      {/* Payments + catalogue */}
      <section className="grid gap-6 lg:grid-cols-2">
        <div>
          <h2 className="mb-3 font-display text-xl text-navy">Payments</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <Link to="/admin/orders" className="block focus-visible:outline-none">
              <AdminStatCard
                label="Paid advance"
                value={data.paidAdvance}
                hint={formatPrice(data.paidAdvanceSum) ?? "—"}
                icon={<Wallet className="h-4 w-4" />}
                tone="gold"
              />
            </Link>
            <Link to="/admin/orders" className="block focus-visible:outline-none">
              <AdminStatCard
                label="Paid full"
                value={data.paidFull}
                hint={formatPrice(data.paidFullSum) ?? "—"}
                icon={<Wallet className="h-4 w-4" />}
                tone="success"
              />
            </Link>
          </div>
        </div>
        <div>
          <h2 className="mb-3 font-display text-xl text-navy">Catalogue</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <Link to="/admin/products" className="block focus-visible:outline-none">
              <AdminStatCard
                label="Products"
                value={data.productsTotal}
                hint="Catalogue items"
                icon={<Package className="h-4 w-4" />}
              />
            </Link>
            <Link to="/admin/products" className="block focus-visible:outline-none">
              <AdminStatCard
                label="Low stock"
                value={data.lowStock}
                hint={data.outOfStock > 0 ? `${data.outOfStock} out of stock` : "≤ 3 units"}
                icon={<AlertTriangle className="h-4 w-4" />}
                tone={data.lowStock > 0 || data.outOfStock > 0 ? "danger" : "default"}
              />
            </Link>
          </div>
        </div>
      </section>

      {/* Activity + alerts */}
      <section className="grid gap-5 xl:grid-cols-[1.2fr_0.8fr]">
        <AdminCard hover={false} className="!p-0 overflow-hidden">
          <div className="flex items-center justify-between gap-3 border-b border-border/70 px-5 py-4 md:px-6">
            <h2 className="font-display text-xl text-navy">Recent orders</h2>
            <Link to="/admin/orders" className="text-sm font-semibold text-gold hover:underline">
              Open orders
            </Link>
          </div>
          {data.recentOrders.length ? (
            <ul className="divide-y divide-border/60">
              {data.recentOrders.map((o) => (
                <li key={o.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5 transition-colors hover:bg-secondary/35 md:px-6">
                  <div className="min-w-0">
                    <p className="font-semibold text-navy">{o.order_number}</p>
                    <p className="truncate text-sm text-muted-foreground">
                      {o.customer_name} · {new Date(o.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    <AdminBadge tone={statusTone(o.status)}>{o.status.replace(/_/g, " ")}</AdminBadge>
                    <AdminBadge tone={o.payment_status === "paid" ? "success" : "neutral"}>
                      {o.payment_status}
                    </AdminBadge>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="px-5 py-10 text-center text-sm text-muted-foreground md:px-6">No orders yet.</p>
          )}
        </AdminCard>

        <div className="space-y-5">
          <AdminCard hover={false} className="!p-0 overflow-hidden">
            <div className="flex items-center justify-between gap-3 border-b border-border/70 px-5 py-4">
              <h2 className="font-display text-lg text-navy">Stock alerts</h2>
              <Link to="/admin/products" className="text-sm font-semibold text-gold hover:underline">
                Products
              </Link>
            </div>
            {data.lowStockItems.length ? (
              <ul className="divide-y divide-border/60">
                {data.lowStockItems.map((p) => (
                  <li key={p.id} className="flex items-center justify-between gap-3 px-5 py-3 text-sm">
                    <span className="truncate font-medium text-navy">{p.name}</span>
                    <AdminBadge tone={p.stock_quantity <= 0 ? "danger" : "warn"}>
                      {p.stock_quantity <= 0 ? "Out" : `${p.stock_quantity} left`}
                    </AdminBadge>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="px-5 py-8 text-center text-sm text-muted-foreground">Stock levels look healthy.</p>
            )}
          </AdminCard>

          <AdminCard hover={false} className="!p-0 overflow-hidden">
            <div className="flex items-center justify-between gap-3 border-b border-border/70 px-5 py-4">
              <h2 className="font-display text-lg text-navy">Open custom</h2>
              <Link to="/admin/custom-orders" className="text-sm font-semibold text-gold hover:underline">
                View
              </Link>
            </div>
            {data.recentCustom.length ? (
              <ul className="divide-y divide-border/60">
                {data.recentCustom.map((c) => (
                  <li key={c.id} className="px-5 py-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-navy">{c.request_number}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          {c.full_name} · {c.furniture_type}
                        </p>
                      </div>
                      <AdminBadge tone={statusTone(c.status)}>{c.status.replace(/_/g, " ")}</AdminBadge>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="px-5 py-8 text-center text-sm text-muted-foreground">No open custom requests.</p>
            )}
          </AdminCard>
        </div>
      </section>

      {/* Quick actions */}
      <section>
        <h2 className="mb-3 font-display text-xl text-navy">Quick actions</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {shortcuts.map((s) => (
            <Link
              key={s.to}
              to={s.to}
              className={cn(
                "group flex items-center gap-3 rounded-2xl border border-border/80 bg-background p-4 shadow-[var(--shadow-card)]",
                "transition-all duration-300 hover:-translate-y-0.5 hover:border-gold/35 hover:shadow-[var(--shadow-lift)]",
              )}
            >
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-gold-soft text-navy transition-transform duration-300 group-hover:scale-110">
                <s.Icon className="h-5 w-5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold text-navy">{s.label}</span>
                <span className="mt-0.5 block text-xs text-muted-foreground">{s.desc}</span>
              </span>
              <ArrowUpRight className="h-4 w-4 shrink-0 text-gold transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
