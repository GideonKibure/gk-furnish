import type { ReactNode } from "react";

/** Inner-page hero — glass atmosphere from the very top (behind the floating desktop dock). */
export function PageHeader({
  eyebrow,
  title,
  subtitle,
  children,
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  children?: ReactNode;
}) {
  return (
    <section className="page-hero-glass relative overflow-hidden lg:-mt-[5rem]">
      <div aria-hidden className="page-hero-glass-orbs pointer-events-none absolute inset-0" />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-white/35 to-transparent backdrop-blur-[2px]"
      />
      <div className="container-page relative pb-10 pt-6 md:pb-12 md:pt-8 lg:pb-14 lg:pt-[calc(5rem+1.5rem)]">
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        <h1 className="display-lg mt-2 max-w-3xl text-navy">{title}</h1>
        {subtitle && (
          <p className="mt-4 max-w-2xl text-base leading-relaxed text-muted-foreground md:text-lg">
            {subtitle}
          </p>
        )}
        {children}
      </div>
    </section>
  );
}

export function SectionTitle({ eyebrow, title, action }: { eyebrow?: string; title: string; action?: ReactNode }) {
  return (
    <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between md:mb-10">
      <div className="min-w-0">
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        <h2 className="display-lg mt-2 text-navy">{title}</h2>
      </div>
      {action}
    </div>
  );
}
