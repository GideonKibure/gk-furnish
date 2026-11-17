/** Phone quick-add payload. Empty price is Ask for price (0). Status stays draft and off the shop. */
export function quickAddPayload(input: {
  name: string;
  nameSw: string;
  categoryId: string;
  price: string;
  stock: string;
}) {
  const name = input.name.trim();
  if (!name) return { ok: false as const, error: "Enter a name" };
  if (!input.categoryId) return { ok: false as const, error: "Choose a category" };
  const price = input.price.trim() === "" ? 0 : Number(input.price);
  if (!Number.isFinite(price) || price < 0)
    return { ok: false as const, error: "Enter a price, or leave it empty to ask for the price" };
  const stock = Number(input.stock);
  if (!Number.isInteger(stock) || stock < 0)
    return { ok: false as const, error: "Stock must be a whole number" };
  return {
    ok: true as const,
    data: {
      category_id: input.categoryId,
      name: name.slice(0, 200),
      name_sw: input.nameSw.trim().slice(0, 200),
      description: "",
      price,
      stock_quantity: stock,
      is_available: false,
      is_featured: false,
      features: [] as string[],
      available_colors: [] as string[],
      extended: {
        sku: "",
        status: "draft" as const,
        source_type: "in_house" as const,
        is_customisable: false,
        finish: "",
        finish_sw: "",
        care_info: "",
        care_info_sw: "",
        compare_at_price: null,
        discount_percent: null,
        free_delivery: false,
        free_delivery_region: null,
        free_delivery_regions: [],
        free_delivery_country: false,
        stock_display: "label" as const,
        available_region: null,
        item_condition: "new" as const,
      },
    },
  };
}

const DRAFT_KEY = "gk-product-draft";

export function readProductDraft() {
  if (typeof sessionStorage === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as {
      name?: unknown;
      nameSw?: unknown;
      categoryId?: unknown;
      price?: unknown;
      stock?: unknown;
    };
    return {
      name: typeof parsed.name === "string" ? parsed.name : "",
      nameSw: typeof parsed.nameSw === "string" ? parsed.nameSw : "",
      categoryId: typeof parsed.categoryId === "string" ? parsed.categoryId : "",
      price: typeof parsed.price === "string" ? parsed.price : "",
      stock: typeof parsed.stock === "string" ? parsed.stock : "0",
    };
  } catch {
    return null;
  }
}

export function writeProductDraft(draft: {
  name: string;
  nameSw: string;
  categoryId: string;
  price: string;
  stock: string;
}) {
  try {
    sessionStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
  } catch {
    /* A full session store still keeps what is on the form. */
  }
}

export function clearProductDraft() {
  try {
    sessionStorage.removeItem(DRAFT_KEY);
  } catch {
    /* Nothing stored to clear. */
  }
}
