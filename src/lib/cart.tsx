import { useQuery } from "@tanstack/react-query";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useAuthUser } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { productsQuery, type Product } from "@/lib/catalog";
import { selectedOptionPrice } from "@/lib/order-options";

export type CartLine = {
  product_id: string;
  quantity: number;
  material: string;
  size: string;
  color: string;
};

export type CartEntry = CartLine & {
  key: string;
  product: Product | null;
  unitPrice: number | null;
  lineTotal: number;
};

const STORAGE_KEY = "gk-cart";
const MAX_QTY = 100;

export function cartLineKey(line: Pick<CartLine, "product_id" | "material" | "size" | "color">) {
  return [line.product_id, line.material, line.size, line.color].join("|");
}

function readLocal(): CartLine[] {
  if (typeof window === "undefined") return [];
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "[]");
    if (!Array.isArray(parsed)) return [];
    return parsed.flatMap((row) => {
      if (!row || typeof row !== "object") return [];
      const r = row as Record<string, unknown>;
      if (typeof r["product_id"] !== "string") return [];
      const quantity = Math.min(MAX_QTY, Math.max(1, Number(r["quantity"]) || 1));
      return [{
        product_id: r["product_id"],
        quantity,
        material: typeof r["material"] === "string" ? r["material"] : "",
        size: typeof r["size"] === "string" ? r["size"] : "",
        color: typeof r["color"] === "string" ? r["color"] : "",
      }];
    });
  } catch {
    return [];
  }
}

function writeLocal(lines: CartLine[]) {
  if (typeof window === "undefined") return;
  if (lines.length) window.localStorage.setItem(STORAGE_KEY, JSON.stringify(lines));
  else window.localStorage.removeItem(STORAGE_KEY);
}

function mergeLines(base: CartLine[], extra: CartLine[]) {
  const map = new Map(base.map((l) => [cartLineKey(l), { ...l }]));
  for (const line of extra) {
    const key = cartLineKey(line);
    const current = map.get(key);
    if (current) current.quantity = Math.min(MAX_QTY, current.quantity + line.quantity);
    else map.set(key, { ...line });
  }
  return [...map.values()];
}

type CartContextValue = {
  entries: CartEntry[];
  count: number;
  subtotal: number;
  ready: boolean;
  add: (line: CartLine) => Promise<void>;
  setQuantity: (key: string, quantity: number) => Promise<void>;
  remove: (key: string) => Promise<void>;
  clear: () => Promise<void>;
};

const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
  const { user, ready: authReady } = useAuthUser();
  const { data: products = [] } = useQuery(productsQuery);
  const [lines, setLines] = useState<CartLine[]>([]);
  const [ready, setReady] = useState(false);
  const [remoteUserId, setRemoteUserId] = useState<string | null>(null);
  const userId = user?.id ?? null;
  const syncedFor = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    if (!authReady || syncedFor.current === userId) return;
    syncedFor.current = userId;
    setRemoteUserId(null);
    if (!userId) {
      setLines(readLocal());
      setReady(true);
      return;
    }
    (async () => {
      const { data, error } = await supabase
        .from("cart_items")
        .select("product_id,quantity,material,size,color")
        .eq("user_id", userId);
      if (error) {
        setLines(readLocal());
        setReady(true);
        return;
      }
      setRemoteUserId(userId);
      const saved: CartLine[] = (data ?? []).map((r) => ({ ...r }));
      const local = readLocal();
      const merged = mergeLines(saved, local);
      if (local.length) {
        await supabase.from("cart_items").upsert(
          merged.map((l) => ({ ...l, user_id: userId, updated_at: new Date().toISOString() })),
          { onConflict: "user_id,product_id,material,size,color" },
        );
        writeLocal([]);
      }
      setLines(merged);
      setReady(true);
    })();
  }, [authReady, userId]);

  const persist = useCallback(
    async (next: CartLine[], changed: CartLine[], removed: CartLine[]) => {
      setLines(next);
      if (!remoteUserId) {
        writeLocal(next);
        return;
      }
      if (changed.length) {
        await supabase.from("cart_items").upsert(
          changed.map((l) => ({ ...l, user_id: remoteUserId, updated_at: new Date().toISOString() })),
          { onConflict: "user_id,product_id,material,size,color" },
        );
      }
      for (const line of removed) {
        await supabase
          .from("cart_items")
          .delete()
          .eq("user_id", remoteUserId)
          .eq("product_id", line.product_id)
          .eq("material", line.material)
          .eq("size", line.size)
          .eq("color", line.color);
      }
    },
    [remoteUserId],
  );

  const value = useMemo<CartContextValue>(() => {
    const byId = new Map(products.map((p) => [p.id, p]));
    const entries: CartEntry[] = lines.map((line) => {
      const product = byId.get(line.product_id) ?? null;
      const unitPrice = product ? selectedOptionPrice(product, line.material, line.size) : null;
      return {
        ...line,
        key: cartLineKey(line),
        product,
        unitPrice,
        lineTotal: (unitPrice ?? 0) * line.quantity,
      };
    });
    return {
      entries,
      ready,
      count: lines.reduce((sum, l) => sum + l.quantity, 0),
      subtotal: entries.reduce((sum, e) => sum + e.lineTotal, 0),
      add: async (line) => {
        const next = mergeLines(lines, [line]);
        const changed = next.find((l) => cartLineKey(l) === cartLineKey(line));
        await persist(next, changed ? [changed] : [], []);
      },
      setQuantity: async (key, quantity) => {
        const qty = Math.min(MAX_QTY, Math.max(1, Math.round(quantity)));
        const next = lines.map((l) => (cartLineKey(l) === key ? { ...l, quantity: qty } : l));
        const changed = next.find((l) => cartLineKey(l) === key);
        await persist(next, changed ? [changed] : [], []);
      },
      remove: async (key) => {
        const gone = lines.filter((l) => cartLineKey(l) === key);
        await persist(lines.filter((l) => cartLineKey(l) !== key), [], gone);
      },
      clear: async () => {
        await persist([], [], lines);
      },
    };
  }, [lines, products, ready, persist]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used inside CartProvider");
  return ctx;
}
