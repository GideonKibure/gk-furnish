import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { BadgeCheck } from "lucide-react";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { useAuthPopup } from "@/hooks/use-auth-popup";
import { StarInput, StarRating } from "@/components/brand/StarRating";
import { useAuthUser } from "@/hooks/use-auth";
import { fill } from "@/i18n/fill";
import { useLang } from "@/i18n/LanguageProvider";
import { approvedReviewsQuery } from "@/lib/catalog";
import { getReviewEligibility, submitReview } from "@/lib/reviews.functions";

function ReviewForm({ productId, onDone }: { productId: string; onDone: () => void }) {
  const { t } = useLang();
  const send = useServerFn(submitReview);
  const [rating, setRating] = useState(0);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!rating) {
      setError(t.reviews.ratingRequired);
      return;
    }
    setBusy(true);
    setError("");
    try {
      await send({ data: { productId, rating, title, body } });
      toast.success(t.reviews.thanks);
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : t.validation.failed);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="panel space-y-3 p-4 md:p-5">
      <p className="font-semibold text-navy">{t.reviews.write}</p>
      <div>
        <p className="field-label">{t.reviews.rating}</p>
        <StarInput value={rating} onChange={setRating} label={t.reviews.rating} />
      </div>
      <div>
        <label className="field-label" htmlFor="review-title">
          {t.reviews.titleLabel}
        </label>
        <input
          id="review-title"
          className="field-input"
          maxLength={120}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
      </div>
      <div>
        <label className="field-label" htmlFor="review-body">
          {t.reviews.body}
        </label>
        <textarea
          id="review-body"
          required
          minLength={3}
          maxLength={2000}
          rows={4}
          className="field-input"
          placeholder={t.reviews.bodyPlaceholder}
          value={body}
          onChange={(e) => setBody(e.target.value)}
        />
      </div>
      {error && (
        <p className="field-error" role="alert">
          {error}
        </p>
      )}
      <button type="submit" disabled={busy} className="btn-base btn-gold">
        {busy ? t.reviews.submitting : t.reviews.submit}
      </button>
    </form>
  );
}

/** Approved reviews plus a form for verified buyers. Hidden parts stay hidden until data exists. */
export function ProductReviews({ productId }: { productId: string }) {
  const { t } = useLang();
  const { user, ready } = useAuthUser();
  const { open: openAuth } = useAuthPopup();
  const queryClient = useQueryClient();
  const { data: reviews = [] } = useQuery(approvedReviewsQuery(productId));
  const check = useServerFn(getReviewEligibility);
  const [sent, setSent] = useState(false);
  const { data: eligibility } = useQuery({
    queryKey: ["review-eligibility", productId, user?.id ?? "guest"],
    queryFn: () => check({ data: { productId } }),
    enabled: Boolean(user),
    staleTime: 60_000,
    retry: false,
  });

  const avg = reviews.length ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length : 0;

  return (
    <div className="space-y-5">
      {reviews.length > 0 ? (
        <div className="flex flex-wrap items-center gap-3">
          <span className="font-display text-3xl font-bold text-navy">{avg.toFixed(1)}</span>
          <div>
            <StarRating value={avg} size="md" />
            <p className="text-xs text-muted-foreground">
              {fill(t.reviews.basedOn, { count: reviews.length })}
            </p>
          </div>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">{t.reviews.none}</p>
      )}

      {reviews.length > 0 && (
        <ul className="divide-y divide-border rounded-xl border border-border bg-white">
          {reviews.map((r) => (
            <li key={r.id} className="p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <StarRating value={r.rating} />
                <time className="text-xs text-muted-foreground" dateTime={r.created_at}>
                  {new Date(r.created_at).toLocaleDateString("en-GB", {
                    timeZone: "Africa/Dar_es_Salaam",
                  })}
                </time>
              </div>
              {r.title && <p className="mt-1.5 font-semibold text-navy">{r.title}</p>}
              {r.body && <p className="mt-1 text-sm leading-relaxed text-navy/80">{r.body}</p>}
              <p className="mt-2 inline-flex items-center gap-1 text-xs text-muted-foreground">
                <span className="font-semibold text-navy">{r.author_name}</span>
                <BadgeCheck className="h-3.5 w-3.5 text-success" />
                {t.reviews.verified}
              </p>
            </li>
          ))}
        </ul>
      )}

      {ready && !user && (
        <p className="text-sm text-muted-foreground">
          <button type="button" onClick={() => openAuth({ reason: "account", mode: "signin" })} className="font-semibold text-gold-ink hover:underline">
            {t.reviews.signIn}
          </button>
        </p>
      )}
      {user &&
        eligibility?.available &&
        (sent || eligibility.already ? (
          <p className="text-sm text-success">{sent ? t.reviews.thanks : t.reviews.already}</p>
        ) : eligibility.eligible ? (
          <ReviewForm
            productId={productId}
            onDone={() => {
              setSent(true);
              void queryClient.invalidateQueries({ queryKey: ["review-eligibility", productId] });
            }}
          />
        ) : (
          <p className="text-sm text-muted-foreground">{t.reviews.onlyBuyers}</p>
        ))}
    </div>
  );
}
