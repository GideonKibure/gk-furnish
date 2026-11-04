import { createFileRoute, Link } from "@tanstack/react-router";
import { CheckCircle2, Copy, Download, MapPinned, MessageCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { formatPrice, waLink } from "@/config/site";
import { useLang } from "@/i18n/LanguageProvider";
import { downloadInvoice } from "@/lib/invoice";

const S = z.object({
  ref: z.string().catch(""),
  item: z.string().optional(),
  qty: z.number().optional(),
  total: z.number().optional(),
  custom: z.boolean().optional(),
  paid: z.number().optional(),
  kind: z.string().optional(),
  pay: z.string().optional(),
  msg: z.string().optional(),
  name: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().optional(),
  color: z.string().optional(),
  size: z.string().optional(),
  material: z.string().optional(),
  needed: z.string().optional(),
  location: z.string().optional(),
  /** Private tracking token for guests (orders and custom requests). */
  track: z.string().uuid().optional().catch(undefined),
  delivery: z.enum(["pending", "confirmed", "free"]).optional().catch(undefined),
});

export const Route = createFileRoute("/order-success")({
  validateSearch: (s) => S.parse(s),
  head: () => ({
    meta: [
      { title: "Order received — GK furnish" },
      { name: "description", content: "Your GK furnish order was received." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Success,
});

function Success() {
  const s = Route.useSearch();
  const { t } = useLang();
  const [origin, setOrigin] = useState("");
  useEffect(() => setOrigin(window.location.origin), []);
  const trackPath = s.track ? `/track/${s.track}` : "";
  const deliveryLabel =
    s.delivery === "free" ? t.delivery.free : s.delivery === "pending" ? t.delivery.toBeConfirmed : undefined;

  function onDownloadInvoice() {
    downloadInvoice({
      ref: s.ref,
      customerName: s.name ?? "",
      phone: s.phone ?? "",
      email: s.email ?? "",
      item: s.item ?? "",
      qty: s.qty ?? 1,
      total: s.total ?? 0,
      paid: s.paid ?? 0,
      kind: s.kind ?? "",
      pay: s.pay ?? "",
      custom: Boolean(s.custom),
      color: s.color ?? "",
      size: s.size ?? "",
      material: s.material ?? "",
      neededBy: s.needed ?? "",
      location: s.location ?? "",
      ...(deliveryLabel ? { deliveryLabel } : {}),
    });
  }

  const rows: [string, string | undefined][] = [
    [t.success.product, s.item ? `${s.item}${s.qty && !s.item.includes("×") ? ` × ${s.qty}` : ""}` : undefined],
    [t.success.total, formatPrice(s.total) ?? undefined],
    [t.delivery.label, deliveryLabel],
    [t.success.paymentKind, s.kind === "advance" ? t.order.payAdvance : s.kind === "full" ? t.order.payFull : s.kind],
    [t.order.material, s.material],
    [t.order.neededBy, s.needed],
    [t.order.location, s.location],
  ];

  return (
    <div className="bg-sand">
      <div className="container-page section-y max-w-2xl">
        <div className="text-center">
          <span className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-success-soft">
            <CheckCircle2 className="h-9 w-9 text-success" />
          </span>
          <h1 className="display-lg mt-4">{s.custom ? t.success.customTitle : t.success.title}</h1>
          <p className="mt-2 text-muted-foreground">{s.custom ? t.success.customBody : t.success.body}</p>
        </div>

        <div className="kpi-card mt-6">
          <p className="text-sm text-muted-foreground">{t.success.reference}</p>
          <p className="font-display text-3xl font-bold text-navy">{s.ref}</p>
          <p className="mt-1 text-xs text-muted-foreground">{t.success.keepRef}</p>
          <dl className="mt-4 divide-y divide-border text-sm">
            {rows
              .filter(([, value]) => value)
              .map(([label, value]) => (
                <div key={label} className="flex justify-between gap-4 py-2">
                  <dt className="text-muted-foreground">{label}</dt>
                  <dd className="text-right font-medium text-navy">{value}</dd>
                </div>
              ))}
          </dl>
          {s.delivery === "pending" && <p className="mt-3 text-xs text-muted-foreground">{t.delivery.pendingNote}</p>}
          {!s.custom && <p className="mt-2 text-xs text-muted-foreground">{t.order.completionNote}</p>}
          {s.msg && <p className="mt-3 rounded-lg bg-sand p-3 text-sm text-navy/80">{s.msg}</p>}
        </div>

        {trackPath && (
          <div className="kpi-card mt-4">
            <p className="flex items-center gap-2 font-semibold text-navy">
              <MapPinned className="h-4 w-4" />
              {s.custom ? t.customExtra.trackRequest : t.track.open}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">{t.track.keepLink}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Link to="/track/$token" params={{ token: s.track! }} className="btn-base btn-navy btn-sm">
                {t.track.open}
              </Link>
              <button
                type="button"
                className="btn-base btn-outline-navy btn-sm"
                onClick={() =>
                  void navigator.clipboard?.writeText(`${origin}${trackPath}`).then(
                    () => toast.success(t.track.linkCopied),
                    () => undefined,
                  )
                }
              >
                <Copy className="h-4 w-4" />
                {t.track.copyLink}
              </button>
            </div>
          </div>
        )}

        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          <button type="button" onClick={onDownloadInvoice} className="btn-base btn-navy sm:col-span-2">
            <Download className="h-4 w-4" />
            {t.success.downloadInvoice}
          </button>
          <a href={waLink(`${t.whatsapp.orderPrefix} ${s.ref}.`)} target="_blank" rel="noreferrer" className="btn-base btn-gold">
            <MessageCircle className="h-4 w-4" />
            {t.success.contactUs}
          </a>
          <Link to="/products" className="btn-base btn-outline-navy">
            {t.success.browseMore}
          </Link>
        </div>
      </div>
    </div>
  );
}
