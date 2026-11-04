import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { MapPin, Pencil, Plus, Star, Trash2 } from "lucide-react";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { EmptyState } from "@/components/brand/EmptyState";
import { AccountShell } from "@/components/site/AccountShell";
import { DeliveryFields, type DeliveryValues } from "@/components/site/DeliveryFields";
import { useAuthUser } from "@/hooks/use-auth";
import { useLang } from "@/i18n/LanguageProvider";
import {
  deleteMyAddress,
  listMyAddresses,
  saveMyAddress,
  type SavedAddress,
} from "@/lib/addresses.functions";

export const Route = createFileRoute("/account/addresses")({
  head: () => ({
    meta: [{ title: "Saved addresses — GK furnish" }, { name: "robots", content: "noindex" }],
  }),
  component: AddressesPage,
});

type Draft = DeliveryValues & {
  id?: string;
  label: string;
  full_name: string;
  phone: string;
  is_default: boolean;
};

const EMPTY: Draft = {
  label: "",
  full_name: "",
  phone: "",
  region: "",
  district: "",
  address_line: "",
  is_default: false,
};

function AddressesPage() {
  const { t } = useLang();
  const { user } = useAuthUser();
  const queryClient = useQueryClient();
  const load = useServerFn(listMyAddresses);
  const save = useServerFn(saveMyAddress);
  const remove = useServerFn(deleteMyAddress);
  const { data, isLoading } = useQuery({
    queryKey: ["my-addresses", user?.id],
    queryFn: () => load(),
    enabled: Boolean(user),
    retry: false,
  });
  const [draft, setDraft] = useState<Draft | null>(null);
  const [errors, setErrors] = useState<Partial<Record<keyof DeliveryValues, string>>>({});
  const [busy, setBusy] = useState(false);

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["my-addresses"] });

  function edit(a: SavedAddress) {
    setErrors({});
    setDraft({
      id: a.id,
      label: a.label,
      full_name: a.full_name,
      phone: a.phone,
      region: a.region,
      district: a.district,
      address_line: [a.area, a.address_line].filter(Boolean).join(", "),
      is_default: a.is_default,
    });
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!draft) return;
    const errs: typeof errors = {};
    if (!draft.region) errs.region = t.delivery.regionRequired;
    if (!draft.address_line.trim()) errs.address_line = t.delivery.areaRequired;
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setBusy(true);
    try {
      await save({
        data: {
          ...(draft.id ? { id: draft.id } : {}),
          label: draft.label,
          full_name: draft.full_name,
          phone: draft.phone,
          region: draft.region,
          district: draft.district,
          address_line: draft.address_line,
          is_default: draft.is_default,
        },
      });
      toast.success(t.addresses.saved);
      setDraft(null);
      await refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t.validation.failed);
    } finally {
      setBusy(false);
    }
  }

  async function onDelete(id: string) {
    try {
      await remove({ data: { id } });
      toast.success(t.addresses.deleted);
      await refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t.validation.failed);
    }
  }

  const addresses = data?.addresses ?? [];

  return (
    <AccountShell active="addresses" title={t.addresses.title}>
      {isLoading ? (
        <p className="text-sm text-muted-foreground">{t.common.loading}</p>
      ) : data && !data.available ? (
        <EmptyState icon={<MapPin className="h-6 w-6" />} title={t.addresses.unavailable} />
      ) : (
        <div className="space-y-4">
          {!draft && (
            <button
              type="button"
              className="btn-base btn-gold"
              onClick={() => setDraft({ ...EMPTY })}
            >
              <Plus className="h-4 w-4" />
              {t.addresses.add}
            </button>
          )}

          {draft && (
            <form onSubmit={onSubmit} className="panel space-y-4 p-4 md:p-5">
              <div className="grid gap-4 sm:grid-cols-3">
                <div>
                  <label className="field-label" htmlFor="a-label">
                    {t.addresses.label}
                  </label>
                  <input
                    id="a-label"
                    className="field-input"
                    placeholder={t.addresses.labelPlaceholder}
                    value={draft.label}
                    onChange={(e) => setDraft({ ...draft, label: e.target.value })}
                  />
                </div>
                <div>
                  <label className="field-label" htmlFor="a-name">
                    {t.account.fullName}
                  </label>
                  <input
                    id="a-name"
                    className="field-input"
                    value={draft.full_name}
                    onChange={(e) => setDraft({ ...draft, full_name: e.target.value })}
                  />
                </div>
                <div>
                  <label className="field-label" htmlFor="a-phone">
                    {t.account.phone}
                  </label>
                  <input
                    id="a-phone"
                    type="tel"
                    className="field-input"
                    value={draft.phone}
                    onChange={(e) => setDraft({ ...draft, phone: e.target.value })}
                  />
                </div>
              </div>
              <DeliveryFields
                value={draft}
                onChange={(v) => setDraft({ ...draft, ...v })}
                errors={errors}
                idPrefix="a"
              />
              <label className="flex cursor-pointer items-center gap-2 text-sm text-navy">
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-[var(--gold-ink)]"
                  checked={draft.is_default}
                  onChange={(e) => setDraft({ ...draft, is_default: e.target.checked })}
                />
                {t.addresses.makeDefault}
              </label>
              <div className="flex gap-2">
                <button type="submit" className="btn-base btn-gold" disabled={busy}>
                  {t.addresses.save}
                </button>
                <button
                  type="button"
                  className="btn-base btn-outline-navy"
                  onClick={() => setDraft(null)}
                >
                  {t.addresses.cancel}
                </button>
              </div>
            </form>
          )}

          {addresses.length === 0 && !draft ? (
            <EmptyState icon={<MapPin className="h-6 w-6" />} title={t.addresses.empty} />
          ) : (
            <ul className="grid gap-3 md:grid-cols-2">
              {addresses.map((a) => (
                <li key={a.id} className="panel flex flex-col p-4">
                  <p className="flex items-center gap-2 font-semibold text-navy">
                    <MapPin className="h-4 w-4" />
                    {a.label || a.region}
                    {a.is_default && (
                      <span className="status-pill tone-gold">{t.addresses.default}</span>
                    )}
                  </p>
                  <p className="mt-1 text-sm text-navy/80">
                    {[a.area, a.address_line, a.district, a.region].filter(Boolean).join(", ")}
                  </p>
                  {(a.full_name || a.phone) && (
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {[a.full_name, a.phone].filter(Boolean).join(" · ")}
                    </p>
                  )}
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      className="btn-base btn-ghost btn-sm"
                      onClick={() => edit(a)}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                      {t.addresses.edit}
                    </button>
                    {!a.is_default && (
                      <button
                        type="button"
                        className="btn-base btn-ghost btn-sm"
                        onClick={() =>
                          void save({
                            data: {
                              id: a.id,
                              label: a.label,
                              full_name: a.full_name,
                              phone: a.phone,
                              region: a.region,
                              district: a.district,
                              area: a.area,
                              address_line: a.address_line,
                              is_default: true,
                            },
                          }).then(refresh)
                        }
                      >
                        <Star className="h-3.5 w-3.5" />
                        {t.addresses.makeDefault}
                      </button>
                    )}
                    <button
                      type="button"
                      className="btn-base btn-ghost btn-sm text-danger"
                      onClick={() => void onDelete(a.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      {t.addresses.delete}
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </AccountShell>
  );
}
