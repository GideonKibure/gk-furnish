import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { AuthCard } from "@/components/site/AuthCard";
import { supabase } from "@/integrations/supabase/client";
import { useLang } from "@/i18n/LanguageProvider";

export const Route = createFileRoute("/account/forgot")({
  head: () => ({ meta: [{ title: "Reset password — GK furnish" }, { name: "robots", content: "noindex" }] }),
  component: ForgotPage,
});

function ForgotPage() {
  const { t } = useLang();
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const email = String(new FormData(e.currentTarget).get("email") ?? "").trim();
    setBusy(true);
    setError("");
    const { error: err } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/account/reset`,
    });
    setBusy(false);
    if (err) setError(err.message || t.auth.failed);
    else setSent(true);
  }

  return (
    <AuthCard title={t.auth.forgotTitle} intro={t.auth.forgotIntro}>
      {sent ? (
        <p className="rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-900">{t.auth.linkSent}</p>
      ) : (
        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label className="field-label" htmlFor="f-email">{t.auth.email}</label>
            <input id="f-email" name="email" type="email" required autoComplete="email" className="field-input" />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <button type="submit" className="btn-base btn-gold w-full" disabled={busy}>
            {t.auth.sendLink}
          </button>
        </form>
      )}
      <p className="mt-6 text-center text-sm">
        <Link to="/account/login" className="font-semibold text-gold-ink hover:underline">
          {t.auth.signIn}
        </Link>
      </p>
    </AuthCard>
  );
}
