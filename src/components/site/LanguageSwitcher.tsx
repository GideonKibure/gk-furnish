import { useLang, type Lang } from "@/i18n/LanguageProvider";
import { cn } from "@/lib/utils";

export function LanguageSwitcher({ dark = false }: { dark?: boolean }) {
  const { lang, setLang, t } = useLang();
  const opts: { v: Lang; short: string; full: string }[] = [
    { v: "en", short: "EN", full: t.lang.english },
    { v: "sw", short: "SW", full: t.lang.swahili },
  ];

  return (
    <div
      role="group"
      aria-label={t.lang.switch}
      className={cn(
        "inline-flex items-center rounded-full border p-0.5 text-xs font-bold tracking-wide shadow-sm",
        dark ? "border-white/15 bg-white/[0.06]" : "border-border bg-background/90",
      )}
    >
      {opts.map((o) => {
        const active = lang === o.v;
        return (
          <button
            key={o.v}
            type="button"
            onClick={() => setLang(o.v)}
            aria-pressed={active}
            aria-label={o.full}
            title={o.full}
            className={cn(
              "rounded-full px-2.5 py-1.5 transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/50",
              active
                ? "bg-gold text-navy shadow-sm"
                : dark
                  ? "text-white/65 hover:bg-white/10 hover:text-white"
                  : "text-muted-foreground hover:bg-secondary hover:text-navy",
            )}
          >
            <span className="sm:hidden">{o.short}</span>
            <span className="hidden sm:inline">{o.full}</span>
          </button>
        );
      })}
    </div>
  );
}
