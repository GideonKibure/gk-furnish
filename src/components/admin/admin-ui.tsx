import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function AdminPageHeader({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4 md:mb-8">
      <div className="min-w-0">
        <h1 className="font-display text-3xl tracking-tight text-navy md:text-4xl">{title}</h1>
        {description && (
          <p className="mt-1.5 max-w-2xl text-sm text-muted-foreground md:text-base">
            {description}
          </p>
        )}
      </div>
      {action}
    </div>
  );
}

export function AdminCard({
  children,
  className,
  hover = true,
}: {
  children: ReactNode;
  className?: string;
  hover?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-border/80 bg-background p-5 shadow-[var(--shadow-card)] md:p-6",
        hover &&
          "transition-all duration-300 hover:-translate-y-0.5 hover:border-gold/30 hover:shadow-[var(--shadow-lift)]",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function AdminStatCard({
  label,
  value,
  hint,
  icon,
  tone = "default",
  className,
}: {
  label: string;
  value: ReactNode;
  hint?: string;
  icon?: ReactNode;
  tone?: "default" | "gold" | "success" | "warn" | "danger";
  className?: string;
}) {
  return (
    <div
      className={cn(
        "group relative overflow-hidden rounded-2xl border border-border/80 bg-background p-5 shadow-[var(--shadow-card)] transition-all duration-300 hover:-translate-y-1 hover:border-gold/35 hover:shadow-[var(--shadow-lift)]",
        className,
      )}
    >
      <div
        aria-hidden
        className={cn(
          "pointer-events-none absolute -right-6 -top-6 h-24 w-24 rounded-full transition-transform duration-500 group-hover:scale-125",
          tone === "gold" && "bg-gold/15",
          tone === "success" && "bg-emerald-400/15",
          tone === "warn" && "bg-amber-400/15",
          tone === "danger" && "bg-destructive/10",
          tone === "default" && "bg-gold/10",
        )}
      />
      <div className="relative flex items-start justify-between gap-3">
        <p className="text-[0.7rem] font-bold uppercase tracking-[0.14em] text-muted-foreground">
          {label}
        </p>
        {icon && (
          <span
            className={cn(
              "grid h-9 w-9 place-items-center rounded-xl transition-transform duration-300 group-hover:scale-110",
              tone === "gold" && "bg-gold-soft text-navy",
              tone === "success" && "bg-emerald-100 text-emerald-800",
              tone === "warn" && "bg-amber-100 text-amber-800",
              tone === "danger" && "bg-destructive/10 text-destructive",
              tone === "default" && "bg-secondary text-navy",
            )}
          >
            {icon}
          </span>
        )}
      </div>
      <p className="relative mt-3 font-display text-3xl tracking-tight text-navy md:text-[2rem]">
        {value}
      </p>
      {hint && <p className="relative mt-1.5 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

export function AdminBadge({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "neutral" | "gold" | "success" | "danger" | "warn";
}) {
  return (
    <span
      className={cn(
        "inline-flex rounded-full px-2.5 py-1 text-[0.7rem] font-semibold capitalize",
        tone === "neutral" && "bg-secondary text-navy",
        tone === "gold" && "bg-gold-soft text-navy",
        tone === "success" && "bg-emerald-100 text-emerald-900",
        tone === "warn" && "bg-amber-100 text-amber-900",
        tone === "danger" && "bg-destructive/10 text-destructive",
      )}
    >
      {children}
    </span>
  );
}

export function AdminEmpty({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-2xl border border-dashed border-border bg-background/70 px-6 py-14 text-center text-sm text-muted-foreground">
      {children}
    </div>
  );
}
