import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { z } from "zod";
import { AuthCard, GoogleButton, safeNext } from "@/components/site/AuthCard";
import { supabase } from "@/integrations/supabase/client";
import { useLang } from "@/i18n/LanguageProvider";

export const Route = createFileRoute("/account/login")({
  validateSearch: z.object({ next: z.string().optional() }),
  head: () => ({ meta: [{ title: "Sign in — GK furnish" }, { name: "robots", content: "noindex" }] }),
  component: LoginPage,
});

function LoginPage() {
  const { t } = useLang();
  const nav = useNavigate();
  const { next } = Route.useSearch();
  const target = safeNext(next);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setBusy(true);
    setError("");
    const { error: err } = await supabase.auth.signInWithPassword({
      email: String(fd.get("email") ?? "").trim(),
      password: String(fd.get("password") ?? ""),
    });
    setBusy(false);
    if (err) {
      setError(err.message.toLowerCase().includes("invalid") ? t.auth.invalid : err.message);
      return;
    }
    void nav({ href: target });
  }

  return (
    <AuthCard title={t.auth.loginTitle} intro={t.auth.loginIntro}>
      <GoogleButton next={target} />
      <form onSubmit={onSubmit} className="space-y-4">
        <div>
          <label className="field-label" htmlFor="l-email">{t.auth.email}</label>
          <input id="l-email" name="email" type="email" required autoComplete="email" className="field-input" />
        </div>
        <div>
          <div className="flex items-center justify-between">
            <label className="field-label" htmlFor="l-password">{t.auth.password}</label>
            <Link to="/account/forgot" className="text-xs font-semibold text-gold hover:underline">
              {t.auth.forgot}
            </Link>
          </div>
          <input id="l-password" name="password" type="password" required autoComplete="current-password" className="field-input" />
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <button type="submit" className="btn-base btn-gold w-full" disabled={busy}>
          {busy ? t.auth.signingIn : t.auth.signIn}
        </button>
      </form>
      <p className="mt-6 text-center text-sm text-muted-foreground">
        {t.auth.noAccount}{" "}
        <Link to="/account/register" search={{ next: target }} className="font-semibold text-gold hover:underline">
          {t.auth.createOne}
        </Link>
      </p>
    </AuthCard>
  );
}
