import { useQuery } from "@tanstack/react-query";
import { useRouterState } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect } from "react";
import { useAuthUser } from "@/hooks/use-auth";
import { getMyRole } from "@/lib/account.functions";
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

/** Counts time on the shop, and time in the admin portal. A signed-in admin is not counted on the shop. */
export function SiteVisitTracker() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const beat = useServerFn(beatSiteVisit);
  const loadRole = useServerFn(getMyRole);
  const { user, ready } = useAuthUser();
  const onAdmin = pathname.startsWith("/admin");
  const role = useQuery({
    queryKey: ["my-role", user?.id],
    queryFn: () => loadRole(),
    enabled: Boolean(user) && !onAdmin,
    staleTime: 5 * 60_000,
  });

  useEffect(() => {
    if (!ready) return;
    const path = pathname.slice(0, 180);
    if (!onAdmin && user && role.data?.isAdmin) {
      void beat({ data: { visitId: currentVisitId(), visitorId: visitorId(), path } }).catch(() => undefined);
      return;
    }
    if (onAdmin) {
      if (!user) return;
    } else if (user && !role.isError && role.isLoading) {
      return;
    }
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
  }, [pathname, beat, ready, onAdmin, user, role.isError, role.isLoading, role.data?.isAdmin]);

  return null;
}
