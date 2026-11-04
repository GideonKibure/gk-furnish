import type { ReactNode } from "react";
import { Breadcrumbs, type Crumb } from "@/components/brand/Breadcrumbs";

/** Compact light page banner with optional breadcrumb and admin-managed image. */
export function PageHeader({
  eyebrow,
  title,
  subtitle,
  children,
  image,
  crumbs,
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  children?: ReactNode;
  /** Optional admin-managed image shown beside the title. */
  image?: string | null;
  crumbs?: Crumb[];
}) {
  const text = (
    <div className="min-w-0">
      {crumbs && <Breadcrumbs items={crumbs} className="mb-3" />}
      {eyebrow && <p className="eyebrow">{eyebrow}</p>}
      <h1 className="display-lg mt-1 max-w-3xl">{title}</h1>
      {subtitle && <p className="mt-2 max-w-2xl text-[0.95rem] leading-relaxed text-muted-foreground md:text-base">{subtitle}</p>}
      {children}
    </div>
  );
  return (
    <section className="border-b border-border bg-sand">
      <div className="container-page py-6 md:py-8">
        {image ? (
          <div className="grid items-center gap-6 md:grid-cols-[minmax(0,1fr)_minmax(0,22rem)] lg:gap-10">
            {text}
            <div className="overflow-hidden rounded-xl border border-border max-md:hidden">
              <img src={image} alt="" className="aspect-[16/9] w-full object-cover" />
            </div>
          </div>
        ) : (
          text
        )}
      </div>
    </section>
  );
}

export function SectionTitle({
  eyebrow,
  title,
  action,
  className,
}: {
  eyebrow?: string;
  title: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={`mb-5 flex items-end justify-between gap-4 md:mb-6 ${className ?? ""}`}>
      <div className="min-w-0">
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        <h2 className="section-title mt-1">{title}</h2>
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
