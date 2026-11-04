import { Link } from "@tanstack/react-router";
import { cn } from "@/lib/utils";

export function CategoryTile({
  slug,
  label,
  image,
  count,
  className,
}: {
  slug: string;
  label: string;
  image: string | null | undefined;
  count?: number | undefined;
  className?: string;
}) {
  return (
    <Link
      to="/categories/$slug"
      params={{ slug }}
      className={cn("group block min-w-0 rounded-xl outline-none", className)}
    >
      <span className="block aspect-[4/3] overflow-hidden rounded-xl border border-border bg-sand">
        {image ? (
          <img
            src={image}
            alt=""
            loading="lazy"
            decoding="async"
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : null}
      </span>
      <span className="mt-2.5 block truncate text-center text-sm font-semibold text-navy group-hover:text-gold-ink">
        {label}
        {count != null && <span className="ml-1 font-normal text-muted-foreground">({count})</span>}
      </span>
    </Link>
  );
}
