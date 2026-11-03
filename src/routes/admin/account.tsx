import { createFileRoute } from "@tanstack/react-router";
import { Eye, EyeOff, KeyRound, ShieldCheck } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { AdminCard, AdminPageHeader } from "@/components/admin/admin-ui";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/admin/account")({
  head: () => ({ meta: [{ title: "Account & security — Admin" }, { name: "robots", content: "noindex" }] }),
  component: AdminAccountPage,
});

const MIN_LENGTH = 12;

function passwordChecks(password: string) {
  return [
    { ok: password.length >= MIN_LENGTH, label: `At least ${MIN_LENGTH} characters` },
    { ok: /[a-z]/.test(password) && /[A-Z]/.test(password), label: "Upper and lower case letters" },
    { ok: /\d/.test(password), label: "At least one number" },
    { ok: /[^A-Za-z0-9]/.test(password), label: "At least one symbol (for example ! ? # @)" },
  ];
}

function PasswordInput({
  id,
  name,
  label,
  autoComplete,
  value,
  onChange,
}: {
  id: string;
  name: string;
  label: string;
  autoComplete: string;
  value: string;
  onChange: (v: string) => void;
}) {
  const [shown, setShown] = useState(false);
  return (
    <div>
      <label className="field-label" htmlFor={id}>
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          name={name}
          type={shown ? "text" : "password"}
          autoComplete={autoComplete}
          required
          className="field-input pr-11"
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
        <button
          type="button"
          onClick={() => setShown((v) => !v)}
          aria-label={shown ? "Hide password" : "Show password"}
          className="absolute inset-y-0 right-0 grid w-11 place-items-center text-muted-foreground hover:text-navy"
        >
          {shown ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
    </div>
  );
}

function AdminAccountPage() {
  const [email, setEmail] = useState("");
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [signOutOthers, setSignOutOthers] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? ""));
  }, []);

  const checks = passwordChecks(next);
  const strong = checks.every((c) => c.ok);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    if (!email) {
      setError("Your session has expired. Sign in again.");
      return;
    }
    if (!strong) {
      setError("Choose a stronger password that meets every rule below.");
      return;
    }
    if (next !== confirm) {
      setError("The new passwords do not match.");
      return;
    }
    if (next === current) {
      setError("The new password must be different from the current one.");
      return;
    }

    setBusy(true);
    try {
      const { error: authErr } = await supabase.auth.signInWithPassword({ email, password: current });
      if (authErr) {
        setError("Your current password is incorrect.");
        return;
      }
      const { error: updateErr } = await supabase.auth.updateUser({ password: next });
      if (updateErr) {
        setError(updateErr.message || "Could not change the password.");
        return;
      }
      if (signOutOthers) await supabase.auth.signOut({ scope: "others" });
      setCurrent("");
      setNext("");
      setConfirm("");
      toast.success(signOutOthers ? "Password changed. Other devices have been signed out." : "Password changed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <AdminPageHeader title="Account & security" description="Change the password you use to sign in to the admin portal." />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <AdminCard hover={false}>
          <div className="mb-5 flex items-start gap-3 border-b border-border/70 pb-4">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-gold-soft text-navy">
              <KeyRound className="h-4 w-4" />
            </span>
            <div className="min-w-0">
              <h2 className="font-display text-xl text-navy">Change password</h2>
              <p className="mt-0.5 truncate text-sm text-muted-foreground">
                Signed in as <span className="font-semibold text-navy">{email || "…"}</span>
              </p>
            </div>
          </div>

          <form onSubmit={onSubmit} className="max-w-md space-y-4">
            <input type="email" name="username" autoComplete="username" value={email} readOnly hidden />
            <PasswordInput
              id="current-password"
              name="current-password"
              label="Current password"
              autoComplete="current-password"
              value={current}
              onChange={setCurrent}
            />
            <PasswordInput
              id="new-password"
              name="new-password"
              label="New password"
              autoComplete="new-password"
              value={next}
              onChange={setNext}
            />
            <ul className="space-y-1 text-xs">
              {checks.map((c) => (
                <li key={c.label} className={cn("flex items-center gap-1.5", c.ok ? "text-emerald-700" : "text-muted-foreground")}>
                  <span aria-hidden>{c.ok ? "✓" : "•"}</span>
                  {c.label}
                </li>
              ))}
            </ul>
            <PasswordInput
              id="confirm-password"
              name="confirm-password"
              label="Confirm new password"
              autoComplete="new-password"
              value={confirm}
              onChange={setConfirm}
            />
            {confirm && next !== confirm && <p className="text-xs text-destructive">The new passwords do not match.</p>}

            <label className="flex cursor-pointer items-start gap-2.5 text-sm text-navy">
              <input
                type="checkbox"
                className="mt-0.5 h-4 w-4 accent-[var(--gold)]"
                checked={signOutOthers}
                onChange={(e) => setSignOutOthers(e.target.checked)}
              />
              <span>Sign out of the admin portal on all other devices</span>
            </label>

            {error && <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}

            <button type="submit" className="btn-base btn-gold" disabled={busy || !current || !next || !confirm}>
              {busy ? "Saving…" : "Change password"}
            </button>
          </form>
        </AdminCard>

        <AdminCard hover={false} className="h-fit">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-gold" />
            <h2 className="font-semibold text-navy">Password tips</h2>
          </div>
          <ul className="mt-3 list-disc space-y-1.5 pl-5 text-sm text-muted-foreground">
            <li>Use a password you do not use on any other website.</li>
            <li>A phrase of four random words plus a number and symbol is strong and easy to type.</li>
            <li>Keep it in a password manager such as KeePassXC, not in a text file or chat.</li>
            <li>Change it straight away if you think someone else has seen it.</li>
          </ul>
        </AdminCard>
      </div>
    </div>
  );
}
