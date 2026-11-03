import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { z } from "zod";
import { AuthCard, useRoleDestination } from "@/components/site/AuthCard";
import { supabase } from "@/integrations/supabase/client";
import { useLang } from "@/i18n/LanguageProvider";

export const Route = createFileRoute("/auth/callback")({
  validateSearch: z.object({ next: z.string().optional(), code: z.string().optional() }),
  head: () => ({ meta: [{ title: "Signing in — GK furnish" }, { name: "robots", content: "noindex" }] }),
  component: AuthCallback,
});

function AuthCallback() {
  const { t } = useLang();
  const nav = useNavigate();
  const { next, code } = Route.useSearch();
  const destination = useRoleDestination();
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      void destination(next).then(({ path }) => nav({ href: path, replace: true }));
    };
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) finish();
    });
    (async () => {
      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (error) {
          const { data } = await supabase.auth.getSession();
          if (!data.session) setFailed(true);
        }
      }
      const { data } = await supabase.auth.getSession();
      if (data.session) finish();
    })();
    const timer = setTimeout(() => {
      if (!done) setFailed(true);
    }, 8000);
    return () => {
      sub.subscription.unsubscribe();
      clearTimeout(timer);
    };
  }, []);

  return (
    <AuthCard title={t.auth.loginTitle}>
      {failed ? (
        <p className="text-sm text-destructive">{t.auth.failed}</p>
      ) : (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          {t.auth.finishing}
        </p>
      )}
    </AuthCard>
  );
}
