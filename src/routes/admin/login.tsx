import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { SITE } from "@/config/site";
import { supabase } from "@/integrations/supabase/client";
import { checkAdminSession } from "@/lib/admin.functions";

export const Route = createFileRoute("/admin/login")({
  head: () => ({
    meta: [{ title: "Admin login — GK furnish" }, { name: "robots", content: "noindex" }],
  }),
  component: AdminLoginPage,
});

function AdminLoginPage() {
  const nav = useNavigate();
  const check = useServerFn(checkAdminSession);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const email = String(fd.get("email") ?? "").trim();
    const password = String(fd.get("password") ?? "");
    setBusy(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      await check();
      nav({ to: "/admin" });
    } catch (err) {
      await supabase.auth.signOut();
      toast.error(err instanceof Error ? err.message : "Login failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="relative flex min-h-dvh items-center justify-center overflow-hidden bg-navy px-4 py-10">
      <div aria-hidden className="pointer-events-none absolute -left-20 top-10 h-72 w-72 rounded-full bg-gold/20 blur-3xl" />
      <div aria-hidden className="pointer-events-none absolute -right-16 bottom-0 h-80 w-80 rounded-full bg-gold/10 blur-3xl" />

      <form
        onSubmit={onSubmit}
        className="relative w-full max-w-md rounded-[1.75rem] border border-white/10 bg-background p-8 shadow-[var(--shadow-lift)] md:p-10"
      >
        <div className="mb-8 text-center">
          <span className="mx-auto grid h-16 w-16 place-items-center overflow-hidden rounded-full bg-white p-1.5 shadow-[0_0_28px_-8px_color-mix(in_oklab,var(--gold)_60%,transparent)] ring-1 ring-border">
            <img src="/brand/gk-furnish-logo.svg" alt={SITE.name} className="h-full w-full object-contain" />
          </span>
          <h1 className="mt-5 font-display text-3xl tracking-tight text-navy">Admin sign in</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Sign in to manage {SITE.name} orders, products and content.
          </p>
        </div>

        <label className="field-label" htmlFor="email">
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="username"
          className="field-input mb-4"
          placeholder="you@example.com"
        />

        <label className="field-label" htmlFor="password">
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          required
          autoComplete="current-password"
          className="field-input mb-6"
        />

        <button type="submit" className="btn-base btn-gold w-full" disabled={busy}>
          {busy ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </div>
  );
}
