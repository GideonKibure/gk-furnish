import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Facebook, Instagram, Mail, MapPin, MessageCircle, Phone } from "lucide-react";
import { useLang } from "@/i18n/LanguageProvider";
import {
  sectionText,
  settingsToSite,
  siteSettingsQuery,
  pageSectionsQuery,
} from "@/lib/site-content";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { SITE } from "@/config/site";

function TikTokIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden>
      <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1-2.89-2.89 2.89 2.89 0 0 1 2.89-2.89c.28 0 .54.04.79.1v-3.5a6.37 6.37 0 0 0-.79-.05A6.34 6.34 0 0 0 3.15 15.3a6.34 6.34 0 0 0 6.34 6.34 6.34 6.34 0 0 0 6.34-6.34V8.73a8.19 8.19 0 0 0 4.76 1.52V6.84a4.84 4.84 0 0 1-1-.15Z" />
    </svg>
  );
}

export function SiteFooter() {
  const { t, lang } = useLang();
  const { data: settings } = useQuery(siteSettingsQuery);
  const { data: sections = [] } = useQuery(pageSectionsQuery);
  const site = settingsToSite(settings);
  const blurb = sectionText(sections, "footer", "blurb", lang, t.footer.blurb);
  const link = "text-sm text-primary-foreground/70 transition-colors hover:text-gold";

  const dial = site.phoneDial.startsWith("+")
    ? site.phoneDial
    : `+${site.phoneDial.replace(/\D/g, "")}`;
  const wa = `https://wa.me/${site.whatsappNumber}?text=${encodeURIComponent(t.whatsapp.general)}`;

  return (
    <footer className="bg-navy text-primary-foreground">
      <div className="container-page grid gap-10 py-14 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <div className="inline-flex items-center gap-3">
            <span className="footer-logo-glow" aria-hidden>
              <span className="footer-logo-glow-spin" />
              <span className="footer-logo-glow-pulse" />
              <span className="footer-logo-glow-inner">
                <img
                  src="/brand/gk-furnish-logo.svg"
                  alt=""
                  width={40}
                  height={40}
                  decoding="async"
                />
              </span>
            </span>
            <span className="font-display text-lg font-semibold tracking-tight text-white md:text-xl">
              {SITE.name}
            </span>
          </div>
          <p className="mt-4 max-w-xs text-sm text-primary-foreground/70">{blurb}</p>
          <div className="mt-5 flex gap-3">
            {[
              { href: site.social.instagram, Icon: Instagram, l: "Instagram" },
              { href: site.social.facebook, Icon: Facebook, l: "Facebook" },
              { href: site.social.tiktok, Icon: TikTokIcon, l: "TikTok" },
            ].map(({ href, Icon, l }) => (
              <a
                key={l}
                href={href}
                target="_blank"
                rel="noreferrer"
                aria-label={l}
                className="grid h-10 w-10 place-items-center rounded-full border border-primary-foreground/20 transition-all duration-300 hover:scale-110 hover:border-gold hover:text-gold"
              >
                <Icon className="h-4 w-4" />
              </a>
            ))}
          </div>
        </div>
        <div>
          <h3 className="font-sans text-sm font-semibold uppercase tracking-widest text-gold">
            {t.footer.explore}
          </h3>
          <ul className="mt-4 space-y-2.5">
            <li>
              <Link to="/about" className={link}>
                {t.nav.about}
              </Link>
            </li>
            <li>
              <Link to="/process" className={link}>
                {t.nav.process}
              </Link>
            </li>
            <li>
              <Link to="/gallery" className={link}>
                {t.nav.gallery}
              </Link>
            </li>
            <li>
              <Link to="/faq" className={link}>
                {t.nav.faq}
              </Link>
            </li>
            <li>
              <Link to="/custom-order" className={link}>
                {t.nav.custom}
              </Link>
            </li>
          </ul>
        </div>
        <div>
          <h3 className="font-sans text-sm font-semibold uppercase tracking-widest text-gold">
            {t.footer.shop}
          </h3>
          <ul className="mt-4 space-y-2.5">
            {(["chairs", "tables", "beds", "table-lamps"] as const).map((s) => (
              <li key={s}>
                <Link to="/categories/$slug" params={{ slug: s }} className={link}>
                  {s === "chairs"
                    ? t.gallery.chairs
                    : s === "tables"
                      ? t.gallery.tables
                      : s === "beds"
                        ? t.gallery.beds
                        : t.gallery.lamps}
                </Link>
              </li>
            ))}
            <li>
              <Link to="/products" className={link}>
                {t.nav.products}
              </Link>
            </li>
          </ul>
        </div>
        <div>
          <h3 className="font-sans text-sm font-semibold uppercase tracking-widest text-gold">
            {t.footer.contact}
          </h3>
          <ul className="mt-4 space-y-3 text-sm">
            <li>
              <a
                href={wa}
                target="_blank"
                rel="noreferrer"
                className={`${link} inline-flex items-center gap-2`}
              >
                <MessageCircle className="h-4 w-4" />
                WhatsApp {site.phoneDisplay}
              </a>
            </li>
            <li>
              <a href={`tel:${dial}`} className={`${link} inline-flex items-center gap-2`}>
                <Phone className="h-4 w-4" />
                {site.phoneDisplay}
              </a>
            </li>
            <li>
              <a
                href={`mailto:${site.email}`}
                className={`${link} inline-flex items-center gap-2 break-all`}
              >
                <Mail className="h-4 w-4 shrink-0" />
                {site.email}
              </a>
            </li>
            <li className="inline-flex items-center gap-2 text-primary-foreground/70">
              <MapPin className="h-4 w-4" />
              {site.location}
            </li>
          </ul>
          <div className="mt-5">
            <LanguageSwitcher dark />
          </div>
        </div>
      </div>
      <div className="border-t border-primary-foreground/10">
        <div className="container-page flex flex-col gap-2 py-5 text-xs text-primary-foreground/50 sm:flex-row sm:justify-between">
          <span>
            © {new Date().getFullYear()} {SITE.name}. {t.footer.rights}
          </span>
          <span>{t.footer.demoNote}</span>
        </div>
      </div>
    </footer>
  );
}

export function WhatsAppFab() {
  const { t } = useLang();
  const { data: settings } = useQuery(siteSettingsQuery);
  const site = settingsToSite(settings);
  const href = `https://wa.me/${site.whatsappNumber}?text=${encodeURIComponent(t.whatsapp.general)}`;
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      aria-label={`WhatsApp ${SITE.name}`}
      className="fixed bottom-[5.75rem] right-4 z-40 grid h-14 w-14 place-items-center rounded-full border border-background/50 bg-gold/90 text-navy backdrop-blur-md shadow-[var(--shadow-gold)] transition-transform hover:scale-110 active:scale-95 lg:bottom-6 lg:right-5"
    >
      <MessageCircle className="h-6 w-6" />
    </a>
  );
}
