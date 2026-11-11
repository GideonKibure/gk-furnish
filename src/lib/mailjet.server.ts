import { SITE } from "@/config/site";
import { customerStage } from "@/lib/ops/status";

/**
 * Customer email via Mailjet. Keys stay on the server:
 * MAILJET_API_KEY, MAILJET_SECRET_KEY, and MAILJET_FROM_EMAIL (a sender verified in Mailjet).
 * A missing key or a failed send never stops the order.
 */

type MailMessage = {
  to: string;
  name?: string | null;
  subject: string;
  text: string;
  html: string;
};

export type CustomerEmail = {
  email: string | null | undefined;
  name?: string | null;
  subject: string;
  /** Hidden inbox preview. Falls back to the headline. */
  preview?: string;
  headline: string;
  paragraphs: string[];
  /** One fact the reader should see before the button, such as the amount due. */
  highlight?: { label: string; value: string } | null;
  link?: string | null;
  linkLabel?: string;
};

function escapeHtml(value: string) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function firstName(name: string | null | undefined) {
  const part = name?.trim().split(/\s+/)[0] ?? "";
  return part.length > 1 ? part : "";
}

export function orderTrackingLink(token: string | null | undefined) {
  const clean = token?.trim();
  return clean ? `${SITE.url}/track/${clean}` : null;
}

/** Inbox-safe HTML. One headline, one fact, one button. */
export function renderCustomerEmail(input: Omit<CustomerEmail, "email">) {
  const who = firstName(input.name);
  const greeting = who ? `Hello ${who},` : "Hello,";
  const paragraphs = input.paragraphs.map((line) => line.trim()).filter(Boolean);
  const preview = (input.preview?.trim() || input.headline).slice(0, 140);
  const link = input.link?.trim() || "";
  const linkLabel = input.linkLabel?.trim() || "View your order";
  const highlight = input.highlight?.label && input.highlight.value ? input.highlight : null;

  const text = [
    greeting,
    "",
    input.headline,
    "",
    ...paragraphs.flatMap((line) => [line, ""]),
    highlight ? `${highlight.label}: ${highlight.value}` : "",
    highlight ? "" : "",
    link ? `${linkLabel}: ${link}` : "",
    "",
    `${SITE.name} · ${SITE.location}`,
    SITE.phoneDisplay,
    "You are receiving this because of an order with us.",
  ]
    .filter((line, index, all) => line !== "" || all[index - 1] !== "")
    .join("\n")
    .trim();

  const paragraphHtml = paragraphs
    .map(
      (line) =>
        `<p style="margin:0 0 14px;font-size:16px;line-height:1.55;color:#14213D;">${escapeHtml(line)}</p>`,
    )
    .join("");
  const highlightHtml = highlight
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:4px 0 22px;background:#F8F5EE;border-radius:10px;">
        <tr><td style="padding:16px 18px;font-family:Arial,Helvetica,sans-serif;">
          <p style="margin:0 0 4px;font-size:12px;letter-spacing:0.08em;text-transform:uppercase;color:#6B7280;">${escapeHtml(highlight.label)}</p>
          <p style="margin:0;font-size:22px;line-height:1.2;font-weight:800;color:#14213D;">${escapeHtml(highlight.value)}</p>
        </td></tr>
      </table>`
    : "";
  const buttonHtml = link
    ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:6px 0 8px;">
        <tr><td bgcolor="#FCA311" style="border-radius:8px;">
          <a href="${escapeHtml(link)}" style="display:inline-block;padding:13px 22px;font-family:Arial,Helvetica,sans-serif;font-size:15px;font-weight:700;color:#14213D;text-decoration:none;">${escapeHtml(linkLabel)}</a>
        </td></tr>
      </table>
      <p style="margin:10px 0 0;font-size:12px;line-height:1.4;color:#6B7280;">Or copy this link:<br><a href="${escapeHtml(link)}" style="color:#14213D;">${escapeHtml(link)}</a></p>`
    : "";

  const html = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
  <style>
    @keyframes gk-logo-in { from { opacity: 0; transform: translateY(8px) scale(0.94); } to { opacity: 1; transform: none; } }
    .gk-logo { animation: gk-logo-in 0.8s ease both; }
  </style>
</head>
<body style="margin:0;padding:0;background:#F4F5F7;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(preview)}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F4F5F7;">
    <tr><td align="center" style="padding:24px 12px;">
      <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="width:100%;max-width:560px;background:#ffffff;border-radius:12px;overflow:hidden;">
        <tr><td style="background:#14213D;padding:18px 28px;">
          <img class="gk-logo" src="${SITE.url}/brand/gk-furnish-logo.png" width="48" height="54" alt="${escapeHtml(SITE.name)}" style="display:block;border:0;height:54px;width:auto;">
        </td></tr>
        <tr><td style="height:4px;background:#FCA311;font-size:0;line-height:0;">&nbsp;</td></tr>
        <tr><td style="padding:28px 28px 8px;font-family:Arial,Helvetica,sans-serif;">
          <p style="margin:0 0 8px;font-size:14px;line-height:1.4;color:#5C6570;">${escapeHtml(greeting)}</p>
          <h1 style="margin:0 0 16px;font-size:24px;line-height:1.25;font-weight:800;color:#14213D;">${escapeHtml(input.headline)}</h1>
          ${paragraphHtml}
          ${highlightHtml}
          ${buttonHtml}
        </td></tr>
        <tr><td style="padding:8px 28px 28px;font-family:Arial,Helvetica,sans-serif;">
          <p style="margin:16px 0 0;padding-top:16px;border-top:1px solid #E5E5E5;font-size:13px;line-height:1.5;color:#6B7280;">
            ${escapeHtml(SITE.name)} · ${escapeHtml(SITE.location)}<br>
            <a href="tel:${escapeHtml(SITE.phoneDial)}" style="color:#14213D;text-decoration:none;">${escapeHtml(SITE.phoneDisplay)}</a>
            · <a href="mailto:${escapeHtml(SITE.email)}" style="color:#14213D;text-decoration:none;">${escapeHtml(SITE.email)}</a><br>
            You are receiving this because of an order with us.
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

  return { text, html };
}

export async function sendMail(message: MailMessage): Promise<boolean> {
  const key = process.env["MAILJET_API_KEY"]?.trim();
  const secret = process.env["MAILJET_SECRET_KEY"]?.trim();
  const to = message.to.trim();
  if (!key || !secret || !to.includes("@")) return false;
  const from = process.env["MAILJET_FROM_EMAIL"]?.trim() || SITE.email;
  try {
    const response = await fetch("https://api.mailjet.com/v3.1/send", {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${key}:${secret}`).toString("base64")}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        Messages: [
          {
            From: { Email: from, Name: SITE.name },
            ReplyTo: { Email: SITE.email, Name: SITE.name },
            To: [{ Email: to, Name: message.name?.trim() || to }],
            Subject: message.subject.slice(0, 200),
            TextPart: message.text,
            HTMLPart: message.html,
          },
        ],
      }),
    });
    if (!response.ok) {
      console.warn("mailjet failed:", response.status);
      return false;
    }
    return true;
  } catch (err) {
    console.warn("mailjet failed:", err instanceof Error ? err.message : err);
    return false;
  }
}

export async function sendCustomerEmail(input: CustomerEmail) {
  const email = input.email?.trim() ?? "";
  if (!email) return false;
  const { text, html } = renderCustomerEmail(input);
  return sendMail({ to: email, name: input.name ?? null, subject: input.subject, text, html });
}

function stageCopy(status: string, orderNumber: string) {
  switch (status) {
    case "pending":
    case "awaiting_payment":
      return {
        subject: `Order ${orderNumber} is saved — payment comes next`,
        headline: "Your order is saved",
        body: "The piece is on your order. Pay the advance on the order page and send the screenshot of the transfer. We confirm that payment, then the workshop starts.",
        cta: "Open your order and pay",
        preview: "Pay the advance so we can start your piece.",
      };
    case "confirmed":
    case "processing":
      return {
        subject: `Payment confirmed for order ${orderNumber}`,
        headline: "Your payment is confirmed",
        body: "That payment is what lets us start. We make the piece to the specifications you agreed, then the balance and any delivery fee are cleared before handover.",
        cta: "Follow your order",
        preview: "Your payment is confirmed. The workshop can start.",
      };
    case "in_production":
    case "ready":
      return {
        subject: `We're making order ${orderNumber}`,
        headline: "Your piece is in the workshop",
        body: "Work has started on what you ordered. We'll write again when it is ready to deliver, or ready for you to collect in Mbeya.",
        cta: "See where it stands",
        preview: "The workshop has started on your order.",
      };
    case "out_for_delivery":
      return {
        subject: `Order ${orderNumber} is on the way`,
        headline: "Your order has left the workshop",
        body: "Keep your phone nearby so we can reach you when it arrives. The balance is settled before the piece is handed over.",
        cta: "See your order",
        preview: "Your furniture is on the way.",
      };
    case "delivered":
    case "completed":
      return {
        subject: `Order ${orderNumber} is yours`,
        headline: "Your order is with you",
        body: "We hope it does the job you bought it for. When you need another piece, or someone you know does, the shop is open at gkfurnish.co.tz.",
        cta: "View your order",
        preview: "Your GK furnish order is complete.",
      };
    default: {
      const label = customerStage(status)?.label ?? "Updated";
      return {
        subject: `Update on order ${orderNumber}`,
        headline: `Your order is now ${label}`,
        body: "Open your order page for the latest step.",
        cta: "View your order",
        preview: `An update on order ${orderNumber}.`,
      };
    }
  }
}

/** Email only when the customer-facing stage actually changes. */
export async function sendStageEmail(input: {
  email: string | null | undefined;
  name?: string | null;
  orderNumber: string;
  fromStatus: string;
  toStatus: string;
  note?: string | null;
  trackingToken?: string | null;
}) {
  const next = customerStage(input.toStatus);
  const previous = customerStage(input.fromStatus);
  if (!next || previous?.id === next.id) return false;
  const copy = stageCopy(input.toStatus, input.orderNumber);
  const note = input.note?.trim();
  return sendCustomerEmail({
    email: input.email,
    name: input.name ?? null,
    subject: copy.subject,
    preview: copy.preview,
    headline: copy.headline,
    paragraphs: [copy.body, note ? `A note from us: ${note}` : ""],
    link: orderTrackingLink(input.trackingToken),
    linkLabel: copy.cta,
  });
}
