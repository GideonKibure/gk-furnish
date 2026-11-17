import { useState, type FormEvent } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { AdminCard } from "@/components/admin/admin-ui";
import { formatAmount } from "@/config/site";
import { createChatOrder } from "@/lib/chat-order.functions";

type ProductOpt = { id: string; name: string; price: number | null };

type DraftLine = { kind: "product" | "custom"; productId: string; customName: string; unitPrice: string; quantity: string };

const emptyLine = (): DraftLine => ({ kind: "product", productId: "", customName: "", unitPrice: "", quantity: "1" });

/** Saves a chat order with checkout's advance rules, then shows a WhatsApp link. The message is not stored. */
export function ChatOrderForm({ products, onCreated }: { products: ProductOpt[]; onCreated: () => Promise<void> }) {
  const create = useServerFn(createChatOrder);
  const [busy, setBusy] = useState(false);
  const [method, setMethod] = useState<"collection" | "delivery">("collection");
  const [lines, setLines] = useState<DraftLine[]>([emptyLine()]);
  const [saved, setSaved] = useState<Awaited<ReturnType<typeof create>> | null>(null);

  function update(index: number, patch: Partial<DraftLine>) {
    setLines((current) => current.map((line, i) => (i === index ? { ...line, ...patch } : line)));
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const fd = new FormData(event.currentTarget);
    const payloadLines: Array<{ product_id?: string; custom_name?: string; quantity: number; unit_price?: number }> = [];
    for (const line of lines) {
      const quantity = Math.max(1, Number(line.quantity) || 1);
      if (line.kind === "product") {
        if (line.productId) payloadLines.push({ product_id: line.productId, quantity });
      } else if (line.customName.trim()) {
        const price = line.unitPrice.trim() ? Math.max(0, Math.round(Number(line.unitPrice))) : 0;
        payloadLines.push({ custom_name: line.customName.trim(), quantity, unit_price: price });
      }
    }
    if (!payloadLines.length) {
      toast.error("Add a product or a custom piece.");
      return;
    }
    setBusy(true);
    try {
      const location = String(fd.get("delivery_location") ?? "").trim();
      const result = await create({
        data: {
          customer_name: String(fd.get("customer_name") ?? "").trim(),
          phone: String(fd.get("phone") ?? "").trim(),
          fulfilment: method,
          ...(method === "delivery" ? { delivery_location: location } : {}),
          note: String(fd.get("note") ?? "").trim(),
          lines: payloadLines,
        },
      });
      setSaved(result);
      toast.success(`Order ${result.orderNumber} created`);
      await onCreated();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not create the order");
    } finally {
      setBusy(false);
    }
  }

  if (saved) {
    return (
      <AdminCard className="mb-5">
        <h2 className="text-base font-semibold text-navy">Order {saved.orderNumber} is saved</h2>
        <p className="mt-1 text-sm text-[#6B7280]">
          Advance {saved.advancePercent}% · {formatAmount(saved.advanceRequired)} now. The delivery fee, if any, is confirmed later.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <a className="btn-base btn-gold min-h-11" href={saved.whatsappUrl} target="_blank" rel="noreferrer">
            Send tracking link
          </a>
          <button type="button" className="btn-base btn-outline-navy min-h-11" onClick={() => setSaved(null)}>
            Create another
          </button>
        </div>
      </AdminCard>
    );
  }

  return (
    <AdminCard className="mb-5">
      <form onSubmit={onSubmit} className="grid gap-3">
        <div>
          <h2 className="text-base font-semibold text-navy">Create order from chat</h2>
          <p className="text-sm text-[#6B7280]">Uses the same advance and tracking link as the website. WhatsApp messages are not saved.</p>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <div>
            <label className="field-label">Customer name *</label>
            <input name="customer_name" required className="field-input" />
          </div>
          <div>
            <label className="field-label">Phone *</label>
            <input name="phone" required type="tel" className="field-input" placeholder="+255…" />
          </div>
          <div>
            <label className="field-label">Fulfilment</label>
            <select className="field-input" value={method} onChange={(event) => setMethod(event.target.value as "collection" | "delivery")}>
              <option value="collection">Collection (free)</option>
              <option value="delivery">Delivery</option>
            </select>
          </div>
          {method === "delivery" && (
            <div>
              <label className="field-label">Delivery location *</label>
              <input name="delivery_location" required className="field-input" />
            </div>
          )}
        </div>
        {lines.map((line, index) => (
          <div key={index} className="grid gap-3 rounded-lg border border-[#E5E7EB] p-3 md:grid-cols-2">
            <div>
              <label className="field-label">Item</label>
              <select
                className="field-input"
                value={line.kind}
                onChange={(event) => update(index, { kind: event.target.value as DraftLine["kind"] })}
              >
                <option value="product">Product from the shop</option>
                <option value="custom">Custom piece (free text)</option>
              </select>
            </div>
            <div>
              <label className="field-label">Quantity</label>
              <input className="field-input" inputMode="numeric" value={line.quantity} onChange={(event) => update(index, { quantity: event.target.value })} />
            </div>
            {line.kind === "product" ? (
              <div className="md:col-span-2">
                <label className="field-label">Product *</label>
                <select className="field-input" value={line.productId} onChange={(event) => update(index, { productId: event.target.value })}>
                  <option value="">Select product…</option>
                  {products.map((product) => (
                    <option key={product.id} value={product.id}>
                      {product.name}
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <>
                <div>
                  <label className="field-label">Description *</label>
                  <input className="field-input" value={line.customName} onChange={(event) => update(index, { customName: event.target.value })} />
                </div>
                <div>
                  <label className="field-label">Price (TZS, optional)</label>
                  <input className="field-input" inputMode="numeric" value={line.unitPrice} onChange={(event) => update(index, { unitPrice: event.target.value })} />
                </div>
              </>
            )}
            {lines.length > 1 && (
              <button type="button" className="text-left text-sm font-semibold text-navy underline" onClick={() => setLines((current) => current.filter((_, i) => i !== index))}>
                Remove line
              </button>
            )}
          </div>
        ))}
        <button type="button" className="text-left text-sm font-semibold text-navy underline" onClick={() => setLines((current) => [...current, emptyLine()])}>
          Add another line
        </button>
        <div>
          <label className="field-label">Note</label>
          <textarea name="note" className="field-input min-h-20" />
        </div>
        <button type="submit" className="btn-base btn-gold min-h-11 w-fit" disabled={busy}>
          {busy ? "Saving…" : "Save order"}
        </button>
      </form>
    </AdminCard>
  );
}
