import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ChevronLeft, ChevronRight, MessageCircle, Sparkles, Wrench } from "lucide-react";
import { useEffect, useState } from "react";
import { PageHeader } from "@/components/site/PageHeader";
import { ServiceMedia } from "@/components/site/ServiceMedia";
import { formatAmount, waLink } from "@/config/site";
import { useAuthUser } from "@/hooks/use-auth";
import { fill } from "@/i18n/fill";
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

  useEffect(() => {
    if (!activeId) return;
    document.getElementById(`service-tab-${activeId}`)?.scrollIntoView({ inline: "center", block: "nearest", behavior: "smooth" });
  }, [activeId]);

  const activeIndex = Math.max(0, services.findIndex((service) => service.id === activeId));
  const active = services[activeIndex] ?? null;
  const name = active ? localized(lang, active.name, active.name_sw) : "";

  function openService(id: string) {
    setActiveId(id);
    window.history.replaceState(null, "", `#${id}`);
  }

  function step(direction: -1 | 1) {
    if (!services.length) return;
    const next = services[(activeIndex + direction + services.length) % services.length];
    if (next) openService(next.id);
  }

  return (
    <div className="bg-sand">
      <div className="container-page py-5 pb-28 md:py-8 md:pb-10">
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
            <div className="no-scrollbar -mx-1 flex snap-x gap-2 overflow-x-auto px-1 pb-1" role="tablist" aria-label={t.nav.services}>
              {services.map((service, index) => {
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
                      "min-h-11 shrink-0 snap-start rounded-full px-4 py-2 text-sm font-semibold transition-transform duration-200 active:scale-[0.97]",
                      selected ? "bg-gold text-navy shadow-[0_8px_20px_rgb(252_163_17/0.28)]" : "bg-white text-navy/70 hover:-translate-y-0.5 hover:text-navy",
                    )}
                    onClick={() => openService(service.id)}
                  >
                    <span className="mr-1.5 tabular-nums text-navy/45">{String(index + 1).padStart(2, "0")}</span>
                    {label}
                  </button>
                );
              })}
            </div>
            {active && (
              <article
                key={active.id}
                id="service-panel"
                role="tabpanel"
                aria-labelledby={`service-tab-${active.id}`}
                className="service-card panel mt-4 overflow-hidden"
              >
                <div className="grid md:grid-cols-2">
                  <div className="service-media relative min-h-56 overflow-hidden bg-navy sm:min-h-72 md:min-h-[28rem]">
                    {active.media_url ? (
                      <ServiceMedia
                        url={active.media_url}
                        kind={active.media_kind}
                        alt={name}
                        className="absolute inset-0 h-full w-full object-cover"
                      />
                    ) : (
                      <div className="absolute inset-0 grid place-items-center text-white/80">
                        <Wrench className="h-12 w-12" strokeWidth={1.4} />
                      </div>
                    )}
                    {active.price_tzs != null && active.price_tzs > 0 && (
                      <p className="absolute bottom-3 left-3 rounded-full bg-gold px-3 py-1.5 text-sm font-bold tabular-nums text-navy shadow-md sm:bottom-4 sm:left-4 sm:text-base">
                        {formatAmount(active.price_tzs)}
                      </p>
                    )}
                  </div>
                  <div className="flex flex-col p-5 sm:p-6 lg:p-8">
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-gold-ink">
                      {String(activeIndex + 1).padStart(2, "0")} / {String(services.length).padStart(2, "0")}
                    </p>
                    <h2 className="mt-2 text-2xl font-bold leading-tight text-navy sm:text-3xl">{name}</h2>
                    {(active.description || active.description_sw) && (
                      <p className="mt-3 text-sm leading-relaxed text-muted-foreground sm:text-base">
                        {localized(lang, active.description ?? "", active.description_sw)}
                      </p>
                    )}
                    <div className="mt-6 flex flex-col gap-2 sm:flex-row">
                      <a
                        className="btn-base btn-gold"
                        href={waLink(fill(t.home2.servicesAskMessage, { name }))}
                        target="_blank"
                        rel="noreferrer"
                      >
                        <MessageCircle className="h-4 w-4" />
                        {t.home2.servicesAsk}
                      </a>
                      <Link to="/custom-order" className="btn-base btn-outline-navy">
                        <Sparkles className="h-4 w-4" />
                        {t.home2.servicesOwn}
                      </Link>
                    </div>
                    {services.length > 1 && (
                      <div className="mt-5 flex gap-2">
                        <button type="button" className="icon-btn border border-border" aria-label={t.home2.servicesPrevious} onClick={() => step(-1)}>
                          <ChevronLeft className="h-5 w-5" />
                        </button>
                        <button type="button" className="icon-btn border border-border" aria-label={t.home2.servicesNext} onClick={() => step(1)}>
                          <ChevronRight className="h-5 w-5" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </article>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
