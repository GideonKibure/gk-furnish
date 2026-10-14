import { formatPrice, SITE } from "@/config/site";

export type InvoiceData = {
  ref: string;
  customerName?: string;
  phone?: string;
  email?: string;
  item?: string;
  qty?: number;
  total?: number;
  paid?: number;
  kind?: string;
  pay?: string;
  custom?: boolean;
  color?: string;
  size?: string;
  material?: string;
  neededBy?: string;
  location?: string;
  date?: string;
};

/** Build a printable HTML invoice and trigger browser print / PDF save. */
export function downloadInvoice(data: InvoiceData) {
  const issued = data.date ?? new Date().toLocaleString();
  const total = formatPrice(data.total) ?? "—";
  const qty = data.qty ?? 1;
  const unit =
    data.total && data.qty
      ? formatPrice(Math.round(data.total / Math.max(1, data.qty)))
      : null;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Invoice ${escapeHtml(data.ref)} — ${escapeHtml(SITE.name)}</title>
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700&display=swap" />
  <style>
    :root { color-scheme: light; }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: "Outfit", "Segoe UI", system-ui, sans-serif;
      color: #1a1f2e;
      background: #fff;
      padding: 32px;
    }
    .sheet { max-width: 720px; margin: 0 auto; }
    .head { display: flex; justify-content: space-between; gap: 24px; align-items: flex-start; border-bottom: 2px solid #14213d; padding-bottom: 20px; }
    .brand { display: flex; gap: 12px; align-items: center; }
    .brand img { height: 56px; width: auto; }
    .brand h1 { margin: 0; font-size: 1.35rem; letter-spacing: -0.02em; }
    .brand p { margin: 4px 0 0; color: #5b6475; font-size: 0.85rem; }
    .meta { text-align: right; font-size: 0.9rem; }
    .meta strong { display: block; font-size: 1.1rem; color: #14213d; }
    h2 { margin: 28px 0 12px; font-size: 0.75rem; letter-spacing: 0.14em; text-transform: uppercase; color: #8a7350; }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
    .card { border: 1px solid #e5e7eb; border-radius: 12px; padding: 14px 16px; background: #fafafa; }
    .card p { margin: 0 0 6px; font-size: 0.92rem; }
    .muted { color: #5b6475; }
    table { width: 100%; border-collapse: collapse; margin-top: 8px; }
    th, td { padding: 12px 10px; text-align: left; border-bottom: 1px solid #e5e7eb; font-size: 0.95rem; }
    th { background: #14213d; color: #fff; font-weight: 600; }
    td.num, th.num { text-align: right; }
    .totals { margin-top: 16px; margin-left: auto; width: min(280px, 100%); }
    .totals div { display: flex; justify-content: space-between; padding: 6px 0; font-size: 0.95rem; }
    .totals .grand { border-top: 2px solid #14213d; margin-top: 8px; padding-top: 10px; font-weight: 700; font-size: 1.05rem; }
    .foot { margin-top: 36px; padding-top: 16px; border-top: 1px dashed #d1d5db; font-size: 0.8rem; color: #5b6475; }
    @media print {
      body { padding: 0; }
      .noprint { display: none !important; }
    }
  </style>
</head>
<body>
  <div class="sheet">
    <div class="noprint" style="margin-bottom:16px">
      <button onclick="window.print()" style="background:#fca311;border:0;border-radius:999px;padding:10px 18px;font-weight:700;cursor:pointer">
        Print / Save as PDF
      </button>
    </div>
    <div class="head">
      <div class="brand">
        <img src="/brand/gk-furnish-logo.svg" alt="${escapeHtml(SITE.name)}" />
        <div>
          <h1>${escapeHtml(SITE.name)}</h1>
          <p>${escapeHtml(SITE.tagline)}</p>
          <p>${escapeHtml(SITE.location)} · ${escapeHtml(SITE.phoneDisplay)}</p>
          <p>${escapeHtml(SITE.email)}</p>
        </div>
      </div>
      <div class="meta">
        <span class="muted">Invoice</span>
        <strong>${escapeHtml(data.ref)}</strong>
        <p class="muted" style="margin-top:8px">Issued ${escapeHtml(issued)}</p>
      </div>
    </div>

    <h2>Bill to</h2>
    <div class="grid">
      <div class="card">
        <p><strong>${escapeHtml(data.customerName || "Customer")}</strong></p>
        ${data.phone ? `<p class="muted">${escapeHtml(data.phone)}</p>` : ""}
        ${data.email ? `<p class="muted">${escapeHtml(data.email)}</p>` : ""}
        ${data.location ? `<p class="muted">Delivery: ${escapeHtml(data.location)}</p>` : ""}
      </div>
      <div class="card">
        <p><span class="muted">Payment type:</span> ${escapeHtml(data.kind || "—")}</p>
        <p><span class="muted">Payment status:</span> ${escapeHtml(data.pay || "—")}</p>
        ${data.color ? `<p><span class="muted">Colour:</span> ${escapeHtml(data.color)}</p>` : ""}
        ${data.size ? `<p><span class="muted">Size:</span> ${escapeHtml(data.size)}</p>` : ""}
        ${data.material ? `<p><span class="muted">Material:</span> ${escapeHtml(data.material)}</p>` : ""}
        ${data.neededBy ? `<p><span class="muted">Needed by:</span> ${escapeHtml(data.neededBy)}</p>` : ""}
      </div>
    </div>

    <h2>Items</h2>
    <table>
      <thead>
        <tr>
          <th>Description</th>
          <th class="num">Qty</th>
          <th class="num">Unit</th>
          <th class="num">Amount</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>${escapeHtml(data.item || (data.custom ? "Custom furniture request" : "Furniture order"))}</td>
          <td class="num">${qty}</td>
          <td class="num">${escapeHtml(unit ?? "—")}</td>
          <td class="num">${escapeHtml(total)}</td>
        </tr>
      </tbody>
    </table>

    <div class="totals">
      <div><span class="muted">Subtotal</span><span>${escapeHtml(total)}</span></div>
      <div class="grand"><span>Order total</span><span>${escapeHtml(total)}</span></div>
    </div>

    <div class="foot">
      Thank you for ordering with ${escapeHtml(SITE.name)}. Quote reference <strong>${escapeHtml(data.ref)}</strong> when you contact us on WhatsApp or phone.
      This document is a customer order invoice / receipt summary.
    </div>
  </div>
  <script>
    window.addEventListener("load", () => {
      setTimeout(() => window.print(), 250);
    });
  </script>
</body>
</html>`;

  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const win = window.open(url, "_blank", "noopener,noreferrer");
  if (!win) {
    const a = document.createElement("a");
    a.href = url;
    a.download = `invoice-${data.ref || "order"}.html`;
    a.click();
  }
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
