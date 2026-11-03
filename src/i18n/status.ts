import type { Dictionary } from "./en";

export function statusLabel(t: Dictionary, status: string) {
  return (t.status as Record<string, string>)[status] ?? status.replace(/_/g, " ");
}
