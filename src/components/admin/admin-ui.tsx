import { ArrowDownRight, ArrowUpRight, Inbox, Loader2, Minus, Search, X } from "lucide-react";
import type { ReactNode } from "react";
import { DATE_RANGE_LABELS, DATE_RANGES, type DateRange } from "@/lib/ops/date-range";
import type { PillTone } from "@/lib/ops/status";
import { cn } from "@/lib/utils";

export type { PillTone } from "@/lib/ops/status";

/** Button styles for the admin portal. Gold buttons always use navy text for contrast. */
export const adminBtn = {
  base: "inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-lg px-4 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold disabled:pointer-events-none disabled:opacity-50",
  gold: "bg-gold text-navy hover:bg-[#F29A0B]",
  navy: "bg-navy text-white hover:bg-[#1D2E52]",
  outline: "border border-[#E5E5E5] bg-white text-navy hover:bg-[#F5F6F8]",
  ghost: "text-navy hover:bg-[#F3F4F6]",
  danger: "border border-[#FECACA] bg-white text-[#DC2626] hover:bg-[#FEE2E2]",
  sm: "h-8 px-3 text-xs",
} as const;

export function btn(variant: "gold" | "navy" | "outline" | "ghost" | "danger" = "outline", size?: "sm", className?: string) {
  return cn(adminBtn.base, adminBtn[variant], size === "sm" && adminBtn.sm, className);
}

export const adminInput =
  "h-10 w-full rounded-lg border border-[#E5E5E5] bg-white px-3 text-sm text-navy placeholder:text-[#9CA3AF] focus:border-gold focus:outline-none focus:ring-2 focus:ring-gold/25";

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
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3 md:mb-6">
      <div className="min-w-0">
        <h1 className="text-2xl font-bold tracking-tight text-navy md:text-[1.75rem]">{title}</h1>
        {description && <p className="mt-1 max-w-2xl text-sm text-[#6B7280]">{description}</p>}
      </div>
      {action && <div className="flex flex-wrap items-center gap-2">{action}</div>}
    </div>
  );
}

const cardShadow = "shadow-[0_1px_2px_rgba(20,33,61,0.04),0_6px_20px_-12px_rgba(20,33,61,0.12)]";

export function AdminCard({
  children,
  className,
  hover = false,
}: {
  children: ReactNode;
  className?: string;
  hover?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-xl border border-[#E5E5E5] bg-white p-4 md:p-5",
        cardShadow,
        hover && "transition-shadow duration-200 hover:shadow-[0_2px_4px_rgba(20,33,61,0.05),0_12px_28px_-14px_rgba(20,33,61,0.18)]",
        className,
      )}
    >
      {children}
    </div>
  );
}

/** Card with a titled header row; the body has no padding so lists and tables can run edge to edge. */
export function ChartCard({
  title,
  description,
  action,
  children,
  className,
  bodyClassName,
}: {
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <section className={cn("flex min-w-0 flex-col rounded-xl border border-[#E5E5E5] bg-white", cardShadow, className)}>
      <header className="flex flex-wrap items-center justify-between gap-2 px-4 pb-2 pt-4 md:px-5">
        <div className="min-w-0">
          <h2 className="text-base font-semibold text-navy">{title}</h2>
          {description && <p className="mt-0.5 text-xs text-[#6B7280]">{description}</p>}
        </div>
        {action}
      </header>
      <div className={cn("min-w-0 flex-1 px-4 pb-4 md:px-5", bodyClassName)}>{children}</div>
    </section>
  );
}

const PILL_TONES: Record<PillTone, string> = {
  success: "bg-[#DCFCE7] text-[#15803D]",
  processing: "bg-[#FEF3C7] text-[#B45309]",
  pending: "bg-[#FFEDD5] text-[#C2410C]",
  info: "bg-[#DBEAFE] text-[#1D4ED8]",
  danger: "bg-[#FEE2E2] text-[#DC2626]",
  neutral: "bg-[#F3F4F6] text-[#374151]",
};

export function StatusPill({ tone = "neutral", children, className }: { tone?: PillTone; children: ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold leading-5",
        PILL_TONES[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

/** Older badge API kept for existing pages; maps onto the status pill colours. */
export function AdminBadge({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "neutral" | "gold" | "success" | "danger" | "warn" | "info";
}) {
  const map: Record<string, PillTone> = {
    neutral: "neutral",
    gold: "processing",
    success: "success",
    danger: "danger",
    warn: "pending",
    info: "info",
  };
  return <StatusPill tone={map[tone] ?? "neutral"}>{children}</StatusPill>;
}

export function TrendChip({ value, suffix = "vs previous period" }: { value: number | null; suffix?: string }) {
  if (value == null) {
    return <span className="text-xs text-[#6B7280]">New this period</span>;
  }
  const up = value > 0;
  const flat = value === 0;
  const Icon = flat ? Minus : up ? ArrowUpRight : ArrowDownRight;
  return (
    <span className="inline-flex flex-wrap items-center gap-1.5 text-xs text-[#6B7280]">
      <span
        className={cn(
          "inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 font-semibold",
          flat ? "bg-[#F3F4F6] text-[#374151]" : up ? "bg-[#DCFCE7] text-[#15803D]" : "bg-[#FEE2E2] text-[#DC2626]",
        )}
      >
        <Icon className="h-3 w-3" />
        {Math.abs(value)}%
      </span>
      {suffix}
    </span>
  );
}

const TILE_TONES = {
  gold: "bg-gold-soft text-[#B86A00]",
  success: "bg-[#DCFCE7] text-[#15803D]",
  navy: "bg-[#E8ECF5] text-navy",
  info: "bg-[#DBEAFE] text-[#1D4ED8]",
  danger: "bg-[#FEE2E2] text-[#DC2626]",
  pending: "bg-[#FFEDD5] text-[#C2410C]",
} as const;

export function KpiCard({
  label,
  value,
  icon,
  tone = "gold",
  trend,
  hint,
  className,
}: {
  label: string;
  value: ReactNode;
  icon?: ReactNode;
  tone?: keyof typeof TILE_TONES;
  /** Percent change vs the previous period; `undefined` hides the chip. */
  trend?: number | null;
  hint?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex min-w-0 items-start gap-3 rounded-xl border border-[#E5E5E5] bg-white p-4", cardShadow, className)}>
      {icon && <span className={cn("grid h-11 w-11 shrink-0 place-items-center rounded-lg", TILE_TONES[tone])}>{icon}</span>}
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium text-[#6B7280]">{label}</p>
        <p className="mt-0.5 truncate text-xl font-bold tracking-tight text-navy md:text-2xl">{value}</p>
        <div className="mt-1 min-h-5">
          {trend !== undefined ? <TrendChip value={trend} /> : hint ? <span className="text-xs text-[#6B7280]">{hint}</span> : null}
        </div>
      </div>
    </div>
  );
}

/** Older stat card API kept for existing pages. */
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
  const map = { default: "navy", gold: "gold", success: "success", warn: "pending", danger: "danger" } as const;
  return <KpiCard label={label} value={value} hint={hint} icon={icon} tone={map[tone]} {...(className ? { className } : {})} />;
}

export function StatusTabs<T extends string>({
  tabs,
  value,
  onChange,
  className,
}: {
  tabs: readonly { id: T; label: string; count?: number }[];
  value: T;
  onChange: (id: T) => void;
  className?: string;
}) {
  return (
    <div
      role="tablist"
      className={cn("-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-1 [scrollbar-width:none] md:mx-0 md:px-0", className)}
    >
      {tabs.map((tab) => {
        const active = tab.id === value;
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(tab.id)}
            className={cn(
              "inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg px-3 text-sm font-semibold transition-colors",
              active ? "bg-navy text-white" : "border border-[#E5E5E5] bg-white text-[#374151] hover:bg-[#F5F6F8]",
            )}
          >
            {tab.label}
            {tab.count !== undefined && (
              <span
                className={cn(
                  "rounded-full px-1.5 text-xs font-semibold",
                  active ? "bg-white/15 text-white" : "bg-[#F3F4F6] text-[#6B7280]",
                )}
              >
                {tab.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

export function SearchInput({
  value,
  onChange,
  placeholder = "Search…",
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}) {
  return (
    <label className={cn("relative block min-w-0", className)}>
      <span className="sr-only">{placeholder}</span>
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9CA3AF]" />
      <input
        type="search"
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className={cn(adminInput, "pl-9 pr-8 [&::-webkit-search-cancel-button]:hidden")}
      />
      {value && (
        <button
          type="button"
          aria-label="Clear search"
          onClick={() => onChange("")}
          className="absolute right-2 top-1/2 grid h-6 w-6 -translate-y-1/2 place-items-center rounded text-[#6B7280] hover:bg-[#F3F4F6]"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </label>
  );
}

export function FilterSelect<T extends string>({
  value,
  onChange,
  options,
  label,
  className,
}: {
  value: T;
  onChange: (value: T) => void;
  options: readonly { value: T; label: string }[];
  label: string;
  className?: string;
}) {
  return (
    <label className={cn("block min-w-0", className)}>
      <span className="sr-only">{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value as T)} className={cn(adminInput, "pr-8")} aria-label={label}>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

export function DateRangeSelect({
  value,
  onChange,
  className,
  allowAll = false,
}: {
  value: DateRange | "all";
  onChange: (value: DateRange | "all") => void;
  className?: string;
  allowAll?: boolean;
}) {
  const options = [
    ...(allowAll ? [{ value: "all" as const, label: "All time" }] : []),
    ...DATE_RANGES.map((r) => ({ value: r, label: DATE_RANGE_LABELS[r] })),
  ];
  return <FilterSelect value={value} onChange={onChange} options={options} label="Date range" {...(className ? { className } : {})} />;
}

export type Column<T> = {
  key: string;
  header: ReactNode;
  cell: (row: T) => ReactNode;
  className?: string;
  align?: "left" | "right";
};

/** Table on tablet and desktop; on phones each row becomes a card (`mobileCard`). */
export function DataTable<T>({
  rows,
  columns,
  rowKey,
  mobileCard,
  onRowClick,
  empty,
  className,
}: {
  rows: readonly T[];
  columns: readonly Column<T>[];
  rowKey: (row: T) => string;
  mobileCard: (row: T) => ReactNode;
  onRowClick?: (row: T) => void;
  empty?: ReactNode;
  className?: string;
}) {
  if (!rows.length) return <>{empty ?? <AdminEmpty>Nothing to show yet.</AdminEmpty>}</>;
  return (
    <div className={className}>
      <div className={cn("hidden overflow-hidden rounded-xl border border-[#E5E5E5] bg-white md:block", cardShadow)}>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-[#E5E5E5] bg-[#F9FAFB] text-xs font-semibold text-[#6B7280]">
              <tr>
                {columns.map((c) => (
                  <th key={c.key} scope="col" className={cn("whitespace-nowrap px-4 py-3", c.align === "right" && "text-right", c.className)}>
                    {c.header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F0F0F0]">
              {rows.map((row) => (
                <tr
                  key={rowKey(row)}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                  className={cn("align-middle transition-colors hover:bg-[#F9FAFB]", onRowClick && "cursor-pointer")}
                >
                  {columns.map((c) => (
                    <td key={c.key} className={cn("px-4 py-3", c.align === "right" && "text-right", c.className)}>
                      {c.cell(row)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <ul className="space-y-2.5 md:hidden">
        {rows.map((row) => (
          <li key={rowKey(row)}>
            {onRowClick ? (
              <button
                type="button"
                onClick={() => onRowClick(row)}
                className={cn("block w-full rounded-xl border border-[#E5E5E5] bg-white p-3.5 text-left", cardShadow)}
              >
                {mobileCard(row)}
              </button>
            ) : (
              <div className={cn("rounded-xl border border-[#E5E5E5] bg-white p-3.5", cardShadow)}>{mobileCard(row)}</div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function AdminEmpty({
  children,
  title,
  icon,
  action,
  className,
}: {
  children?: ReactNode;
  title?: string;
  icon?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("rounded-xl border border-dashed border-[#D1D5DB] bg-white px-6 py-12 text-center", className)}>
      <span className="mx-auto grid h-11 w-11 place-items-center rounded-full bg-[#F3F4F6] text-[#6B7280]">
        {icon ?? <Inbox className="h-5 w-5" />}
      </span>
      {title && <p className="mt-3 text-sm font-semibold text-navy">{title}</p>}
      {children && <div className="mx-auto mt-1.5 max-w-md text-sm text-[#6B7280]">{children}</div>}
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </div>
  );
}

export function AdminLoading({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 rounded-xl border border-[#E5E5E5] bg-white px-6 py-12 text-sm text-[#6B7280]">
      <Loader2 className="h-4 w-4 animate-spin" />
      {label}
    </div>
  );
}

export function AdminNotice({ children, tone = "info" }: { children: ReactNode; tone?: "info" | "pending" | "danger" }) {
  return (
    <div
      className={cn(
        "rounded-lg border px-3.5 py-2.5 text-sm",
        tone === "info" && "border-[#BFDBFE] bg-[#EFF6FF] text-[#1E3A8A]",
        tone === "pending" && "border-[#FED7AA] bg-[#FFF7ED] text-[#9A3412]",
        tone === "danger" && "border-[#FECACA] bg-[#FEF2F2] text-[#991B1B]",
      )}
    >
      {children}
    </div>
  );
}

/** Label/value pair used inside mobile cards and detail panels. */
export function Field({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  return (
    <div className={cn("min-w-0", className)}>
      <p className="text-[0.7rem] font-semibold uppercase tracking-wide text-[#6B7280]">{label}</p>
      <div className="mt-0.5 text-sm text-navy">{children}</div>
    </div>
  );
}

export function formatDate(value: string | null | undefined, withTime = false) {
  if (!value) return "—";
  return new Date(value).toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    ...(withTime ? { hour: "2-digit", minute: "2-digit" } : {}),
    timeZone: "Africa/Dar_es_Salaam",
  });
}

/** TZS amount including zero (formatPrice hides zero). */
export function tzs(value: number | null | undefined) {
  return `TZS ${new Intl.NumberFormat("en-US").format(Math.round(Number(value) || 0))}`;
}
