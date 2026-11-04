import { useLang } from "@/i18n/LanguageProvider";
import { TZ_REGIONS } from "@/lib/delivery";

export type DeliveryValues = { region: string; district: string; address_line: string };

/** Region / district / area inputs shared by checkout and the address book. */
export function DeliveryFields({
  value,
  onChange,
  errors = {},
  idPrefix = "d",
}: {
  value: DeliveryValues;
  onChange: (next: DeliveryValues) => void;
  errors?: Partial<Record<keyof DeliveryValues, string | undefined>>;
  idPrefix?: string;
}) {
  const { t } = useLang();
  const set = (key: keyof DeliveryValues) => (e: { target: { value: string } }) =>
    onChange({ ...value, [key]: e.target.value });
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <div>
        <label className="field-label" htmlFor={`${idPrefix}-region`}>
          {t.delivery.region} *
        </label>
        <select
          id={`${idPrefix}-region`}
          className="field-input"
          value={value.region}
          onChange={set("region")}
          aria-invalid={Boolean(errors.region)}
        >
          <option value="">{t.delivery.chooseRegion}</option>
          {TZ_REGIONS.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
        {errors.region && <p className="field-error">{errors.region}</p>}
      </div>
      <div>
        <label className="field-label" htmlFor={`${idPrefix}-district`}>
          {t.delivery.district}
        </label>
        <input
          id={`${idPrefix}-district`}
          className="field-input"
          autoComplete="address-level2"
          value={value.district}
          onChange={set("district")}
        />
      </div>
      <div className="sm:col-span-2">
        <label className="field-label" htmlFor={`${idPrefix}-area`}>
          {t.delivery.area} *
        </label>
        <input
          id={`${idPrefix}-area`}
          className="field-input"
          autoComplete="street-address"
          placeholder={t.delivery.areaPlaceholder}
          value={value.address_line}
          onChange={set("address_line")}
          aria-invalid={Boolean(errors.address_line)}
        />
        {errors.address_line && <p className="field-error">{errors.address_line}</p>}
      </div>
    </div>
  );
}
