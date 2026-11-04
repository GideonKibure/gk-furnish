import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Eye, Heart } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useLang } from "@/i18n/LanguageProvider";
import { productsQuery, type Product } from "@/lib/catalog";
import { cn } from "@/lib/utils";

const VISITOR_KEY = "gk-product-visitor";

function visitorId() {
  try {
    const stored = window.localStorage.getItem(VISITOR_KEY);
    if (stored && /^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(stored)) return stored;
    const id = crypto.randomUUID();
    window.localStorage.setItem(VISITOR_KEY, id);
    return id;
  } catch {
    // Private browsing may disallow persistent storage; counts still work for this page.
    return crypto.randomUUID();
  }
}

function useEngagement(product: Product, trackView: boolean) {
  const queryClient = useQueryClient();
  const [liked, setLiked] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const [counts, setCounts] = useState({ views: product.view_count, likes: product.like_count });

  useEffect(() => {
    setCounts({ views: product.view_count, likes: product.like_count });
  }, [product.view_count, product.like_count]);

  useEffect(() => {
    try { setLiked(window.localStorage.getItem(`gk-liked-${product.id}`) === "true"); }
    catch { /* Storage unavailable */ }
  }, [product.id]);

  const update = (views: number, likes: number, isLiked: boolean) => {
    setCounts({ views, likes });
    setLiked(isLiked);
    try { window.localStorage.setItem(`gk-liked-${product.id}`, String(isLiked)); }
    catch { /* Storage unavailable */ }
    queryClient.setQueryData<Product[]>(productsQuery.queryKey, (list) =>
      list?.map((item) => item.id === product.id ? { ...item, view_count: views, like_count: likes } : item));
  };

  useEffect(() => {
    if (!trackView) return;
    let active = true;
    supabase.rpc("record_product_view", { _product_id: product.id, _visitor_id: visitorId() })
      .then(({ data, error: requestError }) => {
        if (!active) return;
        if (requestError || !data?.[0]) { setError(true); return; }
        update(data[0].view_count, data[0].like_count, data[0].liked);
      });
    return () => { active = false; };
  }, [product.id, trackView]);

  const toggleLike = async () => {
    if (busy) return;
    setBusy(true);
    setError(false);
    try {
      const { data, error: requestError } = await supabase.rpc("toggle_product_like", {
        _product_id: product.id, _visitor_id: visitorId(),
      });
      if (requestError || !data?.[0]) throw requestError ?? new Error("Product unavailable");
      update(data[0].view_count, data[0].like_count, data[0].liked);
    } catch { setError(true); }
    finally { setBusy(false); }
  };

  return { liked, busy, error, counts, toggleLike };
}

/** Round heart on product images. */
export function LikeButton({ product }: { product: Product }) {
  const { lang } = useLang();
  const { liked, busy, counts, toggleLike } = useEngagement(product, false);
  return (
    <button
      type="button"
      disabled={busy}
      onClick={() => void toggleLike()}
      aria-pressed={liked}
      aria-label={lang === "sw" ? (liked ? "Ondoa kupenda" : "Penda bidhaa") : (liked ? "Unlike product" : "Like product")}
      title={`${counts.likes.toLocaleString()} ${lang === "sw" ? "waliopenda" : "likes"}`}
      className={cn(
        "grid h-9 w-9 place-items-center rounded-full bg-white/95 shadow-sm transition-colors hover:bg-white",
        liked ? "text-danger" : "text-navy",
      )}
    >
      <Heart className={cn("h-4 w-4", liked && "fill-current")} />
    </button>
  );
}

export function ProductEngagement({ product, trackView = false, compact = false }: { product: Product; trackView?: boolean; compact?: boolean }) {
  const { lang } = useLang();
  const { liked, busy, error, counts, toggleLike } = useEngagement(product, trackView);

  return (
    <div className={cn("flex items-center gap-x-3 text-sm text-muted-foreground", compact ? "h-9 overflow-hidden" : "flex-wrap gap-y-1")}>
      <span className="inline-flex min-w-0 items-center gap-1.5" aria-label={`${counts.views} ${lang === "sw" ? "waliotazama" : "views"}`}>
        <Eye className="h-4 w-4 shrink-0" aria-hidden="true" />
        <span className="truncate">{counts.views.toLocaleString()} {lang === "sw" ? "waliotazama" : "views"}</span>
      </span>
      <button type="button" disabled={busy} onClick={() => void toggleLike()}
        aria-label={lang === "sw" ? (liked ? "Ondoa kupenda" : "Penda bidhaa") : (liked ? "Unlike product" : "Like product")}
        aria-pressed={liked}
        className={cn("inline-flex h-9 items-center gap-1.5 rounded-lg px-2 transition-colors hover:bg-muted", liked ? "text-danger" : "text-muted-foreground")}>
        <Heart className={cn("h-4 w-4", liked && "fill-current")} aria-hidden="true" />
        {counts.likes.toLocaleString()} {lang === "sw" ? "waliopenda" : "likes"}
      </button>
      {error && <span role="status" className="text-danger">{lang === "sw" ? "Jaribu tena" : "Please try again"}</span>}
    </div>
  );
}
