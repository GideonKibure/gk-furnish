import { Gem, Headset, ShieldCheck, Truck } from "lucide-react";
import { useLang } from "@/i18n/LanguageProvider";
import { cn } from "@/lib/utils";

/** The four trust badges under the home hero. */
export function FeatureBadges({ className }: { className?: string }) {
  const { t } = useLang();
  const items = [
    { icon: Gem, title: t.badges.quality, body: t.badges.qualityBody },
    { icon: Truck, title: t.badges.delivery, body: t.badges.deliveryBody },
    { icon: ShieldCheck, title: t.badges.payments, body: t.badges.paymentsBody },
    { icon: Headset, title: t.badges.support, body: t.badges.supportBody },
  ];
  return (
    <ul
      className={cn(
        "grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-border bg-border shadow-[var(--shadow-card)] lg:grid-cols-4",
        className,
      )}
    >
      {items.map(({ icon: Icon, title, body }) => (
        <li key={title} className="flex items-center gap-3 bg-white px-4 py-4 sm:px-5">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-gold-tint text-navy">
            <Icon className="h-5 w-5" strokeWidth={1.8} />
          </span>
          <span className="min-w-0">
            <span className="block text-sm font-semibold leading-tight text-navy">{title}</span>
            <span className="mt-0.5 block text-xs leading-snug text-muted-foreground max-sm:hidden">
              {body}
            </span>
          </span>
        </li>
      ))}
    </ul>
  );
}
