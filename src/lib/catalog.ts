import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

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
    return data;
  },
});

export const productsQuery = queryOptions({
  queryKey: ["products", "with-angles"],
  queryFn: async () => {
    const { data, error } = await supabase
      .from("products")
      .select("*, categories(slug,name,name_sw), product_images(id,image_url,image_key,alt_text,sort_order)")
      .order("created_at", { ascending: false });
    if (error) throw error;
    return (data as Product[]).map((p) => ({
      ...p,
      product_images: [...(p.product_images ?? [])].sort(
        (a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0),
      ),
    }));
  },
});
