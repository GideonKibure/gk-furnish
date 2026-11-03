import { useQuery } from "@tanstack/react-query";
import { ShieldCheck } from "lucide-react";
import { fill } from "@/i18n/fill";
import { useLang } from "@/i18n/LanguageProvider";
import { advanceSettingsFrom } from "@/lib/payment-policy";
import { siteSettingsQuery } from "@/lib/site-content";
import { cn } from "@/lib/utils";

export function PaymentPolicy({ className, compact = false }: { className?: string; compact?: boolean }) {
  const { t } = useLang();
  const { data: settings } = useQuery(siteSettingsQuery);
  const s = advanceSettingsFrom(settings);
  return (
    <section className={cn("rounded-2xl border border-gold/30 bg-gold-soft/40 p-5", className)}>
      <h2 className="flex items-center gap-2 font-semibold text-navy">
        <ShieldCheck className="h-4 w-4 text-gold" />
        {t.policy.title}
      </h2>
      <p className="mt-2 text-sm font-medium text-navy">
        {fill(t.policy.tiers, { standard: s.standardPercent, custom: s.customPercent, large: s.largePercent })}
      </p>
      <ul className={cn("mt-2 list-disc space-y-1 pl-5 text-sm text-muted-foreground", compact && "text-xs")}>
        {t.policy.items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </section>
  );
}
