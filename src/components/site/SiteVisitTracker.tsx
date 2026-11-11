import { useRouterState } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect } from "react";
import { beatSiteVisit } from "@/lib/visits.functions";
import { visitorId } from "@/lib/visitor";

const VISIT_KEY = "gk-site-visit";
const IDLE_MS = 30 * 60 * 1000;

function currentVisitId() {
  try {
    const raw = window.sessionStorage.getItem(VISIT_KEY);
    const parsed = raw ? (JSON.parse(raw) as { id?: string; seen?: number }) : null;
    const fresh = parsed?.id && typeof parsed.seen === "number" && Date.now() - parsed.seen < IDLE_MS;
    const id = fresh ? parsed.id! : crypto.randomUUID();
    window.sessionStorage.setItem(VISIT_KEY, JSON.stringify({ id, seen: Date.now() }));
    return id;
  } catch {
    return crypto.randomUUID();
  }
}

/** Counts an open shop visit and the time the tab stays visible. Admin pages are not counted. */
export function SiteVisitTracker() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const beat = useServerFn(beatSiteVisit);

  useEffect(() => {
    if (pathname.startsWith("/admin")) return;
    const path = pathname.slice(0, 180);
    let timer = 0;
    const send = () => {
      void beat({ data: { visitId: currentVisitId(), visitorId: visitorId(), path } }).catch(() => undefined);
    };
    send();
    timer = window.setInterval(() => {
      if (document.visibilityState === "visible") send();
    }, 20_000);
    const onHide = () => {
      if (document.visibilityState === "hidden") send();
    };
    document.addEventListener("visibilitychange", onHide);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onHide);
    };
  }, [pathname, beat]);

  return null;
}
