import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function EmptyState({
  icon,
  title,
  body,
  action,
  className,
}: {
  icon?: ReactNode;
  title: string;
  body?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-xl border border-dashed border-input bg-white px-6 py-12 text-center",
        className,
      )}
    >
      {icon && (
        <div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-full bg-gold-tint text-navy">
          {icon}
        </div>
      )}
      <p className="font-display text-lg font-semibold text-navy">{title}</p>
      {body && <p className="mx-auto mt-1.5 max-w-md text-sm text-muted-foreground">{body}</p>}
      {action && <div className="mt-5 flex justify-center">{action}</div>}
    </div>
  );
}
