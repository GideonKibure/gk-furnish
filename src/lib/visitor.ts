const VISITOR_KEY = "gk-product-visitor";

/** Anonymous id kept in this browser. Used for product views and for visit time. */
export function visitorId() {
  try {
    const stored = window.localStorage.getItem(VISITOR_KEY);
    if (stored && /^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(stored)) return stored;
    const id = crypto.randomUUID();
    window.localStorage.setItem(VISITOR_KEY, id);
    return id;
  } catch {
    return crypto.randomUUID();
  }
}
