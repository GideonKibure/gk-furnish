import { createFileRoute } from "@tanstack/react-router";
import { KeyRound, ShieldCheck } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { AdminCard, AdminPageHeader } from "@/components/admin/admin-ui";
import { PasswordChecklist, PasswordInput } from "@/components/admin/PasswordInput";
import { supabase } from "@/integrations/supabase/client";
import { getOwnerPasswordPolicy, setOwnerPasswordPolicy } from "@/lib/password-policy.functions";
import { adminPasswordChecks, passwordMeetsPolicy } from "@/lib/password-rules";

export const Route = createFileRoute("/admin/account")({
  head: () => ({ meta: [{ title: "Account & security — Admin" }, { name: "robots", content: "noindex" }] }),
  component: AdminAccountPage,
});

function AdminAccountPage() {
  const [email, setEmail] = useState("");
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [signOutOthers, setSignOutOthers] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [strongRule, setStrongRule] = useState(true);
  const loadPolicy = useServerFn(getOwnerPasswordPolicy);
  const savePolicy = useServerFn(setOwnerPasswordPolicy);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? ""));
    void loadPolicy().then((policy) => setStrongRule(policy.strong)).catch(() => setStrongRule(true));
  }, [loadPolicy]);

  const checks = adminPasswordChecks(next);
  const strong = passwordMeetsPolicy(next, strongRule);

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
      <AdminPageHeader title="Account & security" description="Change the password you use to sign in. The password you have now keeps working." />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <AdminCard hover={false}>
          <div className="mb-5 flex items-start gap-3 border-b border-border/70 pb-4">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-gold-soft text-[#B86A00]">
              <KeyRound className="h-4 w-4" />
            </span>
            <div className="min-w-0">
              <h2 className="text-base font-semibold text-navy">Change password</h2>
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
            <PasswordChecklist checks={checks} />
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
            <ShieldCheck className="h-4 w-4 text-[#B86A00]" />
            <h2 className="font-semibold text-navy">Password tips</h2>
          </div>
          <ul className="mt-3 list-disc space-y-1.5 pl-5 text-sm text-muted-foreground">
            <li>Use a password you do not use on any other website.</li>
            <li>A phrase of four random words plus a number and symbol is strong and easy to type.</li>
            <li>Keep it in a password manager such as KeePassXC, not in a text file or chat.</li>
            <li>Change it straight away if you think someone else has seen it.</li>
            <li>If a reset will not accept a new password, turn the strong-password switch off, save a password of at least 8 characters from the email link, then turn the switch on again.</li>
          </ul>
          <h3 className="mt-5 font-semibold text-navy">Two-step sign-in</h3>
          <p className="mt-2 text-sm text-muted-foreground">
            Turn on an authenticator app for gideonkibure@gmail.com in the Supabase dashboard: Authentication, then Multi-factor. Do that only after you have the authenticator app and a saved recovery code. This page does not switch it on, so you cannot be locked out from here.
          </p>
          <label className="mt-4 flex items-start gap-2 text-sm text-navy">
            <input
              type="checkbox"
              className="mt-0.5 h-4 w-4 accent-[var(--gold)]"
              checked={strongRule}
              onChange={(e) => {
                const nextValue = e.target.checked;
                setStrongRule(nextValue);
                void savePolicy({ data: { strong: nextValue } }).catch((err) => {
                  setStrongRule(!nextValue);
                  toast.error(err instanceof Error ? err.message : "Could not save the password rule");
                });
              }}
            />
            <span>Require a strong password the next time this account changes it. Your current password keeps working.</span>
          </label>
        </AdminCard>
      </div>
    </div>
  );
}
