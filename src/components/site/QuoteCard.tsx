import { Check, Download, MessageSquareText, X } from "lucide-react";
import { useState } from "react";
import { StatusPill } from "@/components/brand/StatusPill";
import { formatAmount } from "@/config/site";
import { fill } from "@/i18n/fill";
import { useLang } from "@/i18n/LanguageProvider";
import { quoteIsOpen, type QuoteResponse, type SavedQuote } from "@/lib/custom-quotes";
import { downloadQuote } from "@/lib/invoice";

const TONE: Record<string, "success" | "danger" | "pending" | "info" | "neutral"> = {
  sent: "info",
  accepted: "success",
  rejected: "danger",
  changes_requested: "pending",
  expired: "neutral",
  superseded: "neutral",
  draft: "neutral",
};

/** One quote version with download and (when still open) accept / decline / request changes. */
export function QuoteCard({
  quote,
  onRespond,
}: {
  quote: SavedQuote;
  onRespond?: (response: QuoteResponse, message: string) => Promise<void>;
}) {
  const { t } = useLang();
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState<QuoteResponse | null>(null);
  const status = quote.status ?? "sent";
  const open = quoteIsOpen(quote) && Boolean(onRespond);
  const advance = Math.ceil((quote.total * (quote.advancePercent || 50)) / 100);

  async function respond(response: QuoteResponse) {
    if (!onRespond) return;
    setBusy(response);
    try {
      await onRespond(response, message.trim());
    } finally {
      setBusy(null);
    }
  }

  return (
    <article className="panel p-4 md:p-5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="font-semibold text-navy">
            {fill(t.requests.quoteVersion, { version: quote.version ?? 1 })} ·{" "}
            <span className="font-normal text-muted-foreground">{quote.number}</span>
          </p>
          <p className="text-xs text-muted-foreground">
            {new Date(quote.createdAt).toLocaleDateString("en-GB", {
              timeZone: "Africa/Dar_es_Salaam",
            })}
            {quote.validUntil ? ` · ${t.requests.validUntil} ${quote.validUntil}` : ""}
          </p>
        </div>
        <StatusPill tone={TONE[status] ?? "neutral"}>{t.requests.quoteStatus[status]}</StatusPill>
      </div>

      <ul className="mt-3 divide-y divide-border text-sm">
        {quote.lines.map((line, i) => (
          <li key={i} className="flex justify-between gap-3 py-2">
            <span className="text-navy">
              {line.quantity}× {line.description}
            </span>
            <span className="shrink-0 tabular-nums">
              {formatAmount(line.quantity * line.unitPrice)}
            </span>
          </li>
        ))}
      </ul>
      <dl className="mt-2 space-y-1 border-t border-border pt-2 text-sm">
        <div className="flex justify-between font-bold text-navy">
          <dt>{t.requests.total}</dt>
          <dd className="tabular-nums">{formatAmount(quote.total)}</dd>
        </div>
        <div className="flex justify-between text-muted-foreground">
          <dt>
            {t.requests.advance} ({quote.advancePercent || 50}%)
          </dt>
          <dd className="tabular-nums">{formatAmount(advance)}</dd>
        </div>
        {quote.estimatedCompletion && (
          <div className="flex justify-between text-muted-foreground">
            <dt>{t.requests.estimatedCompletion}</dt>
            <dd>{quote.estimatedCompletion}</dd>
          </div>
        )}
      </dl>
      {(quote.inclusions || quote.exclusions) && (
        <div className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
          {quote.inclusions && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {t.requests.inclusions}
              </p>
              <p className="mt-0.5 whitespace-pre-line text-navy">{quote.inclusions}</p>
            </div>
          )}
          {quote.exclusions && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {t.requests.exclusions}
              </p>
              <p className="mt-0.5 whitespace-pre-line text-navy">{quote.exclusions}</p>
            </div>
          )}
        </div>
      )}
      {quote.notes && (
        <p className="mt-3 whitespace-pre-line rounded-lg bg-sand p-3 text-xs text-navy/80">
          {quote.notes}
        </p>
      )}
      {quote.customerResponse && (
        <p className="mt-3 flex items-start gap-2 text-sm text-navy">
          <MessageSquareText className="mt-0.5 h-4 w-4 shrink-0" />
          {quote.customerResponse}
        </p>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          className="btn-base btn-outline-navy btn-sm"
          onClick={() => downloadQuote(quote)}
        >
          <Download className="h-4 w-4" />
          {t.requests.download}
        </button>
      </div>

      {open && (
        <div className="mt-4 space-y-3 border-t border-border pt-4">
          <textarea
            rows={2}
            className="field-input text-sm"
            placeholder={t.requests.messagePlaceholder}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            maxLength={1000}
          />
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="btn-base btn-gold btn-sm"
              disabled={Boolean(busy)}
              onClick={() => void respond("accepted")}
            >
              <Check className="h-4 w-4" />
              {t.requests.accept}
            </button>
            <button
              type="button"
              className="btn-base btn-outline-navy btn-sm"
              disabled={Boolean(busy)}
              onClick={() => void respond("changes_requested")}
            >
              <MessageSquareText className="h-4 w-4" />
              {t.requests.requestChanges}
            </button>
            <button
              type="button"
              className="btn-base btn-ghost btn-sm text-danger"
              disabled={Boolean(busy)}
              onClick={() => void respond("rejected")}
            >
              <X className="h-4 w-4" />
              {t.requests.reject}
            </button>
          </div>
        </div>
      )}
    </article>
  );
}
