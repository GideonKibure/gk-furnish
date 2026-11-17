import { z } from "zod";

const phone = z
  .string()
  .trim()
  .min(7)
  .max(20)
  .regex(/^[+\d\s()-]+$/);
const opt = (max: number) => z.string().trim().max(max).optional().or(z.literal(""));

export const CheckoutInput = z
  .object({
    items: z
      .array(
        z.object({
          product_id: z.string().uuid(),
          quantity: z.number().int().min(1).max(100),
          material: z.string().trim().max(120),
          size: z.string().trim().max(120),
          color: z.string().trim().max(120),
        }),
      )
      .min(1)
      .max(30),
    customer_name: z.string().trim().min(1).max(120),
    phone,
    email: z.string().trim().email().max(200).optional().or(z.literal("")),
    fulfilment_method: z.enum(["delivery", "collection"]).default("collection"),
    region: opt(80),
    district: opt(80),
    address_line: opt(200),
    delivery_location: opt(200),
    save_address: z.boolean().optional(),
    needed_by: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .or(z.literal(""))
      .optional(),
    notes: opt(1000),
    payment_choice: z.enum(["advance", "full"]),
    payment_method: z.enum(["mobile", "bank", "cash"]).default("mobile"),
    wallet: z.enum(["mpesa", "airtel", "yas", "halopesa"]).optional(),
    payment_phone: phone.optional().or(z.literal("")),
    specs_agreed: z.literal(true),
    policies_accepted: z.literal(true),
    company_website: z.string().max(200).optional(),
    turnstile_token: z.string().max(2000).optional(),
    client_request_id: z.string().uuid().optional(),
    started_at: z.number().int().optional(),
  })
  .refine(
    (d) =>
      d.fulfilment_method === "collection" ||
      Boolean(d.region && d.address_line) ||
      Boolean(d.delivery_location),
    { message: "Delivery address is required", path: ["address_line"] },
  );
