import { useLang, type Lang } from "@/i18n/LanguageProvider";
import { cn } from "@/lib/utils";

export function LanguageSwitcher({ dark = false, compact = false }: { dark?: boolean; compact?: boolean }) {
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
        "inline-flex items-center rounded-full border p-0.5 text-xs font-bold",
        dark ? "border-white/20 bg-white/[0.06]" : "border-border bg-white",
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
              "rounded-full px-2.5 py-1 transition-colors",
              active
                ? "bg-navy text-white"
                : dark
                  ? "text-white/70 hover:text-white"
                  : "text-muted-foreground hover:text-navy",
            )}
          >
            {compact ? o.short : (
              <>
                <span className="sm:hidden">{o.short}</span>
                <span className="hidden sm:inline">{o.full}</span>
              </>
            )}
          </button>
        );
      })}
    </div>
  );
}
