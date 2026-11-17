import { Link } from "@tanstack/react-router";
import { fill } from "@/i18n/fill";
import { useLang } from "@/i18n/LanguageProvider";
import { cn } from "@/lib/utils";

/** Four steps from advance to handover. Pass current to mark the stage the order is in. */
export function MoneyTimeline({ current }: { current?: number | null }) {
  const { t } = useLang();
  return (
    <section>
      <h2 className="text-base font-bold text-navy">{t.checkout.moneyTitle}</h2>
      <ol className="mt-3 grid gap-3 sm:grid-cols-2">
        {t.policies.timeline.map((step, index) => {
          const active = current === index;
          return (
            <li
              key={step.title}
              aria-current={active ? "step" : undefined}
              className={cn(
                "rounded-lg border px-3 py-3 text-sm",
                active ? "border-gold bg-gold-tint" : "border-border bg-white",
              )}
            >
              <p className="font-semibold text-navy">
                {index + 1}. {step.title}
              </p>
              <p className="mt-1 text-muted-foreground">{step.body}</p>
            </li>
          );
        })}
      </ol>
      <p className="mt-3 text-sm">
        <Link to="/policies" className="font-semibold text-navy underline-offset-2 hover:underline">
          {t.checkout.policiesLink}
        </Link>
      </p>
    </section>
  );
}
