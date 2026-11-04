import type { ReactNode } from "react";
import { statusTone, type StatusTone } from "@/i18n/status";
import { cn } from "@/lib/utils";

const TONE_CLASS: Record<StatusTone, string> = {
  success: "tone-success",
  warn: "tone-warn",
  pending: "tone-pending",
  info: "tone-info",
  danger: "tone-danger",
  neutral: "tone-neutral",
  gold: "tone-gold",
};

/** Rounded status label. Pass `status` to pick the colour, or `tone` to set it. */
export function StatusPill({
  status,
  tone,
  children,
  className,
  dot = false,
}: {
  status?: string;
  tone?: StatusTone;
  children: ReactNode;
  className?: string;
  dot?: boolean;
}) {
  const resolved = tone ?? (status ? statusTone(status) : "neutral");
  return (
    <span className={cn("status-pill", TONE_CLASS[resolved], className)}>
      {dot && <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-current" />}
      {children}
    </span>
  );
}
