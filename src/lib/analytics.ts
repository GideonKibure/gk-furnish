type Gtag = (command: "event", name: string, params?: Record<string, string | number>) => void;

/** Shop analytics. Does nothing in admin, and nothing when the analytics script is not loaded. */
export function trackEvent(name: string, params?: Record<string, string | number>) {
  if (typeof window === "undefined") return;
  try {
    if (window.location.pathname.startsWith("/admin")) return;
    const gtag = (window as Window & { gtag?: Gtag }).gtag;
    if (typeof gtag !== "function") return;
    if (params) gtag("event", name, params);
    else gtag("event", name);
  } catch {
    // A blocked analytics script must not stop the shop.
  }
}
