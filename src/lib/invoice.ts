import { formatPrice, SITE } from "@/config/site";
import { QUOTE_POLICY_NOTES, type SavedQuote } from "@/lib/custom-quotes";

export type InvoiceLine = { name: string; qty: number; unitPrice: number; details?: string };

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
  lines?: InvoiceLine[];
  advancePercent?: number;
  advanceRequired?: number;
};

export type ReceiptData = {
  receiptNumber: string;
  orderNumber: string;
  paidAt: string;
  amount: number;
  purpose: string;
  method: string;
  customerName: string;
  phone?: string;
  email?: string;
  orderTotal: number;
  totalPaid: number;
  lines?: InvoiceLine[];
};

const STYLE = `
    :root { color-scheme: light; }
    * { box-sizing: border-box; }
    body { margin: 0; font-family: "Outfit", "Segoe UI", system-ui, sans-serif; color: #1a1f2e; background: #fff; padding: 32px; }
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
    td small { display: block; color: #5b6475; font-size: 0.8rem; margin-top: 2px; }
    .totals { margin-top: 16px; margin-left: auto; width: min(320px, 100%); }
    .totals div { display: flex; justify-content: space-between; padding: 6px 0; font-size: 0.95rem; }
    .totals .grand { border-top: 2px solid #14213d; margin-top: 8px; padding-top: 10px; font-weight: 700; font-size: 1.05rem; }
    .stamp { display: inline-block; margin-top: 10px; padding: 6px 14px; border: 2px solid #15803d; color: #15803d; border-radius: 999px; font-weight: 700; letter-spacing: 0.08em; }
    ul.policy { margin: 0; padding-left: 18px; font-size: 0.85rem; color: #5b6475; }
    ul.policy li { margin-bottom: 4px; }
    .foot { margin-top: 36px; padding-top: 16px; border-top: 1px dashed #d1d5db; font-size: 0.8rem; color: #5b6475; }
    @media print { body { padding: 0; } .noprint { display: none !important; } }
`;

function money(amount: number) {
  return formatPrice(amount) ?? `${SITE.currency} 0`;
}

function header(kind: string, number: string, extra: string) {
  return `<div class="noprint" style="margin-bottom:16px">
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
        <span class="muted">${escapeHtml(kind)}</span>
        <strong>${escapeHtml(number)}</strong>
        ${extra}
      </div>
    </div>`;
}

function linesTable(lines: InvoiceLine[]) {
  const rows = lines
    .map(
      (line) => `<tr>
        <td>${escapeHtml(line.name)}${line.details ? `<small>${escapeHtml(line.details)}</small>` : ""}</td>
        <td class="num">${line.qty}</td>
        <td class="num">${escapeHtml(money(line.unitPrice))}</td>
        <td class="num">${escapeHtml(money(line.qty * line.unitPrice))}</td>
      </tr>`,
    )
    .join("");
  return `<table>
      <thead><tr><th>Description</th><th class="num">Qty</th><th class="num">Unit</th><th class="num">Amount</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>`;
}

function policyList() {
  return `<h2>Payment policy</h2><ul class="policy">${QUOTE_POLICY_NOTES.map((n) => `<li>${escapeHtml(n)}</li>`).join("")}</ul>`;
}

function openPrintable(title: string, body: string, fileName: string) {
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(title)} — ${escapeHtml(SITE.name)}</title>
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700&display=swap" />
  <style>${STYLE}</style>
</head>
<body>
  <div class="sheet">${body}</div>
  <script>window.addEventListener("load", () => { setTimeout(() => window.print(), 250); });</script>
</body>
</html>`;
  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const win = window.open(url, "_blank", "noopener,noreferrer");
  if (!win) {
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    a.click();
  }
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

/** Build a printable HTML invoice and trigger browser print / PDF save. */
export function downloadInvoice(data: InvoiceData) {
  const issued = data.date ?? new Date().toLocaleString();
  const qty = data.qty ?? 1;
  const lines: InvoiceLine[] = data.lines?.length
    ? data.lines
    : [{
        name: data.item || (data.custom ? "Custom furniture request" : "Furniture order"),
        qty,
        unitPrice: data.total ? Math.round(data.total / Math.max(1, qty)) : 0,
      }];
  const total = data.total ?? lines.reduce((sum, l) => sum + l.qty * l.unitPrice, 0);
  const paid = data.paid ?? 0;

  const body = `${header("Invoice", data.ref, `<p class="muted" style="margin-top:8px">Issued ${escapeHtml(issued)}</p>`)}
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
    ${linesTable(lines)}
    <div class="totals">
      ${data.advanceRequired ? `<div><span class="muted">Advance to begin (${data.advancePercent ?? 50}%)</span><span>${escapeHtml(money(data.advanceRequired))}</span></div>` : ""}
      ${paid > 0 ? `<div><span class="muted">Paid</span><span>${escapeHtml(money(paid))}</span></div>` : ""}
      ${paid > 0 ? `<div><span class="muted">Balance before delivery</span><span>${escapeHtml(money(Math.max(0, total - paid)))}</span></div>` : ""}
      <div class="grand"><span>Order total</span><span>${escapeHtml(money(total))}</span></div>
    </div>
    ${policyList()}
    <div class="foot">
      Thank you for ordering with ${escapeHtml(SITE.name)}. Quote reference <strong>${escapeHtml(data.ref)}</strong> when you contact us on WhatsApp or phone.
    </div>`;
  openPrintable(`Invoice ${data.ref}`, body, `invoice-${data.ref || "order"}.html`);
}

/** Printable receipt confirming one payment. */
export function downloadReceipt(data: ReceiptData) {
  const balance = Math.max(0, data.orderTotal - data.totalPaid);
  const body = `${header(
    "Payment receipt",
    data.receiptNumber,
    `<p class="muted" style="margin-top:8px">Paid ${escapeHtml(new Date(data.paidAt).toLocaleString())}</p><span class="stamp">PAID</span>`,
  )}
    <h2>Received from</h2>
    <div class="grid">
      <div class="card">
        <p><strong>${escapeHtml(data.customerName || "Customer")}</strong></p>
        ${data.phone ? `<p class="muted">${escapeHtml(data.phone)}</p>` : ""}
        ${data.email ? `<p class="muted">${escapeHtml(data.email)}</p>` : ""}
      </div>
      <div class="card">
        <p><span class="muted">Order:</span> ${escapeHtml(data.orderNumber)}</p>
        <p><span class="muted">Payment for:</span> ${escapeHtml(purposeLabel(data.purpose))}</p>
        <p><span class="muted">Method:</span> ${escapeHtml(data.method || "—")}</p>
      </div>
    </div>
    ${data.lines?.length ? `<h2>Order items</h2>${linesTable(data.lines)}` : ""}
    <div class="totals">
      <div class="grand"><span>Amount received</span><span>${escapeHtml(money(data.amount))}</span></div>
      <div><span class="muted">Order total</span><span>${escapeHtml(money(data.orderTotal))}</span></div>
      <div><span class="muted">Total paid so far</span><span>${escapeHtml(money(data.totalPaid))}</span></div>
      <div><span class="muted">Balance before delivery</span><span>${escapeHtml(money(balance))}</span></div>
    </div>
    ${policyList()}
    <div class="foot">
      This receipt confirms a payment to ${escapeHtml(SITE.name)} for order <strong>${escapeHtml(data.orderNumber)}</strong>.
      Keep it for your records.
    </div>`;
  openPrintable(`Receipt ${data.receiptNumber}`, body, `receipt-${data.receiptNumber}.html`);
}

export function purposeLabel(purpose: string) {
  if (purpose === "full") return "Full payment";
  if (purpose === "balance") return "Balance payment";
  return "Advance payment";
}

/** Plain-text receipt summary for sharing on WhatsApp. */
export function receiptText(data: ReceiptData) {
  const balance = Math.max(0, data.orderTotal - data.totalPaid);
  return [
    `${SITE.name} payment receipt ${data.receiptNumber}`,
    `Order: ${data.orderNumber}`,
    `${purposeLabel(data.purpose)}: ${money(data.amount)}`,
    `Paid so far: ${money(data.totalPaid)} of ${money(data.orderTotal)}`,
    `Balance before delivery: ${money(balance)}`,
  ].join("\n");
}

/** Open a printable quote. The browser print dialog can save it as a PDF. */
export function downloadQuote(quote: SavedQuote) {
  const issued = new Date(quote.createdAt).toLocaleString();
  const detail = (label: string, value: string) =>
    value ? `<p><span class="muted">${escapeHtml(label)}:</span> ${escapeHtml(value)}</p>` : "";
  const percent = quote.advancePercent || 50;

  const body = `${header(
    "Quotation",
    quote.number,
    `<p class="muted" style="margin-top:8px">Issued ${escapeHtml(issued)}</p>${
      quote.validUntil ? `<p class="muted">Valid until ${escapeHtml(quote.validUntil)}</p>` : ""
    }`,
  )}
    <h2>Customer</h2>
    <div class="grid">
      <div class="card">
        <p><strong>${escapeHtml(quote.customerName || "Customer")}</strong></p>
        ${quote.phone ? `<p class="muted">${escapeHtml(quote.phone)}</p>` : ""}
        ${quote.email ? `<p class="muted">${escapeHtml(quote.email)}</p>` : ""}
        ${quote.location ? `<p class="muted">Delivery: ${escapeHtml(quote.location)}</p>` : ""}
      </div>
      <div class="card">
        <p><span class="muted">Piece:</span> ${escapeHtml(quote.furnitureType)} × ${quote.quantity}</p>
        ${detail("Size", quote.dimensions)}
        ${detail("Material", quote.material)}
        ${detail("Colour", quote.color)}
      </div>
    </div>
    ${quote.description ? `<h2>Request</h2><p>${escapeHtml(quote.description).replaceAll("\n", "<br>")}</p>` : ""}
    ${quote.requirements ? `<p class="muted">${escapeHtml(quote.requirements).replaceAll("\n", "<br>")}</p>` : ""}
    <h2>Quoted work</h2>
    ${linesTable(quote.lines.map((l) => ({ name: l.description, qty: l.quantity, unitPrice: l.unitPrice })))}
    <div class="totals">
      <div><span class="muted">Advance to begin (${percent}%)</span><span>${escapeHtml(money(Math.ceil((quote.total * percent) / 100)))}</span></div>
      <div class="grand"><span>Quote total</span><span>${escapeHtml(money(quote.total))}</span></div>
    </div>
    ${quote.notes ? `<h2>Notes</h2><p>${escapeHtml(quote.notes).replaceAll("\n", "<br>")}</p>` : ""}
    ${policyList()}
    <div class="foot">
      This quotation is for ${escapeHtml(quote.customerName || "the customer")} and reference <strong>${escapeHtml(quote.number)}</strong>.
      Nothing is charged until you agree. Quote this number when you contact ${escapeHtml(SITE.name)} on WhatsApp or phone.
    </div>`;
  openPrintable(`Quote ${quote.number}`, body, `quote-${quote.number}.html`);
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
