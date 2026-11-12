import { useRouterState } from "@tanstack/react-router";
import { Eye, EyeOff, X } from "lucide-react";
import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import { toast } from "sonner";
import { useAuthUser } from "@/hooks/use-auth";
import {
  AuthPopupContext,
  type AuthMode,
  type AuthReason,
  type OpenAuthOptions,
} from "@/hooks/use-auth-popup";
import { supabase } from "@/integrations/supabase/client";
import { useLang } from "@/i18n/LanguageProvider";
import { visitorId } from "@/lib/visitor";
import { cn } from "@/lib/utils";
import { BrandLogo } from "./BrandLogo";
import { GoogleButton } from "./AuthCard";

const AUTO_DELAY_MS = 30_000;
const DISMISS_FOR_MS = 7 * 24 * 60 * 60 * 1000;
const ENTERED_KEY = "gk-auth-entered";
const SHOWN_KEY = "gk-auth-shown";
const DISMISS_KEY = "gk-auth-dismissed-at";
const PENDING_LIKE_KEY = "gk-pending-like";

type Mode = AuthMode;
type Reason = AuthReason;
type OpenOptions = OpenAuthOptions;

function readStorage(store: Storage, key: string) {
  try {
    return store.getItem(key);
  } catch {
    return null;
  }
}

function writeStorage(store: Storage, key: string, value: string) {
  try {
    store.setItem(key, value);
  } catch {
    /* Storage unavailable */
  }
}

function removeStorage(store: Storage, key: string) {
  try {
    store.removeItem(key);
  } catch {
    /* Storage unavailable */
  }
}

function dismissedRecently() {
  const stamp = Number(readStorage(localStorage, DISMISS_KEY));
  return Number.isFinite(stamp) && stamp > 0 && Date.now() - stamp < DISMISS_FOR_MS;
}

function blockedPath(pathname: string) {
  return (
    pathname.startsWith("/checkout") ||
    pathname.startsWith("/order-success") ||
    pathname.startsWith("/account/login") ||
    pathname.startsWith("/account/register") ||
    pathname.startsWith("/account/forgot") ||
    pathname.startsWith("/account/reset")
  );
}

function clearEligibility() {
  removeStorage(sessionStorage, ENTERED_KEY);
  removeStorage(sessionStorage, SHOWN_KEY);
  removeStorage(localStorage, DISMISS_KEY);
}

/** One sign-in popup for the shop, including the delayed first-visit prompt. */
export function AuthPopupProvider({ children }: { children: ReactNode }) {
  const { user, ready } = useAuthUser();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<Mode>("signup");
  const [reason, setReason] = useState<Reason>("auto");
  const reasonRef = useRef<Reason>("auto");
  const dismissRef = useRef<(() => void) | null>(null);
  reasonRef.current = reason;

  const openPopup = useCallback((options?: OpenOptions) => {
    const nextReason = options?.reason ?? "account";
    setReason(nextReason);
    setMode(
      options?.mode ?? (nextReason === "favourite" || nextReason === "auto" ? "signup" : "signin"),
    );
    dismissRef.current = options?.onDismiss ?? null;
    if (options?.productId) writeStorage(sessionStorage, PENDING_LIKE_KEY, options.productId);
    else removeStorage(sessionStorage, PENDING_LIKE_KEY);
    writeStorage(sessionStorage, SHOWN_KEY, "1");
    setOpen(true);
  }, []);

  const close = useCallback(() => {
    const dismiss = dismissRef.current;
    dismissRef.current = null;
    if (reasonRef.current === "auto") {
      writeStorage(sessionStorage, SHOWN_KEY, "1");
      writeStorage(localStorage, DISMISS_KEY, String(Date.now()));
    }
    removeStorage(sessionStorage, PENDING_LIKE_KEY);
    setOpen(false);
    dismiss?.();
  }, []);

  useEffect(() => {
    if (!ready || user || open) return;
    if (blockedPath(pathname)) return;
    if (readStorage(sessionStorage, SHOWN_KEY) === "1" || dismissedRecently()) return;

    let entered = Number(readStorage(sessionStorage, ENTERED_KEY));
    if (!Number.isFinite(entered) || entered <= 0) {
      entered = Date.now();
      writeStorage(sessionStorage, ENTERED_KEY, String(entered));
    }
    const wait = Math.max(0, AUTO_DELAY_MS - (Date.now() - entered));
    const timer = window.setTimeout(() => {
      setReason("auto");
      setMode("signup");
      writeStorage(sessionStorage, SHOWN_KEY, "1");
      setOpen(true);
    }, wait);
    return () => window.clearTimeout(timer);
  }, [ready, user, open, pathname]);

  useEffect(() => {
    if (!user) return;
    const productId = readStorage(sessionStorage, PENDING_LIKE_KEY);
    if (!productId) return;
    removeStorage(sessionStorage, PENDING_LIKE_KEY);
    clearEligibility();
    setOpen(false);
    void supabase
      .rpc("toggle_product_like", { _product_id: productId, _visitor_id: visitorId() })
      .then(({ data }) => {
        const row = data?.[0];
        if (!row) return;
        window.dispatchEvent(
          new CustomEvent("gk-like-synced", {
            detail: {
              productId,
              view_count: row.view_count,
              like_count: row.like_count,
              liked: row.liked,
            },
          }),
        );
      });
  }, [user]);

  return (
    <AuthPopupContext.Provider value={{ open: openPopup }}>
      {children}
      {open && (
        <AuthDialog
          mode={mode}
          reason={reason}
          next={pathname}
          onMode={setMode}
          onClose={close}
          onAuthenticated={() => {
            dismissRef.current = null;
            clearEligibility();
            setOpen(false);
          }}
        />
      )}
    </AuthPopupContext.Provider>
  );
}

function AuthDialog({
  mode,
  reason,
  next,
  onMode,
  onClose,
  onAuthenticated,
}: {
  mode: Mode;
  reason: Reason;
  next: string;
  onMode: (mode: Mode) => void;
  onClose: () => void;
  onAuthenticated: () => void;
}) {
  const { t } = useLang();
  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const closing = useRef(false);
  const [leaving, setLeaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  function beginClose() {
    if (closing.current) return;
    closing.current = true;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      onClose();
      return;
    }
    setLeaving(true);
    window.setTimeout(onClose, 180);
  }

  const beginCloseRef = useRef(beginClose);
  beginCloseRef.current = beginClose;

  const intro =
    reason === "favourite"
      ? t.auth.favouriteHint
      : reason === "checkout"
        ? t.auth.checkoutHint
        : reason === "account"
          ? t.auth.accountHint
          : t.auth.gateBody;
  const title =
    mode === "forgot"
      ? t.auth.forgotTitle
      : mode === "signin"
        ? t.auth.loginTitle
        : t.auth.registerTitle;

  useEffect(() => {
    setError("");
    setNotice("");
    setBusy(false);
    setShowPassword(false);
  }, [mode]);

  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const focusable = dialogRef.current?.querySelector<HTMLElement>("input");
    focusable?.focus();
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        beginCloseRef.current();
        return;
      }
      if (event.key !== "Tab" || !dialogRef.current) return;
      const nodes = [
        ...dialogRef.current.querySelectorAll<HTMLElement>(
          "button, input, a, [href], [tabindex]:not([tabindex='-1'])",
        ),
      ].filter((node) => !node.hasAttribute("disabled"));
      const first = nodes[0];
      const last = nodes[nodes.length - 1];
      if (!first || !last) return;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      document.removeEventListener("keydown", onKey);
    };
  }, [mode]);

  async function signIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setBusy(true);
    setError("");
    const { error: err } = await supabase.auth.signInWithPassword({
      email: String(data.get("email") ?? "").trim(),
      password: String(data.get("password") ?? ""),
    });
    setBusy(false);
    if (err) {
      setError(err.message.toLowerCase().includes("invalid") ? t.auth.invalid : err.message);
      return;
    }
    toast.success(t.auth.loginTitle);
    onAuthenticated();
  }

  async function signUp(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const password = String(data.get("password") ?? "");
    if (password.length < 8) {
      setError(t.auth.passwordShort);
      return;
    }
    setBusy(true);
    setError("");
    const { data: created, error: err } = await supabase.auth.signUp({
      email: String(data.get("email") ?? "").trim(),
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next || "/")}`,
        data: {
          full_name: String(data.get("full_name") ?? "").trim(),
          phone: String(data.get("phone") ?? "").trim(),
        },
      },
    });
    setBusy(false);
    if (err) {
      setError(err.message || t.auth.failed);
      return;
    }
    if (created.session) {
      toast.success(t.auth.registerTitle);
      onAuthenticated();
      return;
    }
    setNotice(t.auth.checkEmail);
  }

  async function reset(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const email = String(new FormData(event.currentTarget).get("email") ?? "").trim();
    setBusy(true);
    setError("");
    const { error: err } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/account/reset`,
    });
    setBusy(false);
    if (err) {
      setError(err.message || t.auth.failed);
      return;
    }
    setNotice(t.auth.linkSent);
    toast.success(t.auth.linkSent);
  }

  return (
    <div
      data-leaving={leaving ? "true" : "false"}
      className="auth-prompt-backdrop fixed inset-0 z-[80] flex items-center justify-center bg-navy/45 p-4 backdrop-blur-md"
    >
      <button
        type="button"
        className="absolute inset-0 cursor-default"
        aria-label={t.auth.later}
        onClick={beginClose}
      />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        data-leaving={leaving ? "true" : "false"}
        className="auth-prompt-card relative z-[1] max-h-[calc(100dvh-2rem)] w-full max-w-md overflow-y-auto rounded-3xl border border-white/70 bg-white/95 p-5 shadow-2xl backdrop-blur-xl sm:p-6"
      >
        <div className="absolute inset-x-0 top-0 h-1 rounded-t-3xl bg-gold" />
        <button
          type="button"
          onClick={beginClose}
          aria-label={t.auth.later}
          className="absolute right-3 top-3 grid h-9 w-9 place-items-center rounded-full text-navy hover:bg-[#E5E5E5]"
        >
          <X className="h-4 w-4" />
        </button>
        <BrandLogo showWordmark={false} markClassName="h-16" className="mb-3" />
        <h2 id={titleId} className="text-xl font-bold text-navy">
          {title}
        </h2>
        <p className="mt-1 text-sm leading-relaxed text-navy/70">
          {mode === "forgot" ? t.auth.forgotIntro : intro}
        </p>

        {mode !== "forgot" && (
          <div className="mt-4 grid grid-cols-2 gap-1 rounded-full bg-[#E5E5E5] p-1" role="tablist">
            <button
              type="button"
              role="tab"
              aria-selected={mode === "signin"}
              className={cn(
                "rounded-full px-3 py-2 text-sm font-semibold",
                mode === "signin" ? "auth-wave bg-navy text-white" : "text-navy",
              )}
              onClick={() => onMode("signin")}
            >
              {t.auth.signIn}
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={mode === "signup"}
              className={cn(
                "rounded-full px-3 py-2 text-sm font-semibold",
                mode === "signup" ? "auth-wave bg-navy text-white" : "text-navy",
              )}
              onClick={() => onMode("signup")}
            >
              {t.auth.createOne}
            </button>
          </div>
        )}

        {notice ? (
          <p
            className="mt-4 rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-900"
            role="status"
          >
            {notice}
          </p>
        ) : mode === "forgot" ? (
          <form onSubmit={(event) => void reset(event)} className="mt-4 space-y-4">
            <Field label={t.auth.email} name="email" type="email" autoComplete="email" />
            {error && (
              <p className="text-sm text-destructive" role="alert">
                {error}
              </p>
            )}
            <button type="submit" className="btn-base btn-gold w-full" disabled={busy}>
              {t.auth.sendLink}
            </button>
          </form>
        ) : mode === "signin" ? (
          <form onSubmit={(event) => void signIn(event)} className="mt-4 space-y-4">
            <GoogleButton next={next} />
            <Field label={t.auth.email} name="email" type="email" autoComplete="email" />
            <PasswordField
              label={t.auth.password}
              autoComplete="current-password"
              show={showPassword}
              onToggle={() => setShowPassword((value) => !value)}
              showLabel={t.auth.showPassword}
              hideLabel={t.auth.hidePassword}
            />
            <button
              type="button"
              className="text-xs font-semibold text-gold-ink hover:underline"
              onClick={() => onMode("forgot")}
            >
              {t.auth.forgot}
            </button>
            {error && (
              <p className="text-sm text-destructive" role="alert">
                {error}
              </p>
            )}
            <button type="submit" className="btn-base btn-gold w-full" disabled={busy}>
              {busy ? t.auth.signingIn : t.auth.signIn}
            </button>
          </form>
        ) : (
          <form onSubmit={(event) => void signUp(event)} className="mt-4 space-y-4">
            <GoogleButton next={next} />
            <Field label={t.auth.fullName} name="full_name" autoComplete="name" />
            <Field
              label={t.auth.phone}
              name="phone"
              type="tel"
              autoComplete="tel"
              required={false}
            />
            <Field label={t.auth.email} name="email" type="email" autoComplete="email" />
            <PasswordField
              label={t.auth.password}
              autoComplete="new-password"
              minLength={8}
              show={showPassword}
              onToggle={() => setShowPassword((value) => !value)}
              showLabel={t.auth.showPassword}
              hideLabel={t.auth.hidePassword}
            />
            <p className="text-xs text-muted-foreground">{t.auth.passwordHint}</p>
            {error && (
              <p className="text-sm text-destructive" role="alert">
                {error}
              </p>
            )}
            <button type="submit" className="btn-base btn-gold w-full" disabled={busy}>
              {busy ? t.auth.registering : t.auth.register}
            </button>
          </form>
        )}

        <button
          type="button"
          onClick={beginClose}
          className="mt-4 w-full text-center text-sm font-semibold text-navy/70 hover:text-navy"
        >
          {t.auth.later}
        </button>
      </div>
    </div>
  );
}

function Field({
  label,
  name,
  type = "text",
  autoComplete,
  required = true,
}: {
  label: string;
  name: string;
  type?: string;
  autoComplete: string;
  required?: boolean;
}) {
  const id = useId();
  return (
    <div>
      <label className="field-label" htmlFor={id}>
        {label}
      </label>
      <input
        id={id}
        name={name}
        type={type}
        required={required}
        autoComplete={autoComplete}
        className="field-input"
      />
    </div>
  );
}

function PasswordField({
  label,
  autoComplete,
  minLength,
  show,
  onToggle,
  showLabel,
  hideLabel,
}: {
  label: string;
  autoComplete: string;
  minLength?: number;
  show: boolean;
  onToggle: () => void;
  showLabel: string;
  hideLabel: string;
}) {
  const id = useId();
  return (
    <div>
      <label className="field-label" htmlFor={id}>
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          name="password"
          type={show ? "text" : "password"}
          required
          autoComplete={autoComplete}
          {...(minLength ? { minLength } : {})}
          className="field-input pr-11"
        />
        <button
          type="button"
          onClick={onToggle}
          aria-label={show ? hideLabel : showLabel}
          className="absolute right-1 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-full text-navy hover:bg-[#E5E5E5]"
        >
          {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
    </div>
  );
}
