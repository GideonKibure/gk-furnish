import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { en, type Dictionary } from "./en";
import { sw } from "./sw";

export type Lang = "en" | "sw";

const DICTS: Record<Lang, Dictionary> = { en, sw };
const STORAGE_KEY = "gk-lang";

type LanguageContextValue = {
  lang: Lang;
  setLang: (lang: Lang) => void;
  t: Dictionary;
};

const LanguageContext = createContext<LanguageContextValue | null>(null);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>("en");

  // Read the stored preference after hydration to avoid an SSR mismatch.
  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (stored === "en" || stored === "sw") setLangState(stored);
    } catch {
      /* storage unavailable — keep the default */
    }
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    root.lang = lang === "sw" ? "sw" : "en";
    root.dataset["lang"] = lang;
    root.setAttribute("dir", "ltr");
  }, [lang]);

  const setLang = useCallback((next: Lang) => {
    setLangState(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* ignore */
    }
  }, []);

  const value = useMemo(() => ({ lang, setLang, t: DICTS[lang] }), [lang, setLang]);

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLang() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error("useLang must be used inside LanguageProvider");
  return ctx;
}

/** Pick the Swahili variant of a database field when available. */
export function localized(lang: Lang, base: string, swahili?: string | null) {
  return lang === "sw" && swahili ? swahili : base;
}
