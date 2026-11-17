import { maskLogFields } from "@/lib/abuse";

/** One JSON line. Secrets, emails and phone numbers are masked first. */
export function logServer(event: string, fields: Record<string, unknown> = {}) {
  console.info(JSON.stringify({ event, ...maskLogFields(fields) }));
}
