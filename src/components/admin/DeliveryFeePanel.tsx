import { useServerFn } from "@tanstack/react-start";
import { MapPin, Store, Truck } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { setOrderDeliveryFee } from "@/lib/admin.functions";
import { deliveryFeeLabel, deliveryFeeTone } from "@/lib/ops/status";
import { StatusPill, btn, adminInput, tzs } from "./admin-ui";

export type DeliveryOrder = {
  id: string;
  status: string;
  delivery_location: string;
  fulfilment_method?: string | null;
  region?: string | null;
  district?: string | null;
  address_line?: string | null;
  subtotal_amount?: number | null;
  delivery_fee?: number | null;
  delivery_fee_status?: string | null;
  total_amount: number;
};

export function DeliveryFeePanel({ order, onChanged }: { order: DeliveryOrder; onChanged: () => Promise<void> }) {
  const save = useServerFn(setOrderDeliveryFee);
  const tracked = order.delivery_fee_status !== undefined && order.delivery_fee_status !== null;
  const method = order.fulfilment_method ?? "delivery";
  const pending = tracked && method === "delivery" && order.delivery_fee_status === "pending";
  const [editing, setEditing] = useState(false);
  const [fee, setFee] = useState(order.delivery_fee != null ? String(Math.round(Number(order.delivery_fee))) : "");
  const [busy, setBusy] = useState(false);

  async function submit(free: boolean) {
    const value = free ? 0 : Number(fee);
    if (!free && (!fee.trim() || !Number.isFinite(value) || value < 0)) {
      toast.error("Enter the delivery fee in TSh (0 or more)");
      return;
    }
    setBusy(true);
    try {
      const r = await save({ data: { id: order.id, fee: value, free } });
      toast.success(free ? "Marked as free delivery" : `Delivery fee confirmed. New total ${tzs(r.total)}`);
      setEditing(false);
      await onChanged();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save the delivery fee");
    } finally {
      setBusy(false);
    }
  }

  const address = [order.address_line, order.district, order.region].filter(Boolean).join(", ");
  const subtotal = order.subtotal_amount != null ? Number(order.subtotal_amount) : null;

  return (
    <div className="rounded-xl border border-[#E5E5E5] bg-white p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="flex items-center gap-2 text-sm font-semibold text-navy">
          {method === "collection" ? <Store className="h-4 w-4 text-[#6B7280]" /> : <Truck className="h-4 w-4 text-[#6B7280]" />}
          {method === "collection" ? "Collection from workshop" : "Delivery"}
        </p>
        {tracked && (
          <StatusPill tone={deliveryFeeTone(order.delivery_fee_status, method)}>
            {deliveryFeeLabel(order.delivery_fee_status, method)}
          </StatusPill>
        )}
      </div>
      <p className="mt-2 flex items-start gap-2 text-sm text-[#374151]">
        <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-[#9CA3AF]" />
        <span>
          {address || order.delivery_location}
          {address && order.delivery_location && address !== order.delivery_location && (
            <span className="block text-xs text-[#6B7280]">{order.delivery_location}</span>
          )}
        </span>
      </p>

      {tracked && (
        <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1 border-t border-[#F0F0F0] pt-3 text-sm">
          {subtotal != null && (
            <>
              <dt className="text-[#6B7280]">Goods</dt>
              <dd className="text-right font-medium text-navy">{tzs(subtotal)}</dd>
            </>
          )}
          <dt className="text-[#6B7280]">Delivery fee</dt>
          <dd className="text-right font-medium text-navy">
            {method === "collection" || order.delivery_fee_status === "free"
              ? "Free"
              : order.delivery_fee_status === "pending"
                ? "To confirm"
                : tzs(Number(order.delivery_fee ?? 0))}
          </dd>
          <dt className="text-[#6B7280]">Order total</dt>
          <dd className="text-right font-semibold text-navy">{tzs(order.total_amount)}</dd>
        </dl>
      )}

      {tracked && method === "delivery" && order.status !== "cancelled" && (pending || editing) && (
        <div className="mt-3 space-y-2 rounded-lg bg-[#FFF7ED] p-3">
          <p className="text-xs text-[#9A3412]">
            {pending
              ? "Set the delivery fee so the customer sees the full total. Delivery cannot start until it is confirmed."
              : "Change the delivery fee. The total and balance are recalculated."}
          </p>
          <div className="flex flex-wrap gap-2">
            <input
              type="number"
              min={0}
              step={500}
              inputMode="numeric"
              value={fee}
              onChange={(e) => setFee(e.target.value)}
              placeholder="Fee in TSh"
              aria-label="Delivery fee"
              className={`${adminInput} w-36`}
            />
            <button type="button" className={btn("gold")} disabled={busy} onClick={() => void submit(false)}>
              {busy ? "Saving…" : "Confirm delivery fee"}
            </button>
            <button type="button" className={btn("outline")} disabled={busy} onClick={() => void submit(true)}>
              Free delivery
            </button>
            {editing && !pending && (
              <button type="button" className={btn("ghost")} onClick={() => setEditing(false)}>
                Cancel
              </button>
            )}
          </div>
        </div>
      )}
      {tracked && method === "delivery" && !pending && !editing && order.status !== "cancelled" && order.status !== "completed" && (
        <button type="button" className="mt-3 text-xs font-semibold text-[#B86A00] hover:underline" onClick={() => setEditing(true)}>
          Change delivery fee
        </button>
      )}
    </div>
  );
}
