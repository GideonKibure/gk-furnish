import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  useRouterState,
  HeadContent,
  Scripts,
  type ErrorComponentProps,
} from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
import { Toaster } from "sonner";
import { Analytics } from "@vercel/analytics/react";
import appCss from "../styles.css?url";
import { reportRuntimeError } from "../lib/error-reporting";
import { LanguageProvider } from "@/i18n/LanguageProvider";
import { SiteHeader } from "@/components/site/SiteHeader";
import { SiteFooter, WhatsAppFab } from "@/components/site/SiteFooter";
import { OfferBanner } from "@/components/site/OfferBanner";

function NotFoundComponent() {
  return (
    <div className="container-page py-24 text-center">
      <h1 className="display-xl text-navy">404</h1>
      <p className="mt-4 text-muted-foreground">This page doesn't exist or has moved.</p>
      <Link to="/" className="btn-base btn-gold mt-8">
        Back to home
      </Link>
    </div>
  );
}

function ErrorComponent({ error, reset }: ErrorComponentProps) {
  const router = useRouter();
  useEffect(() => {
    reportRuntimeError(error, { boundary: "root_error_component" });
  }, [error]);
  return (
    <div className="container-page py-24 text-center">
      <h1 className="text-2xl text-navy">This page didn't load</h1>
      <button
        onClick={() => {
          router.invalidate();
          reset();
        }}
        className="btn-base btn-gold mt-6"
      >
        Try again
      </button>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "GK furnish — Locally made furniture, Mbeya" },
      {
        name: "description",
        content: "Durable, affordable furniture handmade in Mbeya, Tanzania.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,600;9..144,700&family=Outfit:wght@400;500;600;700&display=swap",
      },
      { rel: "icon", href: "/brand/gk-furnish-logo.svg", type: "image/svg+xml" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
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
        {isAdmin ? (
          <Outlet />
        ) : (
          <>
            <OfferBanner onVisibilityChange={setOfferVisible} />
            <SiteHeader offerVisible={offerVisible} />
            <main>
              <Outlet />
            </main>
            <SiteFooter />
            <WhatsAppFab />
          </>
        )}
        <Toaster position="top-center" />
        <Analytics />
      </LanguageProvider>
    </QueryClientProvider>
  );
}
