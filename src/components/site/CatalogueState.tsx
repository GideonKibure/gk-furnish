import { useRouter, type ErrorComponentProps } from "@tanstack/react-router";
import { useLang } from "@/i18n/LanguageProvider";

function Blocks({ count }: { count: number }) {
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
      {Array.from({ length: count }, (_, index) => (
        <div key={index} className="overflow-hidden rounded-xl border border-border bg-white">
          <div className="aspect-square bg-sand" />
          <div className="space-y-2 p-3">
            <div className="h-3 w-1/3 rounded bg-sand" />
            <div className="h-4 w-4/5 rounded bg-sand" />
            <div className="h-4 w-1/2 rounded bg-sand" />
          </div>
        </div>
      ))}
    </div>
  );
}

/** Static shop placeholder. No shimmer, so reduced-motion users see a still frame. */
export function ShopPending() {
  const { t } = useLang();
  return (
    <div className="bg-sand" aria-busy="true">
      <div className="container-page py-5 md:py-8">
        <p className="sr-only">{t.common.loading}</p>
        <div className="h-8 w-48 rounded bg-white" />
        <div className="mt-5">
          <Blocks count={8} />
        </div>
      </div>
    </div>
  );
}

export function ProductPending() {
  const { t } = useLang();
  return (
    <div className="bg-white" aria-busy="true">
      <div className="container-page py-5 md:py-8">
        <p className="sr-only">{t.common.loading}</p>
        <div className="grid gap-6 md:grid-cols-2">
          <div className="aspect-square rounded-xl bg-sand" />
          <div className="space-y-3">
            <div className="h-4 w-24 rounded bg-sand" />
            <div className="h-8 w-3/4 rounded bg-sand" />
            <div className="h-6 w-1/3 rounded bg-sand" />
            <div className="h-11 w-40 rounded-lg bg-sand" />
          </div>
        </div>
      </div>
    </div>
  );
}

export function CatalogueError({ reset }: ErrorComponentProps) {
  const { t } = useLang();
  const router = useRouter();
  return (
    <div className="container-page py-16 text-center">
      <h1 className="text-xl text-navy">{t.shop.loadFailed}</h1>
      <button
        type="button"
        className="btn-base btn-gold mt-6 min-h-11 px-5"
        onClick={() => {
          void router.invalidate();
          reset();
        }}
      >
        {t.common.retry}
      </button>
    </div>
  );
}
