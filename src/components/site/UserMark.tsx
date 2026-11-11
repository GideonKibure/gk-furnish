import { cn } from "@/lib/utils";

/** Gold circle with the first letter of the signed-in customer's name. */
export function UserMark({ letter, className }: { letter: string; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        "grid h-8 w-8 shrink-0 place-items-center rounded-full bg-gold text-sm font-bold leading-none text-navy",
        className,
      )}
    >
      {letter}
    </span>
  );
}
