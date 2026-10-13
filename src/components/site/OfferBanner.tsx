import { useQuery } from "@tanstack/react-query";
import { Megaphone, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useLang } from "@/i18n/LanguageProvider";
import { activeOfferQuery } from "@/lib/site-content";
import { cn } from "@/lib/utils";

const DISMISS_KEY = "gk-offer-dismissed";

export function OfferBanner({ onVisibilityChange }: { onVisibilityChange?: (visible: boolean) => void }) {
  const { lang, t } = useLang();
  const { data: offer } = useQuery(activeOfferQuery);
  const [phase, setPhase] = useState<"hidden" | "in" | "out">("hidden");
  const onVisibilityChangeRef = useRef(onVisibilityChange);
  onVisibilityChangeRef.current = onVisibilityChange;

  function finishHide() {
    setPhase((current) => {
      if (current !== "in") return current;
      onVisibilityChangeRef.current?.(false);
      return "out";
    });
  }

  useEffect(() => {
    if (!offer) {
      setPhase("hidden");
      onVisibilityChangeRef.current?.(false);
      return;
    }
    try {
      if (sessionStorage.getItem(`${DISMISS_KEY}:${offer.id}`) === "1") {
        setPhase("hidden");
        onVisibilityChangeRef.current?.(false);
        return;
      }
    } catch {
      /* ignore */
    }

    const showTimer = window.setTimeout(() => {
      setPhase("in");
      onVisibilityChangeRef.current?.(true);
    }, Math.max(0, offer.delay_seconds) * 1000);

    return () => window.clearTimeout(showTimer);
  }, [offer]);

  useEffect(() => {
    if (phase !== "in" || !offer) return;
    const hideTimer = window.setTimeout(finishHide, Math.max(1, offer.duration_seconds) * 1000);
    return () => window.clearTimeout(hideTimer);
  }, [phase, offer]);

  useEffect(() => {
    if (phase !== "out") return;
    const done = window.setTimeout(() => setPhase("hidden"), 680);
    return () => window.clearTimeout(done);
  }, [phase]);

  if (!offer || phase === "hidden") return null;

  const message = lang === "sw" && offer.message_sw ? offer.message_sw : offer.message_en;
  const badge = t.common.offer;

  function dismiss() {
    try {
      sessionStorage.setItem(`${DISMISS_KEY}:${offer!.id}`, "1");
    } catch {
      /* ignore */
    }
    finishHide();
  }

  return (
    <>
    <div className={cn("offer-banner-spacer", phase === "out" && "is-leaving")} aria-hidden />
    <div
      role="status"
      className={cn("offer-banner", phase === "out" && "is-leaving")}
    >
      <div className="offer-banner-stripe" aria-hidden />
      <div className="container-page relative flex items-center justify-center gap-3 py-3 pr-12 text-center sm:py-3.5">
        <span className="offer-banner-icon hidden sm:grid">
          <Megaphone className="h-4 w-4" />
        </span>
        <p className="text-sm font-semibold tracking-wide text-white sm:text-[0.95rem]">
          <span className="offer-banner-badge mr-2">{badge}</span>
          {message}
        </p>
        <button
          type="button"
          onClick={dismiss}
          className="offer-banner-close absolute right-3 top-1/2 -translate-y-1/2"
          aria-label={t.common.dismiss}
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="offer-banner-progress" aria-hidden>
        <span
          className="offer-banner-progress-bar"
          style={{ animationDuration: `${Math.max(1, offer.duration_seconds)}s` }}
        />
      </div>
    </div>
    </>
  );
}
