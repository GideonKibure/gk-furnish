import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Outlet, Link, createRootRouteWithContext, useRouter, useRouterState, HeadContent, Scripts, type ErrorComponentProps } from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
import { Toaster } from "sonner";
import appCss from "../styles.css?url";
import { reportRuntimeError } from "../lib/error-reporting";
import { LanguageProvider } from "@/i18n/LanguageProvider";
import { SiteHeader } from "@/components/site/SiteHeader";
import { SiteFooter, WhatsAppFab } from "@/components/site/SiteFooter";
import { OfferBanner } from "@/components/site/OfferBanner";
import { CartProvider } from "@/lib/cart";
import { NavigationProgress } from "@/components/site/NavigationProgress";
import { SiteVisitTracker } from "@/components/site/SiteVisitTracker";
import { AuthPopupProvider } from "@/components/site/auth-popup";
import { SITE } from "@/config/site";
import { DEFAULT_OG_IMAGE } from "@/lib/seo";

function NotFoundComponent() {
  return (
    <div className="container-page py-24 text-center">
      <h1 className="display-xl text-navy">404</h1>
      <p className="mt-4 text-muted-foreground">This page doesn't exist or has moved.</p>
      <Link to="/" className="btn-base btn-gold mt-8">Back to home</Link>
    </div>
  );
}

function ErrorComponent({ error, reset }: ErrorComponentProps) {
  const router = useRouter();
  useEffect(() => { reportRuntimeError(error, { boundary: "root_error_component" }); }, [error]);
  return (
    <div className="container-page py-24 text-center">
      <h1 className="text-2xl text-navy">This page didn't load</h1>
      <button onClick={() => { router.invalidate(); reset(); }} className="btn-base btn-gold mt-6">Try again</button>
    </div>
  );
}

const ORGANIZATION_LD = JSON.stringify({
  "@context": "https://schema.org",
  "@type": "FurnitureStore",
  name: SITE.name,
  url: SITE.url,
  logo: DEFAULT_OG_IMAGE,
  telephone: SITE.phoneDial,
  email: SITE.email,
  address: { "@type": "PostalAddress", addressLocality: "Mbeya", addressCountry: "TZ" },
  currenciesAccepted: "TZS",
});

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
      { name: "theme-color", content: "#14213D" },
      { title: "GK furnish — Quality furniture for a better living, Mbeya" },
      { name: "description", content: "Stylish, affordable furniture for study, work and home — made in Mbeya, Tanzania. Prices in TZS, delivery arranged." },
      { property: "og:type", content: "website" },
      { property: "og:site_name", content: SITE.name },
      { property: "og:image", content: DEFAULT_OG_IMAGE },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700;800&display=swap",
      },
      { rel: "icon", href: "/brand/gk-furnish-logo.png", type: "image/png" },
      { rel: "sitemap", type: "application/xml", href: "/sitemap.xml" },
    ],
    scripts: [{ type: "application/ld+json", children: ORGANIZATION_LD }],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head><HeadContent /></head>
      <body>{children}<Scripts /></body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const isAdmin = pathname.startsWith("/admin");
  const [offerVisible, setOfferVisible] = useState(false);

  return (
    <QueryClientProvider client={queryClient}>
      <LanguageProvider>
        <NavigationProgress />
        {isAdmin ? (
          <Outlet />
        ) : (
          <CartProvider>
            <AuthPopupProvider>
              <OfferBanner onVisibilityChange={setOfferVisible} />
              <SiteHeader offerVisible={offerVisible} />
              <main id="main" className="min-h-[60vh] bg-white">
                <Outlet />
              </main>
              <SiteFooter />
              <WhatsAppFab />
              <SiteVisitTracker />
            </AuthPopupProvider>
          </CartProvider>
        )}
        <Toaster position="top-center" />
      </LanguageProvider>
    </QueryClientProvider>
  );
}
