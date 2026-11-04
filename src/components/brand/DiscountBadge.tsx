import { fill } from "@/i18n/fill";
import { useLang } from "@/i18n/LanguageProvider";
import { cn } from "@/lib/utils";

/** Gold "-X% OFF" badge with navy text. */
export function DiscountBadge({
  percent,
  className,
}: {
  percent: number | null | undefined;
  className?: string;
}) {
  const { t } = useLang();
  if (!percent) return null;
  return <span className={cn("discount-badge", className)}>{fill(t.pdp.off, { percent })}</span>;
}
