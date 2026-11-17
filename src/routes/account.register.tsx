import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { z } from "zod";
import { AuthCard, GoogleButton, postLoginPath } from "@/components/site/AuthCard";
import { PhoneField } from "@/components/site/PhoneField";
import { supabase } from "@/integrations/supabase/client";
import { useLang } from "@/i18n/LanguageProvider";
import { normaliseTzMobile } from "@/lib/phone-tz";

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
  const [phone, setPhone] = useState("");
  const [phoneError, setPhoneError] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const password = String(fd.get("password") ?? "");
    const storedPhone = phone.trim() ? normaliseTzMobile(phone) : "";
    if (phone.trim() && !storedPhone) {
      setPhoneError(t.validation.phoneInvalid);
      return;
    }
    if (password.length < 8) {
      setError(t.auth.passwordShort);
      return;
    }
    setBusy(true);
    setError("");
    setPhoneError("");
    const { data, error: err } = await supabase.auth.signUp({
      email: String(fd.get("email") ?? "").trim(),
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(target)}`,
        data: {
          full_name: String(fd.get("full_name") ?? "").trim(),
          ...(storedPhone ? { phone: storedPhone } : {}),
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
              <input id="r-name" name="full_name" required autoComplete="name" enterKeyHint="next" className="field-input" />
            </div>
            <PhoneField
              id="r-phone"
              label={t.auth.phone}
              enterKeyHint="next"
              value={phone}
              {...(phoneError ? { error: phoneError } : {})}
              onChange={setPhone}
              onBlur={() => {
                if (phone.trim() && !normaliseTzMobile(phone)) setPhoneError(t.validation.phoneInvalid);
              }}
            />
            <div>
              <label className="field-label" htmlFor="r-email">{t.auth.email}</label>
              <input id="r-email" name="email" type="email" inputMode="email" required autoComplete="email" enterKeyHint="next" className="field-input" />
            </div>
            <div>
              <label className="field-label" htmlFor="r-password">{t.auth.password}</label>
              <input id="r-password" name="password" type="password" required minLength={8} autoComplete="new-password" enterKeyHint="done" className="field-input" />
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
