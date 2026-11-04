import type { listPurchaseFormOptions, listPurchaseOrders } from "@/lib/ops/purchases.functions";

type Available<T> = Extract<T, { available: true }>;

export type PoRow = Available<Awaited<ReturnType<typeof listPurchaseOrders>>>["rows"][number];
export type PoOptions = Available<Awaited<ReturnType<typeof listPurchaseFormOptions>>>;

/** Prefill for a new PO coming from an order line or a supplier page. */
export type PoPrefill = { orderId?: string | undefined; orderItemId?: string | undefined; supplierId?: string | undefined };
