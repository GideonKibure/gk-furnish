import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { AuthCard } from "@/components/site/AuthCard";
import { supabase } from "@/integrations/supabase/client";
import { useLang } from "@/i18n/LanguageProvider";

export const Route = createFileRoute("/account/reset")({
  head: () => ({ meta: [{ title: "New password — GK furnish" }, { name: "robots", content: "noindex" }] }),
  component: ResetPage,
});

function ResetPage() {
  const { t } = useLang();
  const nav = useNavigate();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const code = new URLSearchParams(window.location.search).get("code");
    if (code) void supabase.auth.exchangeCodeForSession(code);
  }, []);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const password = String(new FormData(e.currentTarget).get("password") ?? "");
    if (password.length < 8) {
      setError(t.auth.passwordShort);
      return;
    }
    setBusy(true);
    setError("");
    const { error: err } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (err) {
      setError(err.message || t.auth.failed);
      return;
    }
    toast.success(t.auth.passwordSaved);
    void nav({ to: "/account" });
  }

  return (
    <AuthCard title={t.auth.resetTitle}>
      <form onSubmit={onSubmit} className="space-y-4">
        <div>
          <label className="field-label" htmlFor="n-password">{t.auth.newPassword}</label>
          <input id="n-password" name="password" type="password" required minLength={8} autoComplete="new-password" className="field-input" />
          <p className="mt-1 text-xs text-muted-foreground">{t.auth.passwordHint}</p>
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <button type="submit" className="btn-base btn-gold w-full" disabled={busy}>
          {t.auth.savePassword}
        </button>
      </form>
    </AuthCard>
  );
}
