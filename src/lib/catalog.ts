import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { isListed } from "@/lib/product-display";

export type Category = Database["public"]["Tables"]["categories"]["Row"];
export type ProductImage = Database["public"]["Tables"]["product_images"]["Row"];
export type Product = Database["public"]["Tables"]["products"]["Row"] & {
  categories: Pick<Category, "slug" | "name" | "name_sw"> | null;
  product_images?: ProductImage[] | null;
};

export const categoriesQuery = queryOptions({
  queryKey: ["categories"],
  queryFn: async () => {
    const { data, error } = await supabase.from("categories").select("*").order("sort_order");
    if (error) throw error;
    return data.filter((category) => category.is_active !== false);
  },
});

export type PublicReview = {
  id: string;
  product_id: string;
  rating: number;
  title: string | null;
  body: string | null;
  author_name: string;
  created_at: string;
};

/** Latest approved reviews, newest first. Empty before migration 0007. */
export function approvedReviewsQuery(productId?: string) {
  return queryOptions({
    queryKey: ["product-reviews", productId ?? "all"],
    queryFn: async (): Promise<PublicReview[]> => {
      let query = supabase
        .from("product_reviews")
        .select("id,product_id,rating,title,body,author_name,created_at")
        .eq("status", "approved")
        .order("created_at", { ascending: false })
        .limit(productId ? 50 : 6);
      if (productId) query = query.eq("product_id", productId);
      const { data, error } = await query;
      if (error) return [];
      return data ?? [];
    },
    staleTime: 5 * 60_000,
  });
}

export type RatingSummary = { product_id: string; rating_avg: number; rating_count: number };

/** Approved review averages per product. Empty before migration 0007. */
export const ratingSummaryQuery = queryOptions({
  queryKey: ["product-rating-summary"],
  queryFn: async (): Promise<Record<string, RatingSummary>> => {
    const { data, error } = await supabase.from("product_rating_summary").select("product_id,rating_avg,rating_count");
    if (error) return {};
    return Object.fromEntries(
      (data ?? []).map((row) => [
        row.product_id,
        { product_id: row.product_id, rating_avg: Number(row.rating_avg), rating_count: Number(row.rating_count) },
      ]),
    );
  },
  staleTime: 5 * 60_000,
});

export const productsQuery = queryOptions({
  queryKey: ["products", "with-angles"],
  queryFn: async () => {
    const { data, error } = await supabase
      .from("products")
      .select("*, categories(slug,name,name_sw), product_images(id,image_url,image_key,alt_text,sort_order)")
      .order("created_at", { ascending: false });
    if (error) throw error;
    return (data as Product[]).filter(isListed).map((p) => ({
      ...p,
      product_images: [...(p.product_images ?? [])].sort(
        (a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0),
      ),
    }));
  },
});
