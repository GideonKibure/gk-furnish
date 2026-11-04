import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { z } from "zod";
import { AuthCard, GoogleButton, postLoginPath } from "@/components/site/AuthCard";
import { supabase } from "@/integrations/supabase/client";
import { useLang } from "@/i18n/LanguageProvider";

export const Route = createFileRoute("/account/register")({
  validateSearch: z.object({ next: z.string().optional() }),
  head: () => ({ meta: [{ title: "Create an account — GK furnish" }, { name: "robots", content: "noindex" }] }),
  component: RegisterPage,
});

function RegisterPage() {
  const { t } = useLang();
  const nav = useNavigate();
  const { next } = Route.useSearch();
  const target = postLoginPath(next, false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const password = String(fd.get("password") ?? "");
    if (password.length < 8) {
      setError(t.auth.passwordShort);
      return;
    }
    setBusy(true);
    setError("");
    const { data, error: err } = await supabase.auth.signUp({
      email: String(fd.get("email") ?? "").trim(),
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(target)}`,
        data: {
          full_name: String(fd.get("full_name") ?? "").trim(),
          phone: String(fd.get("phone") ?? "").trim(),
        },
      },
    });
    setBusy(false);
    if (err) {
      setError(err.message || t.auth.failed);
      return;
    }
    if (data.session) void nav({ href: target });
    else setSent(true);
  }

  return (
    <AuthCard title={t.auth.registerTitle} intro={t.auth.registerIntro}>
      {sent ? (
        <p className="rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-900">{t.auth.checkEmail}</p>
      ) : (
        <>
          <GoogleButton next={next} />
          <form onSubmit={onSubmit} className="space-y-4">
            <div>
              <label className="field-label" htmlFor="r-name">{t.auth.fullName}</label>
              <input id="r-name" name="full_name" required autoComplete="name" className="field-input" />
            </div>
            <div>
              <label className="field-label" htmlFor="r-phone">{t.auth.phone}</label>
              <input id="r-phone" name="phone" type="tel" autoComplete="tel" className="field-input" placeholder="+255…" />
            </div>
            <div>
              <label className="field-label" htmlFor="r-email">{t.auth.email}</label>
              <input id="r-email" name="email" type="email" required autoComplete="email" className="field-input" />
            </div>
            <div>
              <label className="field-label" htmlFor="r-password">{t.auth.password}</label>
              <input id="r-password" name="password" type="password" required minLength={8} autoComplete="new-password" className="field-input" />
              <p className="mt-1 text-xs text-muted-foreground">{t.auth.passwordHint}</p>
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <button type="submit" className="btn-base btn-gold w-full" disabled={busy}>
              {busy ? t.auth.registering : t.auth.register}
            </button>
          </form>
        </>
      )}
      <p className="mt-6 text-center text-sm text-muted-foreground">
        {t.auth.haveAccount}{" "}
        <Link to="/account/login" search={{ next }} className="font-semibold text-gold-ink hover:underline">
          {t.auth.signIn}
        </Link>
      </p>
    </AuthCard>
  );
}
