import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { ArrowRight, Plus, Sparkles } from "lucide-react";
import { EmptyState } from "@/components/brand/EmptyState";
import { StatusPill } from "@/components/brand/StatusPill";
import { AccountShell } from "@/components/site/AccountShell";
import { useAuthUser } from "@/hooks/use-auth";
import { useLang } from "@/i18n/LanguageProvider";
import { statusLabel } from "@/i18n/status";
import { listMyRequests } from "@/lib/requests.functions";

export const Route = createFileRoute("/account/requests/")({
  head: () => ({
    meta: [{ title: "My custom requests — GK furnish" }, { name: "robots", content: "noindex" }],
  }),
  component: RequestsPage,
});

function RequestsPage() {
  const { t } = useLang();
  const { user } = useAuthUser();
  const load = useServerFn(listMyRequests);
  const { data, isLoading } = useQuery({
    queryKey: ["my-requests", user?.id],
    queryFn: () => load(),
    enabled: Boolean(user),
  });

  return (
    <AccountShell active="requests" title={t.requests.title}>
      <div className="mb-4">
        <Link to="/custom-order" className="btn-base btn-gold btn-sm">
          <Plus className="h-4 w-4" />
          {t.requests.newRequest}
        </Link>
      </div>
      {isLoading || !data ? (
        <p className="text-sm text-muted-foreground">{t.common.loading}</p>
      ) : data.length === 0 ? (
        <EmptyState icon={<Sparkles className="h-6 w-6" />} title={t.requests.empty} />
      ) : (
        <ul className="space-y-2.5">
          {data.map((r) => {
            const openQuote = r.quotes.some((q) => q.status === "sent");
            return (
              <li key={r.id}>
                <Link
                  to="/account/requests/$number"
                  params={{ number: r.number }}
                  className="panel group flex flex-wrap items-center justify-between gap-3 p-4 transition-shadow hover:shadow-[var(--shadow-lift)]"
                >
                  <div className="min-w-0">
                    <p className="font-semibold text-navy">
                      {r.furnitureType} × {r.quantity}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      #{r.number} · {t.requests.submitted}{" "}
                      {new Date(r.createdAt).toLocaleDateString("en-GB", {
                        timeZone: "Africa/Dar_es_Salaam",
                      })}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {openQuote && (
                      <StatusPill tone="info">{t.requests.quoteStatus.sent}</StatusPill>
                    )}
                    <StatusPill status={r.status}>{statusLabel(t, r.status)}</StatusPill>
                    <ArrowRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </AccountShell>
  );
}
