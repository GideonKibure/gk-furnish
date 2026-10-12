import { createFileRoute, Link } from "@tanstack/react-router";
import { CheckCircle2, Download } from "lucide-react";
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
});

export const Route = createFileRoute("/order-success")({
  validateSearch: (s) => S.parse(s),
  head: () => ({
    meta: [
      { title: "Order received — GK furnish" },
      { name: "description", content: "Your GK furnish order was received." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { property: "og:title", content: "Order received — GK furnish" },
      { property: "og:description", content: "Thank you for ordering." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Success,
});

function Success() {
  const s = Route.useSearch();
  const { t } = useLang();

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
    });
  }

  return (
    <div className="container-page section-y max-w-xl text-center animate-in fade-in slide-in-from-bottom-4 duration-500">
      <CheckCircle2 className="mx-auto h-16 w-16 text-gold" />
      <h1 className="display-lg mt-4 text-navy">{s.custom ? t.success.customTitle : t.success.title}</h1>
      <p className="mt-3 text-muted-foreground">{s.custom ? t.success.customBody : t.success.body}</p>
      <div className="card-surface mt-8 p-6 text-left">
        <p className="text-sm text-muted-foreground">{t.success.reference}</p>
        <p className="font-display text-3xl font-bold text-navy">{s.ref}</p>
        <p className="mt-1 text-xs text-muted-foreground">{t.success.keepRef}</p>
        {s.name && <p className="mt-4 text-sm">Customer: <strong>{s.name}</strong></p>}
        {s.item && (
          <p className="mt-2 text-sm">
            {t.success.product}: <strong>{s.item}</strong> × {s.qty}
          </p>
        )}
        {formatPrice(s.total) && (
          <p className="text-sm">
            {t.success.total}: <strong>{formatPrice(s.total)}</strong>
          </p>
        )}
        {s.kind && (
          <p className="mt-2 text-sm">
            {t.success.paymentKind}:{" "}
            <strong>{s.kind === "advance" ? t.order.payAdvance : s.kind === "full" ? t.order.payFull : s.kind}</strong>
          </p>
        )}
        {s.material && (
          <p className="text-sm">
            {t.order.material}: <strong>{s.material}</strong>
          </p>
        )}
        {s.needed && (
          <p className="text-sm">
            {t.order.neededBy}: <strong>{s.needed}</strong>
          </p>
        )}
        <p className="mt-2 text-sm text-muted-foreground">{t.order.completionNote}</p>
        {s.pay && (
          <p className="text-sm capitalize">
            {t.success.paymentStatus}: <strong>{s.pay}</strong>
          </p>
        )}
        {s.msg && <p className="mt-3 rounded-lg bg-sand p-3 text-sm text-muted-foreground">{s.msg}</p>}
      </div>
      <div className="mt-8 grid gap-3 sm:grid-cols-2">
        <button type="button" onClick={onDownloadInvoice} className="btn-base btn-navy sm:col-span-2">
          <Download className="h-4 w-4" />
          {t.success.downloadInvoice}
        </button>
        <a
          href={waLink(`${t.whatsapp.orderPrefix} ${s.ref}.`)}
          target="_blank"
          rel="noreferrer"
          className="btn-base btn-gold"
        >
          {t.success.contactUs}
        </a>
        <Link to="/products" className="btn-base btn-outline-navy">
          {t.success.browseMore}
        </Link>
      </div>
    </div>
  );
}
