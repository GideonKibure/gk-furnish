import type { ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { trackEvent } from "@/lib/analytics";
import { settingsToSite, siteSettingsQuery } from "@/lib/site-content";
import { buildWhatsAppLink } from "@/lib/whatsapp";

/** Opens WhatsApp with a prefilled message. The number comes from site settings. */
export function WhatsAppOrderLink({
  source,
  text,
  className,
  children,
}: {
  source: "product" | "cart" | "custom" | "ask_price_success" | "policies" | "search";
  text: string;
  className?: string;
  children: ReactNode;
}) {
  const { data } = useQuery(siteSettingsQuery);
  const number = settingsToSite(data).whatsappNumber;
  return (
    <a
      href={buildWhatsAppLink({ number, text })}
      target="_blank"
      rel="noreferrer"
      className={className}
      onClick={() => trackEvent("whatsapp_click", { source })}
    >
      {children}
    </a>
  );
}
