import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { ArrowRight, Package } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { EmptyState } from "@/components/brand/EmptyState";
import { StatusPill } from "@/components/brand/StatusPill";
import { AccountShell } from "@/components/site/AccountShell";
import { formatAmount } from "@/config/site";
import { useAuthUser } from "@/hooks/use-auth";
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
  const loadProfile = useServerFn(getMyProfile);
  const loadOrders = useServerFn(listMyOrders);
  const saveProfile = useServerFn(updateMyProfile);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [orders, setOrders] = useState<Order[] | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!user) return;
    loadProfile().then(setProfile).catch(() => setProfile({ email: user.email ?? "", full_name: "", phone: "", default_location: "" }));
    loadOrders().then(setOrders).catch(() => setOrders([]));
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
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t.validation.failed);
    } finally {
      setBusy(false);
    }
  }

  const title = profile?.full_name ? fill(t.accountNav.hello, { name: profile.full_name.split(/\s+/)[0] ?? "" }) : t.account.title;

  return (
    <AccountShell active="overview" title={title} crumbs={[{ label: t.nav.home, href: "/" }, { label: t.account.title }]}>
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <section className="min-w-0">
          <h2 className="section-title mb-3">{t.account.orders}</h2>
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

        <section className="panel h-fit p-4 md:p-5">
          <h2 className="text-base font-bold">{t.account.profile}</h2>
          {!profile ? (
            <p className="mt-3 text-sm text-muted-foreground">{t.common.loading}</p>
          ) : (
            <form onSubmit={onSave} className="mt-3 space-y-4">
              <div>
                <label className="field-label" htmlFor="p-name">{t.account.fullName}</label>
                <input id="p-name" name="full_name" className="field-input" autoComplete="name" defaultValue={profile.full_name} />
              </div>
              <div>
                <label className="field-label" htmlFor="p-phone">{t.account.phone}</label>
                <input id="p-phone" name="phone" type="tel" className="field-input" autoComplete="tel" defaultValue={profile.phone} />
              </div>
              <div>
                <label className="field-label" htmlFor="p-loc">{t.account.location}</label>
                <input id="p-loc" name="default_location" className="field-input" defaultValue={profile.default_location} />
              </div>
              <button type="submit" className="btn-base btn-gold w-full" disabled={busy}>
                {t.account.save}
              </button>
            </form>
          )}
        </section>
      </div>
    </AccountShell>
  );
}
