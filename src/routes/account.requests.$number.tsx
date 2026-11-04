import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { AccountShell } from "@/components/site/AccountShell";
import { RequestDetails } from "@/components/site/RequestDetails";
import { useAuthUser } from "@/hooks/use-auth";
import { useLang } from "@/i18n/LanguageProvider";
import { getMyRequest, respondToQuote } from "@/lib/requests.functions";

export const Route = createFileRoute("/account/requests/$number")({
  head: () => ({
    meta: [{ title: "Custom request — GK furnish" }, { name: "robots", content: "noindex" }],
  }),
  component: RequestPage,
});

function RequestPage() {
  const { number } = Route.useParams();
  const { t } = useLang();
  const { user } = useAuthUser();
  const queryClient = useQueryClient();
  const load = useServerFn(getMyRequest);
  const respond = useServerFn(respondToQuote);
  const { data, isLoading } = useQuery({
    queryKey: ["my-request", user?.id, number],
    queryFn: () => load({ data: { number } }),
    enabled: Boolean(user),
  });

  return (
    <AccountShell
      active="requests"
      title={`#${number}`}
      crumbs={[
        { label: t.account.title, href: "/account" },
        { label: t.requests.title, href: "/account/requests" },
        { label: `#${number}` },
      ]}
    >
      {isLoading || data === undefined ? (
        <p className="text-sm text-muted-foreground">{t.common.loading}</p>
      ) : data === null ? (
        <div className="panel p-5">
          <p className="text-navy">{t.requests.notFound}</p>
          <Link to="/account/requests" className="btn-base btn-gold mt-4">
            {t.requests.back}
          </Link>
        </div>
      ) : (
        <RequestDetails
          request={data}
          onRespond={async (quoteId, response, message) => {
            try {
              await respond({ data: { number, quoteId, response, message } });
              toast.success(t.requests.responded);
              await queryClient.invalidateQueries({ queryKey: ["my-request"] });
              await queryClient.invalidateQueries({ queryKey: ["my-requests"] });
            } catch (err) {
              toast.error(err instanceof Error ? err.message : t.validation.failed);
            }
          }}
        />
      )}
    </AccountShell>
  );
}
