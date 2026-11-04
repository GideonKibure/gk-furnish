import { Check } from "lucide-react";
import { Fragment } from "react";
import { cn } from "@/lib/utils";

/** Numbered progress steps: done steps are navy with a tick, the current one is gold. */
export function Stepper({
  steps,
  current,
  onStepClick,
  className,
}: {
  steps: string[];
  current: number;
  /** Only earlier steps are clickable. */
  onStepClick?: (index: number) => void;
  className?: string;
}) {
  return (
    <ol className={cn("flex items-center gap-2", className)}>
      {steps.map((label, index) => {
        const done = index < current;
        const active = index === current;
        const clickable = Boolean(onStepClick) && done;
        const content = (
          <>
            <span
              className={cn(
                "grid h-7 w-7 shrink-0 place-items-center rounded-full text-xs font-bold transition-colors",
                active && "bg-gold text-navy",
                done && "bg-navy text-white",
                !active && !done && "border border-input bg-white text-muted-foreground",
              )}
            >
              {done ? <Check className="h-3.5 w-3.5" strokeWidth={3} /> : index + 1}
            </span>
            <span
              className={cn(
                "truncate text-sm font-semibold",
                active ? "text-navy" : done ? "text-navy" : "text-muted-foreground",
                !active && "max-sm:hidden",
              )}
            >
              {label}
            </span>
          </>
        );
        return (
          <Fragment key={label}>
            {index > 0 && (
              <li
                aria-hidden
                className={cn("h-px min-w-4 flex-1", index <= current ? "bg-navy" : "bg-input")}
              />
            )}
            <li className="flex min-w-0 items-center" aria-current={active ? "step" : undefined}>
              {clickable ? (
                <button
                  type="button"
                  onClick={() => onStepClick?.(index)}
                  className="flex min-w-0 items-center gap-2 rounded-full pr-1"
                >
                  {content}
                </button>
              ) : (
                <span className="flex min-w-0 items-center gap-2">{content}</span>
              )}
            </li>
          </Fragment>
        );
      })}
    </ol>
  );
}
