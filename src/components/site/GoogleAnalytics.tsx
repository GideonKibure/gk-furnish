import { useRouterState } from "@tanstack/react-router";
import { useEffect, useRef } from "react";
import { GA_MEASUREMENT_ID } from "@/config/site";

type Gtag = (...args: unknown[]) => void;

/** Loads Google Analytics on the shop and records a page view when the route changes. */
export function GoogleAnalytics() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const href = useRouterState({ select: (s) => s.location.href });
  const firstView = useRef(true);

  useEffect(() => {
    const gtag = (window as Window & { gtag?: Gtag }).gtag;
    if (typeof gtag !== "function") return;
    if (firstView.current) {
      firstView.current = false;
      return;
    }
    gtag("event", "page_view", {
      page_path: `${pathname}${window.location.search}`,
      page_location: window.location.href,
    });
  }, [pathname, href]);

  const setup = `window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}window.gtag=gtag;gtag('js',new Date());gtag('config','${GA_MEASUREMENT_ID}');`;

  return (
    <>
      <script async src={`https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`} />
      <script dangerouslySetInnerHTML={{ __html: setup }} />
    </>
  );
}
