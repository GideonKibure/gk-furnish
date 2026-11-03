import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { PasswordChecklist } from "@/components/admin/PasswordInput";
import { AuthCard, useRoleDestination } from "@/components/site/AuthCard";
import { supabase } from "@/integrations/supabase/client";
import { useLang } from "@/i18n/LanguageProvider";
import { adminPasswordChecks } from "@/lib/password-rules";

export const Route = createFileRoute("/account/reset")({
  head: () => ({ meta: [{ title: "New password — GK furnish" }, { name: "robots", content: "noindex" }] }),
  component: ResetPage,
});

function ResetPage() {
  const { t } = useLang();
  const nav = useNavigate();
  const destination = useRoleDestination();
  const [state, setState] = useState<"checking" | "ready" | "invalid">("checking");
  const [role, setRole] = useState({ isAdmin: false, path: "/account" });
  // Read during the first render: the Supabase client strips the recovery token from the URL once it starts.
  const [fromEmailLink] = useState(
    () =>
      typeof window !== "undefined" &&
      (/type=recovery/.test(window.location.hash) || new URLSearchParams(window.location.search).has("code")),
  );
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!fromEmailLink) {
      setState("invalid");
      return;
    }
    let done = false;
    const ready = () => {
      if (done) return;
      done = true;
      void destination(undefined).then((r) => {
        setRole(r);
        setState("ready");
      });
    };
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (session && (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN")) ready();
    });
    (async () => {
      const code = new URLSearchParams(window.location.search).get("code");
      if (code) await supabase.auth.exchangeCodeForSession(code);
      const { data } = await supabase.auth.getSession();
      if (data.session) ready();
    })();
    const timer = setTimeout(() => {
      if (!done) setState("invalid");
    }, 6000);
    return () => {
      sub.subscription.unsubscribe();
      clearTimeout(timer);
    };
  }, []);

  const checks = adminPasswordChecks(password, t.auth.passwordRules);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    if (role.isAdmin ? !checks.every((c) => c.ok) : password.length < 8) {
      setError(role.isAdmin ? t.auth.passwordWeak : t.auth.passwordShort);
      return;
    }
    if (password !== confirm) {
      setError(t.auth.passwordMismatch);
      return;
    }
    setBusy(true);
    try {
      const { error: err } = await supabase.auth.updateUser({ password });
      if (err) {
        setError(err.message || t.auth.failed);
        return;
      }
      await supabase.auth.signOut({ scope: "others" });
      toast.success(t.auth.passwordSaved);
      void nav({ href: role.path });
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthCard title={t.auth.resetTitle} intro={state === "ready" && role.isAdmin ? t.auth.adminPasswordIntro : undefined}>
      {state === "checking" && (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          {t.auth.resetChecking}
        </p>
      )}
      {state === "invalid" && (
        <div className="space-y-4">
          <p className="rounded-xl bg-destructive/10 px-4 py-3 text-sm text-destructive">{t.auth.resetInvalid}</p>
          <Link to="/account/forgot" className="btn-base btn-gold w-full">
            {t.auth.resetNewLink}
          </Link>
        </div>
      )}
      {state === "ready" && (
        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label className="field-label" htmlFor="n-password">{t.auth.newPassword}</label>
            <input
              id="n-password"
              name="password"
              type="password"
              required
              autoComplete="new-password"
              className="field-input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            {role.isAdmin ? (
              <div className="mt-2">
                <PasswordChecklist checks={checks} />
              </div>
            ) : (
              <p className="mt-1 text-xs text-muted-foreground">{t.auth.passwordHint}</p>
            )}
          </div>
          <div>
            <label className="field-label" htmlFor="n-confirm">{t.auth.confirmPassword}</label>
            <input
              id="n-confirm"
              name="confirm"
              type="password"
              required
              autoComplete="new-password"
              className="field-input"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
            />
            {confirm && password !== confirm && <p className="mt-1 text-xs text-destructive">{t.auth.passwordMismatch}</p>}
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <button type="submit" className="btn-base btn-gold w-full" disabled={busy || !password || !confirm}>
            {busy ? t.auth.saving : t.auth.savePassword}
          </button>
          <p className="text-center text-xs text-muted-foreground">{t.auth.otherDevices}</p>
        </form>
      )}
    </AuthCard>
  );
}
