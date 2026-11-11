import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { PageHeader } from "@/components/site/PageHeader";
import { ServiceMedia } from "@/components/site/ServiceMedia";
import { formatAmount } from "@/config/site";
import { useAuthUser } from "@/hooks/use-auth";
import { localized, useLang } from "@/i18n/LanguageProvider";
import { servicesQuery } from "@/lib/catalog";
import { seo } from "@/lib/seo";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/services")({
  head: () =>
    seo({
      title: "Services — GK furnish",
      description: "Workshop services from GK Furnish in Mbeya, with prices and photos or video.",
      path: "/services",
    }),
  loader: ({ context }) => context.queryClient.ensureQueryData(servicesQuery).catch(() => []),
  component: ServicesPage,
});

function ServicesPage() {
  const { t, lang } = useLang();
  const { user } = useAuthUser();
  const { data: services = [] } = useQuery(servicesQuery);
  const [activeId, setActiveId] = useState("");

  useEffect(() => {
    const hash = window.location.hash.replace("#", "");
    if (services.some((service) => service.id === hash)) {
      setActiveId(hash);
      return;
    }
    setActiveId((current) => (services.some((service) => service.id === current) ? current : (services[0]?.id ?? "")));
  }, [services]);

  const active = services.find((service) => service.id === activeId) ?? services[0] ?? null;
  const name = active ? localized(lang, active.name, active.name_sw) : "";

  return (
    <div className="bg-sand">
      <div className="container-page py-5 md:py-8">
        <PageHeader
          title={t.home2.servicesTitle}
          subtitle={t.home2.servicesSubtitle}
          crumbs={[
            user
              ? { label: t.shell.shop, href: "/products" }
              : { label: t.nav.home, href: "/" },
            { label: t.nav.services },
          ]}
        />
        {services.length === 0 ? (
          <p className="mt-6 text-sm text-muted-foreground">{t.home2.servicesEmpty}</p>
        ) : (
          <div className="mt-6">
            <div className="flex gap-2 overflow-x-auto pb-1" role="tablist" aria-label={t.nav.services}>
              {services.map((service) => {
                const label = localized(lang, service.name, service.name_sw);
                const selected = service.id === active?.id;
                return (
                  <button
                    key={service.id}
                    type="button"
                    role="tab"
                    id={`service-tab-${service.id}`}
                    aria-selected={selected}
                    aria-controls="service-panel"
                    className={cn(
                      "shrink-0 rounded-full px-4 py-2 text-sm font-semibold transition-colors",
                      selected ? "bg-gold text-navy" : "bg-white text-navy/70 hover:text-navy",
                    )}
                    onClick={() => {
                      setActiveId(service.id);
                      window.history.replaceState(null, "", `#${service.id}`);
                    }}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
            {active && (
              <article
                id="service-panel"
                role="tabpanel"
                aria-labelledby={`service-tab-${active.id}`}
                className="panel mt-4 overflow-hidden"
              >
                {active.media_url && (
                  <ServiceMedia
                    url={active.media_url}
                    kind={active.media_kind}
                    alt={name}
                    className="aspect-[16/10] w-full bg-navy object-cover"
                  />
                )}
                <div className="p-5 md:p-6">
                  <h2 className="text-xl font-bold text-navy">{name}</h2>
                  {active.price_tzs != null && active.price_tzs > 0 && (
                    <p className="mt-1 text-lg font-bold tabular-nums text-gold-ink">{formatAmount(active.price_tzs)}</p>
                  )}
                  {(active.description || active.description_sw) && (
                    <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground">
                      {localized(lang, active.description ?? "", active.description_sw)}
                    </p>
                  )}
                </div>
              </article>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
