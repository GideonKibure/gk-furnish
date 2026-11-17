import { useNavigate, useRouterState } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Search } from "lucide-react";
import { useEffect, useId, useMemo, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { localized, useLang } from "@/i18n/LanguageProvider";
import { trackEvent } from "@/lib/analytics";
import { categoriesQuery, productsQuery } from "@/lib/catalog";
import { rankSearch } from "@/lib/shop-search";
import { cn } from "@/lib/utils";

type Suggestion = { id: string; label: string; kind: "product" | "category"; slug: string };
type ShopQuery = { q?: string; cat?: string; min?: number; max?: number; avail?: boolean; sort?: "popular" | "new" | "low" | "high" | "name" };

function shopQuery(current: ShopQuery, query: string): ShopQuery {
  const next: ShopQuery = {};
  if (query) next.q = query;
  if (current.cat) next.cat = current.cat;
  if (typeof current.min === "number") next.min = current.min;
  if (typeof current.max === "number") next.max = current.max;
  if (current.avail) next.avail = true;
  if (current.sort) next.sort = current.sort;
  return next;
}

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
  const { t, lang } = useLang();
  const navigate = useNavigate();
  const shopSearch = useRouterState({
    select: (s) => (s.location.pathname.startsWith("/products") ? (s.location.search as ShopQuery) : {}),
  });
  const current = typeof shopSearch.q === "string" ? shopSearch.q : "";
  const [q, setQ] = useState(current);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const inputId = useId();
  const listId = useId();
  const tracked = useRef("");
  const { data: products = [] } = useQuery({ ...productsQuery, enabled: open });
  const { data: categories = [] } = useQuery({ ...categoriesQuery, enabled: open });

  useEffect(() => setQ(current), [current]);

  const suggestions = useMemo<Suggestion[]>(() => {
    const term = q.trim();
    if (!term) {
      return [...categories]
        .map((category) => ({
          category,
          count: products.filter((product) => product.category_id === category.id).length,
        }))
        .sort((a, b) => b.count - a.count || a.category.name.localeCompare(b.category.name))
        .slice(0, 6)
        .map(({ category }) => ({
          id: category.id,
          label: localized(lang, category.name, category.name_sw),
          kind: "category" as const,
          slug: category.slug,
        }));
    }
    return rankSearch(products, term, (product) => ({
      name: `${product.name} ${product.name_sw ?? ""}`,
      category: `${product.categories?.name ?? ""} ${product.categories?.name_sw ?? ""}`,
      description: product.short_description ?? "",
    }))
      .slice(0, 5)
      .map((product) => ({
        id: product.id,
        label: localized(lang, product.name, product.name_sw),
        kind: "product" as const,
        slug: product.slug,
      }));
  }, [categories, lang, products, q]);

  useEffect(() => setActive(-1), [q, open]);

  useEffect(() => {
    const query = q.trim();
    if (query === current.trim()) return;
    const timer = window.setTimeout(() => {
      if (query && tracked.current !== query) {
        tracked.current = query;
        trackEvent("search", { search_term: query.slice(0, 80) });
      }
      void navigate({ to: "/products", search: shopQuery(shopSearch, query), replace: true });
    }, 200);
    return () => window.clearTimeout(timer);
  }, [current, navigate, q, shopSearch]);

  function choose(item: Suggestion) {
    setOpen(false);
    onDone?.();
    if (item.kind === "product") {
      void navigate({ to: "/products/$slug", params: { slug: item.slug } });
      return;
    }
    void navigate({ to: "/categories/$slug", params: { slug: item.slug } });
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    const picked = active >= 0 ? suggestions[active] : undefined;
    if (picked) {
      choose(picked);
      return;
    }
    const query = q.trim();
    if (query && tracked.current !== query) {
      tracked.current = query;
      trackEvent("search", { search_term: query.slice(0, 80) });
    }
    void navigate({ to: "/products", search: shopQuery(shopSearch, query), replace: true });
    onDone?.();
  }

  function onKey(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setOpen(true);
      setActive((index) => (suggestions.length === 0 ? -1 : (index + 1) % suggestions.length));
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      setOpen(true);
      setActive((index) => (suggestions.length === 0 ? -1 : (index <= 0 ? suggestions.length - 1 : index - 1)));
      return;
    }
    if (event.key === "Escape") {
      setOpen(false);
      setActive(-1);
    }
  }

  const shown = open && suggestions.length > 0;

  return (
    <form role="search" onSubmit={submit} className={cn("relative", className)}>
      <label htmlFor={inputId} className="sr-only">
        {t.shell.searchLabel}
      </label>
      <input
        id={inputId}
        name="q"
        type="search"
        role="combobox"
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => {
          window.setTimeout(() => setOpen(false), 150);
        }}
        onKeyDown={onKey}
        placeholder={t.shell.searchPlaceholder}
        autoFocus={autoFocus}
        enterKeyHint="search"
        autoComplete="off"
        aria-label={t.shell.searchLabel}
        aria-expanded={shown}
        aria-controls={listId}
        aria-autocomplete="list"
        {...(active >= 0 ? { "aria-activedescendant": `${listId}-${active}` } : {})}
        className="h-11 w-full rounded-full border border-transparent bg-muted pl-4 pr-12 text-sm text-navy outline-none transition-colors placeholder:text-[#8a93a3] focus:border-gold-ink focus:bg-white"
      />
      <button
        type="submit"
        aria-label={t.shell.searchLabel}
        className="absolute right-0 top-0 grid h-11 w-11 place-items-center rounded-full text-navy"
      >
        <Search className="h-4 w-4" />
      </button>
      {shown && (
        <ul
          id={listId}
          role="listbox"
          aria-label={t.shop.suggestions}
          className="absolute left-0 right-0 top-12 z-40 overflow-hidden rounded-xl border border-[#E5E5E5] bg-white shadow-md"
        >
          {suggestions.map((item, index) => (
            <li key={item.id} role="presentation">
              <button
                id={`${listId}-${index}`}
                type="button"
                role="option"
                aria-selected={index === active}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => choose(item)}
                className={cn(
                  "block min-h-11 w-full px-3 text-left text-sm text-navy",
                  index === active ? "bg-sand" : "bg-white",
                )}
              >
                {item.label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </form>
  );
}
