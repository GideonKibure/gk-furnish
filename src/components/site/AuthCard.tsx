import { useServerFn } from "@tanstack/react-start";
import { CheckCircle2 } from "lucide-react";
import type { ReactNode } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useLang } from "@/i18n/LanguageProvider";
import { getMyRole } from "@/lib/account.functions";

/** Only same-site paths are allowed as a post-login destination. */
export function safeNext(next: unknown, fallback = "/products") {
  return typeof next === "string" && next.startsWith("/") && !next.startsWith("//") ? next : fallback;
}

const isAdminPath = (path: string) => /^\/admin(?:[/?#]|$)/.test(path);

/** Marketing pages a signed-in customer should not land on. */
export function isBrochurePath(path: string) {
  return path === "/" || path === "/about" || path.startsWith("/about/");
}

/** Where a signed-in user goes: the shop, unless an explicit safe `next` points somewhere else. */
export function postLoginPath(next: unknown, isAdmin: boolean) {
  const home = isAdmin ? "/admin" : "/products";
  const target = safeNext(next, home);
  if (!isAdmin && isBrochurePath(target)) return "/products";
  return isAdminPath(target) && !isAdmin ? "/products" : target;
}

/** Resolves the post-login destination for the current session; role lookup failures count as customer. */
export function useRoleDestination() {
  const getRole = useServerFn(getMyRole);
  return async (next: unknown) => {
    const isAdmin = await getRole()
      .then((r) => r.isAdmin)
      .catch(() => false);
    return { isAdmin, path: postLoginPath(next, isAdmin) };
  };
}

export function AuthCard({ title, intro, children }: { title: string; intro?: string | undefined; children: ReactNode }) {
  const { t } = useLang();
  const perks = [t.badges.quality, t.badges.delivery, t.badges.payments, t.badges.support];
  return (
    <div className="bg-sand">
      <div className="container-page flex min-h-[70vh] items-center justify-center py-8 md:py-14">
        <div className="grid w-full max-w-4xl overflow-hidden rounded-xl border border-border bg-white shadow-[var(--shadow-card)] md:grid-cols-[minmax(0,0.9fr)_minmax(0,1fr)]">
          <div className="hidden flex-col justify-between bg-navy p-8 text-white md:flex">
            <div className="flex items-center gap-3">
              <span className="grid h-12 w-12 place-items-center rounded-full bg-white p-1.5">
                <img src="/brand/gk-furnish-logo.svg" alt="" className="h-full w-full object-contain" />
              </span>
              <span>
                <span className="block font-display text-lg font-extrabold uppercase">GK furnish</span>
                <span className="block text-xs text-white/60">{t.shell.tagline}</span>
              </span>
            </div>
            <div>
              <p className="font-display text-2xl font-bold leading-snug">{t.shell.trust}</p>
              <ul className="mt-5 space-y-2.5 text-sm text-white/80">
                {perks.map((perk) => (
                  <li key={perk} className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-gold" />
                    {perk}
                  </li>
                ))}
              </ul>
            </div>
          </div>
          <div className="p-6 md:p-8">
            <h1 className="font-display text-2xl font-bold tracking-tight text-navy md:text-3xl">{title}</h1>
            {intro && <p className="mt-2 text-sm text-muted-foreground">{intro}</p>}
            <div className="mt-6">{children}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function GoogleButton({ next }: { next?: string | undefined }) {
  const { t } = useLang();
  async function onClick() {
    const query = next ? `?next=${encodeURIComponent(next)}` : "";
    const redirectTo = `${window.location.origin}/auth/callback${query}`;
    const { error } = await supabase.auth.signInWithOAuth({ provider: "google", options: { redirectTo } });
    if (error) toast.error(error.message || t.auth.failed);
  }
  return (
    <>
      <button type="button" onClick={() => void onClick()} className="btn-base btn-outline-navy w-full">
        <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden>
          <path fill="#EA4335" d="M12 10.2v3.9h5.5c-.2 1.3-1.6 3.9-5.5 3.9-3.3 0-6-2.7-6-6.1s2.7-6.1 6-6.1c1.9 0 3.1.8 3.8 1.5l2.6-2.5C16.8 3.3 14.6 2.3 12 2.3 6.6 2.3 2.3 6.6 2.3 12s4.3 9.7 9.7 9.7c5.6 0 9.3-3.9 9.3-9.5 0-.6-.1-1.1-.2-1.6H12z" />
        </svg>
        {t.auth.google}
      </button>
      <div className="my-5 flex items-center gap-3 text-xs uppercase tracking-wider text-muted-foreground">
        <span className="h-px flex-1 bg-border" />
        {t.auth.or}
        <span className="h-px flex-1 bg-border" />
      </div>
    </>
  );
}
