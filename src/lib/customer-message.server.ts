/**
 * Customer messages. Email is the only channel that is configured.
 * TODO: SMS when the owner supplies a provider and its documentation. Do not add a provider here.
 */
export type CustomerMessage = {
  email: string | null;
  name?: string | null;
  subject: string;
  paragraphs: string[];
  link?: string | null;
  linkLabel?: string;
};

export async function sendCustomerMessage(message: CustomerMessage): Promise<{ sent: boolean; channel: "email" }> {
  const { sendCustomerEmail } = await import("@/lib/mailjet.server");
  const sent = await sendCustomerEmail({
    email: message.email,
    name: message.name ?? null,
    subject: message.subject,
    headline: message.subject,
    paragraphs: message.paragraphs,
    link: message.link ?? null,
    linkLabel: message.linkLabel ?? "View your order",
  });
  return { sent, channel: "email" };
}
