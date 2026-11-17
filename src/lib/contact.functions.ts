import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const ContactInput = z.object({
  name: z.string().trim().min(1).max(120),
  phone: z.string().trim().max(40).optional().or(z.literal("")),
  email: z.string().trim().email().max(200).optional().or(z.literal("")),
  subject: z.string().trim().max(160).optional().or(z.literal("")),
  message: z.string().trim().min(1).max(2000),
  company_website: z.string().max(200).optional(),
  turnstile_token: z.string().max(2000).optional(),
  started_at: z.number().int().optional(),
});

export const submitContactMessage = createServerFn({ method: "POST" })
  .inputValidator((data) => ContactInput.parse(data))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { guardPublicForm } = await import("@/lib/abuse.server");
    const { publicFormOutcome } = await import("@/lib/form-timing");
    const outcome = publicFormOutcome(data.company_website, data.started_at, Date.now());
    if (outcome === "silent") {
      console.warn("honeypot contact");
      return { ok: true };
    }
    if (outcome === "slow") throw new Error("Please wait a few minutes and try again.");
    await guardPublicForm(supabaseAdmin, {
      form: "contact",
      phone: data.phone,
      companyWebsite: data.company_website,
      turnstileToken: data.turnstile_token,
    });
    const { error } = await supabaseAdmin.from("contact_messages").insert({
      name: data.name,
      phone: data.phone || null,
      email: data.email || null,
      subject: data.subject || null,
      message: data.message,
    });
    if (error) throw new Error("Could not send the message");
    return { ok: true };
  });
