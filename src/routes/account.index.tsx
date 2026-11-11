import { useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { ArrowRight, Package, Pencil, ShoppingBag } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { EmptyState } from "@/components/brand/EmptyState";
import { StatusPill } from "@/components/brand/StatusPill";
import { AccountShell } from "@/components/site/AccountShell";
import { formatAmount } from "@/config/site";
import { useAuthUser } from "@/hooks/use-auth";
import { nameLetter } from "@/hooks/use-customer-name";
import { fill } from "@/i18n/fill";
import { useLang } from "@/i18n/LanguageProvider";
import { statusLabel } from "@/i18n/status";
import { getMyProfile, listMyOrders, updateMyProfile } from "@/lib/account.functions";

export const Route = createFileRoute("/account/")({
  head: () => ({ meta: [{ title: "My account — GK furnish" }, { name: "robots", content: "noindex" }] }),
  component: AccountPage,
});

type Profile = Awaited<ReturnType<typeof getMyProfile>>;
type Order = Awaited<ReturnType<typeof listMyOrders>>[number];

function AccountPage() {
  const { t } = useLang();
  const { user } = useAuthUser();
  const queryClient = useQueryClient();
  const loadProfile = useServerFn(getMyProfile);
  const loadOrders = useServerFn(listMyOrders);
  const saveProfile = useServerFn(updateMyProfile);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [orders, setOrders] = useState<Order[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    if (!user) return;
    void Promise.all([
      loadProfile().catch(() => ({ email: user.email ?? "", full_name: "", phone: "", default_location: "" })),
      loadOrders().catch(() => [] as Order[]),
    ]).then(([nextProfile, nextOrders]) => {
      setProfile(nextProfile);
      setOrders(nextOrders);
    });
  }, [user?.id]);

  async function onSave(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setBusy(true);
    try {
      await saveProfile({
        data: {
          full_name: String(fd.get("full_name") ?? ""),
          phone: String(fd.get("phone") ?? ""),
          default_location: String(fd.get("default_location") ?? ""),
        },
      });
      toast.success(t.account.saved);
      const next = {
        full_name: String(fd.get("full_name") ?? ""),
        phone: String(fd.get("phone") ?? ""),
        default_location: String(fd.get("default_location") ?? ""),
      };
      setProfile((current) => (current ? { ...current, ...next } : current));
      queryClient.setQueryData(["my-profile", user?.id], (current: Profile | undefined) =>
        current ? { ...current, ...next } : { email: user?.email ?? "", ...next },
      );
      setEditing(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t.validation.failed);
    } finally {
      setBusy(false);
    }
  }

  const title = profile?.full_name ? fill(t.accountNav.hello, { name: profile.full_name.split(/\s+/)[0] ?? "" }) : t.account.title;
  const due = (orders ?? []).reduce((sum, order) => sum + order.balance, 0);
  const initials = nameLetter(profile?.full_name || profile?.email || "");

  return (
    <AccountShell active="overview" title={title} crumbs={[{ label: t.shell.shop, href: "/products" }, { label: t.account.title }]}>
      <div className="space-y-4">
        <section className="panel overflow-hidden">
          <div className="flex flex-wrap items-center gap-4 bg-navy px-4 py-5 text-white md:px-6">
            <span className="grid h-14 w-14 shrink-0 place-items-center rounded-full bg-gold text-lg font-bold text-navy" aria-hidden>
              {initials}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-lg font-bold">{profile?.full_name || t.account.profile}</p>
              <p className="truncate text-sm text-white/75">{profile?.email || user?.email}</p>
              {profile?.phone ? <p className="truncate text-sm text-white/75">{profile.phone}</p> : null}
            </div>
            <button type="button" className="btn-base bg-white text-navy hover:bg-sand" onClick={() => setEditing((open) => !open)}>
              <Pencil className="h-4 w-4" />
              {editing ? t.addresses.cancel : t.account.editProfile}
            </button>
          </div>
          {editing && profile && (
            <form onSubmit={onSave} className="grid gap-4 p-4 md:grid-cols-2 md:p-5">
              <div>
                <label className="field-label" htmlFor="p-name">{t.account.fullName}</label>
                <input id="p-name" name="full_name" className="field-input" autoComplete="name" defaultValue={profile.full_name} />
              </div>
              <div>
                <label className="field-label" htmlFor="p-phone">{t.account.phone}</label>
                <input id="p-phone" name="phone" type="tel" className="field-input" autoComplete="tel" defaultValue={profile.phone} />
              </div>
              <div className="md:col-span-2">
                <label className="field-label" htmlFor="p-loc">{t.account.location}</label>
                <input id="p-loc" name="default_location" className="field-input" defaultValue={profile.default_location} />
              </div>
              <div>
                <button type="submit" className="btn-base btn-gold" disabled={busy}>
                  {t.account.save}
                </button>
              </div>
            </form>
          )}
        </section>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <div className="panel p-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t.account.orders}</p>
            <p className="mt-1 text-2xl font-bold tabular-nums text-navy">{orders ? orders.length : "—"}</p>
          </div>
          <div className="panel p-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t.account.dueNow}</p>
            <p className="mt-1 text-2xl font-bold tabular-nums text-navy">{orders ? formatAmount(due) : "—"}</p>
          </div>
          <Link to="/products" className="panel flex items-center justify-between gap-3 p-4 sm:col-span-1 col-span-2">
            <span>
              <span className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t.shell.shop}</span>
              <span className="mt-1 block font-semibold text-navy">{t.cart.emptyCta}</span>
            </span>
            <ShoppingBag className="h-5 w-5 text-gold-ink" />
          </Link>
        </div>

        <section className="min-w-0">
          <h2 className="mb-3 text-base font-bold text-navy">{t.account.orders}</h2>
          {!orders ? (
            <p className="text-sm text-muted-foreground">{t.common.loading}</p>
          ) : orders.length === 0 ? (
            <EmptyState
              icon={<Package className="h-6 w-6" />}
              title={t.account.noOrders}
              action={
                <Link to="/products" className="btn-base btn-gold">
                  {t.cart.emptyCta}
                </Link>
              }
            />
          ) : (
            <ul className="space-y-2.5">
              {orders.map((o) => (
                <li key={o.id}>
                  <Link
                    to="/account/orders/$number"
                    params={{ number: o.order_number }}
                    className="panel group flex flex-wrap items-center justify-between gap-3 p-4 transition-shadow hover:shadow-[var(--shadow-lift)]"
                  >
                    <div className="min-w-0">
                      <p className="font-semibold text-navy">#{o.order_number}</p>
                      <p className="line-clamp-1 text-xs text-muted-foreground">
                        {new Date(o.created_at).toLocaleDateString("en-GB", { timeZone: "Africa/Dar_es_Salaam" })} ·{" "}
                        {o.order_items.map((i) => `${i.quantity}× ${i.product_name}`).join(", ")}
                      </p>
                    </div>
                    <div className="flex items-center gap-3 text-sm">
                      <StatusPill status={o.status}>{statusLabel(t, o.status)}</StatusPill>
                      <span className="text-right">
                        <span className="block font-semibold tabular-nums text-navy">{formatAmount(o.total_amount)}</span>
                        {o.balance > 0 && (
                          <span className="block text-xs text-muted-foreground">
                            {t.account.balance} {formatAmount(o.balance)}
                          </span>
                        )}
                      </span>
                      <ArrowRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </AccountShell>
  );
}
