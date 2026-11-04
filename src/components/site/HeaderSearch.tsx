import { useNavigate, useRouterState } from "@tanstack/react-router";
import { Search } from "lucide-react";
import { useEffect, useId, useState, type FormEvent } from "react";
import { useLang } from "@/i18n/LanguageProvider";
import { cn } from "@/lib/utils";

/** Search field that opens the shop filtered by the query. */
export function HeaderSearch({
  className,
  autoFocus = false,
  onDone,
}: {
  className?: string;
  autoFocus?: boolean;
  onDone?: () => void;
}) {
  const { t } = useLang();
  const navigate = useNavigate();
  const current = useRouterState({
    select: (s) =>
      s.location.pathname.startsWith("/products")
        ? String((s.location.search as { q?: string }).q ?? "")
        : "",
  });
  const [q, setQ] = useState(current);
  const inputId = useId();

  useEffect(() => setQ(current), [current]);

  function submit(e: FormEvent) {
    e.preventDefault();
    const query = q.trim();
    void navigate({ to: "/products", search: query ? { q: query } : {} });
    onDone?.();
  }

  return (
    <form role="search" onSubmit={submit} className={cn("relative", className)}>
      <label htmlFor={inputId} className="sr-only">
        {t.shell.searchLabel}
      </label>
      <input
        id={inputId}
        name="q"
        type="search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder={t.shell.searchPlaceholder}
        autoFocus={autoFocus}
        enterKeyHint="search"
        className="h-10 w-full rounded-full border border-transparent bg-muted pl-4 pr-11 text-sm text-navy outline-none transition-colors placeholder:text-[#8a93a3] focus:border-gold-ink focus:bg-white"
      />
      <button
        type="submit"
        aria-label={t.shell.searchLabel}
        className="absolute right-1 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-full text-navy transition-colors hover:bg-white"
      >
        <Search className="h-4 w-4" />
      </button>
    </form>
  );
}
