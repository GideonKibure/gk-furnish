import { StatusPill } from "@/components/brand/StatusPill";
import { useLang } from "@/i18n/LanguageProvider";
import { statusLabel } from "@/i18n/status";
import type { QuoteResponse } from "@/lib/custom-quotes";
import type { CustomRequestView } from "@/lib/requests.server";
import { QuoteCard } from "./QuoteCard";

/** Custom request summary plus its quote versions (newest first). */
export function RequestDetails({
  request,
  onRespond,
}: {
  request: CustomRequestView;
  onRespond?: (quoteId: string, response: QuoteResponse, message: string) => Promise<void>;
}) {
  const { t } = useLang();
  const rows: [string, string][] = [
    [t.custom.type, `${request.furnitureType} × ${request.quantity}`],
    [t.custom.dimensions, request.dimensions],
    [t.custom.material, request.material],
    [t.custom.color, request.color],
    [t.customExtra.finish, request.finish],
    [t.custom.budget, request.budget],
    [t.customExtra.neededBy, request.neededBy ?? ""],
    [t.custom.location, request.location],
  ];
  const quotes = [...request.quotes].reverse();

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
      <section className="panel h-fit p-4 md:p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-base font-bold">{t.requests.details}</h2>
          <StatusPill status={request.status}>{statusLabel(t, request.status)}</StatusPill>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          #{request.number} · {t.requests.submitted}{" "}
          {new Date(request.createdAt).toLocaleDateString("en-GB", {
            timeZone: "Africa/Dar_es_Salaam",
          })}
        </p>
        <p className="mt-3 whitespace-pre-line text-sm text-navy/85">{request.description}</p>
        <dl className="mt-3 divide-y divide-border text-sm">
          {rows
            .filter(([, v]) => v)
            .map(([label, value]) => (
              <div key={label} className="flex justify-between gap-4 py-2">
                <dt className="text-muted-foreground">{label}</dt>
                <dd className="text-right text-navy">{value}</dd>
              </div>
            ))}
        </dl>
      </section>
      <section className="space-y-3">
        <h2 className="section-title">{t.requests.quotes}</h2>
        {quotes.length === 0 ? (
          <p className="panel p-4 text-sm text-muted-foreground">{t.requests.noQuotes}</p>
        ) : (
          quotes.map((quote) => (
            <QuoteCard
              key={quote.id}
              quote={quote}
              {...(onRespond
                ? {
                    onRespond: (response: QuoteResponse, message: string) =>
                      onRespond(quote.id, response, message),
                  }
                : {})}
            />
          ))
        )}
      </section>
    </div>
  );
}
