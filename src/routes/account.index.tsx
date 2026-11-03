import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { ArrowRight, Loader2, LogOut, Package } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/site/PageHeader";
import { formatPrice } from "@/config/site";
import { useRequireCustomer } from "@/hooks/use-require-customer";
import { supabase } from "@/integrations/supabase/client";
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
  const nav = useNavigate();
  const { user } = useRequireCustomer();
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

  async function signOut() {
    await supabase.auth.signOut();
    void nav({ to: "/" });
  }

  if (!user || !profile) {
    return (
      <>
        <PageHeader title={t.account.title} />
        <div className="container-page section-y flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          {t.common.loading}
        </div>
      </>
    );
  }

  return (
    <>
      <PageHeader title={t.account.title} subtitle={profile.email}>
        <button type="button" onClick={() => void signOut()} className="btn-base btn-outline-navy mt-6">
          <LogOut className="h-4 w-4" />
          {t.account.signOut}
        </button>
      </PageHeader>
      <div className="container-page section-y grid gap-8 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <section>
          <h2 className="font-display text-2xl text-navy">{t.account.orders}</h2>
          {!orders ? (
            <p className="mt-4 text-sm text-muted-foreground">{t.common.loading}</p>
          ) : orders.length === 0 ? (
            <div className="mt-4 rounded-2xl border border-dashed border-border px-6 py-10 text-center">
              <Package className="mx-auto h-8 w-8 text-gold" />
              <p className="mt-3 text-sm text-muted-foreground">{t.account.noOrders}</p>
              <Link to="/products" className="btn-base btn-gold mt-5">
                {t.cart.emptyCta}
              </Link>
            </div>
          ) : (
            <ul className="mt-4 space-y-3">
              {orders.map((o) => (
                <li key={o.id}>
                  <Link
                    to="/account/orders/$number"
                    params={{ number: o.order_number }}
                    className="group flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border/80 bg-background p-4 shadow-[var(--shadow-card)] transition-all hover:-translate-y-0.5 hover:border-gold/40"
                  >
                    <div className="min-w-0">
                      <p className="font-semibold text-navy">{o.order_number}</p>
                      <p className="text-xs text-muted-foreground">
                        {t.account.placed} {new Date(o.created_at).toLocaleDateString()} ·{" "}
                        {o.order_items.map((i) => `${i.quantity}× ${i.product_name}`).join(", ")}
                      </p>
                    </div>
                    <div className="flex items-center gap-4 text-sm">
                      <span className="rounded-full bg-secondary px-2.5 py-1 text-xs font-semibold text-navy">
                        {statusLabel(t, o.status)}
                      </span>
                      <span className="text-right">
                        <span className="block font-semibold tabular-nums text-navy">{formatPrice(o.total_amount) ?? "—"}</span>
                        {o.balance > 0 && (
                          <span className="block text-xs text-muted-foreground">
                            {t.account.balance} {formatPrice(o.balance)}
                          </span>
                        )}
                      </span>
                      <ArrowRight className="h-4 w-4 text-gold transition-transform group-hover:translate-x-1" />
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="h-fit rounded-2xl border border-border/80 bg-background p-5 shadow-[var(--shadow-card)]">
          <h2 className="font-display text-xl text-navy">{t.account.profile}</h2>
          <form onSubmit={onSave} className="mt-4 space-y-4">
            <div>
              <label className="field-label" htmlFor="p-name">{t.account.fullName}</label>
              <input id="p-name" name="full_name" className="field-input" defaultValue={profile.full_name} />
            </div>
            <div>
              <label className="field-label" htmlFor="p-phone">{t.account.phone}</label>
              <input id="p-phone" name="phone" type="tel" className="field-input" defaultValue={profile.phone} />
            </div>
            <div>
              <label className="field-label" htmlFor="p-loc">{t.account.location}</label>
              <input id="p-loc" name="default_location" className="field-input" defaultValue={profile.default_location} />
            </div>
            <button type="submit" className="btn-base btn-gold w-full" disabled={busy}>
              {t.account.save}
            </button>
          </form>
        </section>
      </div>
    </>
  );
}
