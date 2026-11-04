import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Bell, CheckCheck } from "lucide-react";
import { EmptyState } from "@/components/brand/EmptyState";
import { AccountShell } from "@/components/site/AccountShell";
import { useAuthUser } from "@/hooks/use-auth";
import { useLang } from "@/i18n/LanguageProvider";
import { listMyNotifications, markMyNotificationsRead } from "@/lib/account.functions";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/account/notifications")({
  head: () => ({
    meta: [{ title: "Notifications — GK furnish" }, { name: "robots", content: "noindex" }],
  }),
  component: NotificationsPage,
});

function NotificationsPage() {
  const { t } = useLang();
  const { user } = useAuthUser();
  const queryClient = useQueryClient();
  const load = useServerFn(listMyNotifications);
  const markRead = useServerFn(markMyNotificationsRead);
  const { data, isLoading } = useQuery({
    queryKey: ["my-notifications", user?.id],
    queryFn: () => load(),
    enabled: Boolean(user),
    retry: false,
  });

  async function markAll() {
    await markRead({ data: {} });
    await queryClient.invalidateQueries({ queryKey: ["my-notifications"] });
  }

  return (
    <AccountShell active="notifications" title={t.notifications.title}>
      {isLoading || !data ? (
        <p className="text-sm text-muted-foreground">{t.common.loading}</p>
      ) : !data.available ? (
        <EmptyState icon={<Bell className="h-6 w-6" />} title={t.notifications.unavailable} />
      ) : data.items.length === 0 ? (
        <EmptyState icon={<Bell className="h-6 w-6" />} title={t.notifications.empty} />
      ) : (
        <div className="space-y-3">
          {data.unread > 0 && (
            <button
              type="button"
              className="btn-base btn-outline-navy btn-sm"
              onClick={() => void markAll()}
            >
              <CheckCheck className="h-4 w-4" />
              {t.notifications.markAll}
            </button>
          )}
          <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-white">
            {data.items.map((n) => {
              const content = (
                <>
                  <span
                    className={cn(
                      "mt-1.5 h-2 w-2 shrink-0 rounded-full",
                      n.read_at ? "bg-transparent" : "bg-gold",
                    )}
                    aria-hidden
                  />
                  <span className="min-w-0">
                    <span className={cn("block text-sm text-navy", !n.read_at && "font-semibold")}>
                      {n.title}
                    </span>
                    {n.body && (
                      <span className="mt-0.5 block text-sm text-muted-foreground">{n.body}</span>
                    )}
                    <time
                      className="mt-1 block text-xs text-muted-foreground"
                      dateTime={n.created_at}
                    >
                      {new Date(n.created_at).toLocaleString("en-GB", {
                        timeZone: "Africa/Dar_es_Salaam",
                      })}
                    </time>
                  </span>
                </>
              );
              return (
                <li key={n.id}>
                  {n.link?.startsWith("/") ? (
                    <Link
                      to={n.link as "/"}
                      onClick={() => void markRead({ data: { ids: [n.id] } })}
                      className="flex gap-3 p-4 transition-colors hover:bg-sand"
                    >
                      {content}
                    </Link>
                  ) : (
                    <div className="flex gap-3 p-4">{content}</div>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </AccountShell>
  );
}
