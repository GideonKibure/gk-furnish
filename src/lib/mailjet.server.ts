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

function escapeHtml(value: string) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export function orderTrackingLink(token: string | null | undefined) {
  const clean = token?.trim();
  return clean ? `${SITE.url}/track/${clean}` : null;
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

export async function sendCustomerEmail(input: {
  email: string | null | undefined;
  name?: string | null;
  subject: string;
  paragraphs: string[];
  link?: string | null;
}) {
  const email = input.email?.trim() ?? "";
  if (!email) return false;
  const paragraphs = input.paragraphs.map((line) => line.trim()).filter(Boolean);
  const text = [...paragraphs, input.link ?? ""].filter(Boolean).join("\n\n");
  const html = `<div style="font-family:Arial,sans-serif;color:#14213D;line-height:1.5">${paragraphs
    .map((line) => `<p>${escapeHtml(line)}</p>`)
    .join("")}${input.link ? `<p><a href="${escapeHtml(input.link)}">View your order</a></p>` : ""}</div>`;
  return sendMail({ to: email, name: input.name ?? null, subject: input.subject, text, html });
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
  return sendCustomerEmail({
    email: input.email,
    name: input.name ?? null,
    subject: `Order ${input.orderNumber}: ${next.label}`,
    paragraphs: [`Your order ${input.orderNumber} is now ${next.label}.`, input.note ?? ""],
    link: orderTrackingLink(input.trackingToken),
  });
}
