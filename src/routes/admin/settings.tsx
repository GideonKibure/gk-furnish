import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { MapPin, Phone, Share2, Wallet } from "lucide-react";
import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { toast } from "sonner";
import { AdminCard, AdminPageHeader } from "@/components/admin/admin-ui";
import { getAdminSiteSettings, updateAdminSiteSettings, updateAdvanceTiers } from "@/lib/content.functions";
import { DEFAULT_PAY_ACCOUNTS } from "@/lib/pay-accounts";
import { advanceSettingsFrom } from "@/lib/payment-policy";
import { DEFAULT_COMPLETION_HOURS } from "@/lib/site-content";

export const Route = createFileRoute("/admin/settings")({
  head: () => ({ meta: [{ title: "Site settings — Admin" }, { name: "robots", content: "noindex" }] }),
  component: AdminSettingsPage,
});

function SettingsGroup({
  icon,
  title,
  description,
  children,
}: {
  icon: ReactNode;
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <AdminCard hover={false} className="space-y-4">
      <div className="flex items-start gap-3 border-b border-border/70 pb-4">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-gold-soft text-[#B86A00]">{icon}</span>
        <div>
          <h2 className="text-base font-semibold text-navy">{title}</h2>
          <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">{children}</div>
    </AdminCard>
  );
}

function Field({
  name,
  label,
  value,
  span,
}: {
  name: string;
  label: string;
  value: string | null | undefined;
  span?: boolean;
}) {
  return (
    <div className={span ? "sm:col-span-2" : undefined}>
      <label className="field-label" htmlFor={name}>
        {label}
      </label>
      <input id={name} name={name} className="field-input" defaultValue={value ?? ""} />
    </div>
  );
}

function AdminSettingsPage() {
  const load = useServerFn(getAdminSiteSettings);
  const save = useServerFn(updateAdminSiteSettings);
  const [row, setRow] = useState<Awaited<ReturnType<typeof load>> | null>(null);
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    load()
      .then(setRow)
      .catch((e) => toast.error(e instanceof Error ? e.message : "Load failed"))
      .finally(() => setLoaded(true));
  }, []);

  async function onSave(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setBusy(true);
    try {
      const updated = await save({
        data: {
          phone_display: String(fd.get("phone_display") ?? ""),
          phone_dial: String(fd.get("phone_dial") ?? ""),
          whatsapp_number: String(fd.get("whatsapp_number") ?? ""),
          email: String(fd.get("email") ?? ""),
          location: String(fd.get("location") ?? ""),
          tagline: String(fd.get("tagline") ?? ""),
          instagram_url: String(fd.get("instagram_url") ?? ""),
          facebook_url: String(fd.get("facebook_url") ?? ""),
          tiktok_url: String(fd.get("tiktok_url") ?? ""),
          ...(fd.has("collection_address") ? { collection_address: String(fd.get("collection_address") ?? "") } : {}),
          mpesa_lipa_number: String(fd.get("mpesa_lipa_number") ?? ""),
          mpesa_lipa_name: String(fd.get("mpesa_lipa_name") ?? ""),
          nmb_account_number: String(fd.get("nmb_account_number") ?? ""),
          nmb_account_name: String(fd.get("nmb_account_name") ?? ""),
          airtel_number: String(fd.get("airtel_number") ?? ""),
          airtel_name: String(fd.get("airtel_name") ?? ""),
          mpesa_enabled: fd.get("mpesa_enabled") === "on",
          airtel_enabled: fd.get("airtel_enabled") === "on",
          nmb_enabled: fd.get("nmb_enabled") === "on",
          order_completion_hours: Math.min(720, Math.max(1, Math.round(Number(fd.get("order_completion_hours")) || DEFAULT_COMPLETION_HOURS))),
        },
      });
      setRow(updated);
      toast.success("Settings saved");
      if (updated.mpesa_enabled === undefined) {
        toast.info("The payment switches were not saved. Run drizzle/migrations/0017_payment_method_toggles.sql in the Supabase SQL editor.", { duration: 10000 });
      }
      if (updated.order_completion_hours === undefined) {
        toast.info("The completion time was not saved. Run drizzle/migrations/0021_order_completion_hours.sql in the Supabase SQL editor.", { duration: 10000 });
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Save failed");
    } finally {
      setBusy(false);
    }
  }

  if (!row) {
    if (loaded) {
      return (
        <div>
          <AdminPageHeader title="Site settings" description="Contact details and social links used across the site." />
          <AdminCard hover={false}>
            <p className="text-sm text-muted-foreground">No settings row was found.</p>
          </AdminCard>
        </div>
      );
    }
    return (
      <div>
        <AdminPageHeader title="Site settings" description="Contact details and social links used across the site." />
        <AdminCard hover={false}>
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <span className="h-2 w-2 animate-pulse rounded-full bg-gold" />
            Loading settings…
          </p>
        </AdminCard>
      </div>
    );
  }

  return (
    <div>
      <AdminPageHeader
        title="Site settings"
        description="Contact details and social links used across the storefront and footer."
      />

      <form onSubmit={onSave} className="space-y-5">
        <SettingsGroup
          icon={<Phone className="h-4 w-4" />}
          title="Contact"
          description="Phone, WhatsApp and email shown to customers."
        >
          <Field name="phone_display" label="Phone display" value={row.phone_display} />
          <Field name="phone_dial" label="Phone dial (tel:)" value={row.phone_dial} />
          <Field name="whatsapp_number" label="WhatsApp number (255…)" value={row.whatsapp_number} />
          <Field name="email" label="Email" value={row.email} />
        </SettingsGroup>

        <SettingsGroup
          icon={<MapPin className="h-4 w-4" />}
          title="Brand & location"
          description="Workshop location and the tagline under your logo."
        >
          <Field name="location" label="Location" value={row.location} span />
          <Field name="tagline" label="Tagline" value={row.tagline} span />
          {row.collection_address !== undefined && (
            <Field name="collection_address" label="Collection address (shown for collection orders)" value={row.collection_address} span />
          )}
          <div className="sm:col-span-2">
            <label className="field-label" htmlFor="order_completion_hours">
              Order completion time (hours)
            </label>
            <input
              id="order_completion_hours"
              name="order_completion_hours"
              type="number"
              min={1}
              max={720}
              step={1}
              className="field-input max-w-xs"
              defaultValue={row.order_completion_hours ?? DEFAULT_COMPLETION_HOURS}
            />
            <p className="mt-1 text-xs text-muted-foreground">Shown on checkout, the order confirmation, and the FAQ. 48 means within 48 hours.</p>
          </div>
        </SettingsGroup>

        <SettingsGroup
          icon={<Wallet className="h-4 w-4" />}
          title="Payment accounts"
          description="Turn a method off to hide it from checkout and the order page. Leave the NMB number blank until you have it."
        >
          <label className="flex items-center gap-2 text-sm font-semibold text-navy sm:col-span-2">
            <input type="checkbox" name="mpesa_enabled" defaultChecked={row.mpesa_enabled !== false} className="h-4 w-4 accent-[#14213D]" />
            Show M-Pesa Lipa on the site
          </label>
          <Field name="mpesa_lipa_number" label="M-Pesa Lipa number" value={row.mpesa_lipa_number || DEFAULT_PAY_ACCOUNTS.mpesaNumber} />
          <Field name="mpesa_lipa_name" label="M-Pesa Lipa name" value={row.mpesa_lipa_name || DEFAULT_PAY_ACCOUNTS.mpesaName} />
          <label className="flex items-center gap-2 text-sm font-semibold text-navy sm:col-span-2">
            <input type="checkbox" name="airtel_enabled" defaultChecked={row.airtel_enabled !== false} className="h-4 w-4 accent-[#14213D]" />
            Show Airtel Money on the site
          </label>
          <Field name="airtel_number" label="Airtel number" value={row.airtel_number || DEFAULT_PAY_ACCOUNTS.airtelNumber} />
          <Field name="airtel_name" label="Airtel name" value={row.airtel_name || DEFAULT_PAY_ACCOUNTS.airtelName} />
          <label className="flex items-center gap-2 text-sm font-semibold text-navy sm:col-span-2">
            <input type="checkbox" name="nmb_enabled" defaultChecked={row.nmb_enabled !== false} className="h-4 w-4 accent-[#14213D]" />
            Show NMB bank on the site
          </label>
          <Field name="nmb_account_number" label="NMB account number" value={row.nmb_account_number} />
          <Field name="nmb_account_name" label="NMB account name" value={row.nmb_account_name || DEFAULT_PAY_ACCOUNTS.nmbName} />
        </SettingsGroup>

        <SettingsGroup
          icon={<Share2 className="h-4 w-4" />}
          title="Social links"
          description="Full URLs for Instagram, Facebook and TikTok."
        >
          <Field name="instagram_url" label="Instagram URL" value={row.instagram_url} span />
          <Field name="facebook_url" label="Facebook URL" value={row.facebook_url} span />
          <Field name="tiktok_url" label="TikTok URL" value={row.tiktok_url} span />
        </SettingsGroup>

        <button type="submit" className="btn-base btn-gold" disabled={busy}>
          {busy ? "Saving…" : "Save settings"}
        </button>
      </form>

      <AdvanceTiersForm row={row} onSaved={setRow} />
    </div>
  );
}

function AdvanceTiersForm({
  row,
  onSaved,
}: {
  row: NonNullable<Awaited<ReturnType<typeof getAdminSiteSettings>>>;
  onSaved: (row: NonNullable<Awaited<ReturnType<typeof getAdminSiteSettings>>>) => void;
}) {
  const save = useServerFn(updateAdvanceTiers);
  const [busy, setBusy] = useState(false);
  const s = advanceSettingsFrom(row);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const n = (k: string) => Number(fd.get(k) ?? 0);
    setBusy(true);
    try {
      const updated = await save({
        data: {
          advance_standard_percent: n("advance_standard_percent"),
          advance_custom_percent: n("advance_custom_percent"),
          advance_large_percent: n("advance_large_percent"),
          advance_expensive_from: n("advance_expensive_from"),
          advance_large_from: n("advance_large_from"),
          advance_large_items: n("advance_large_items"),
        },
      });
      onSaved(updated);
      toast.success("Advance tiers saved");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Save failed. Has the 0006 database update been run?");
    } finally {
      setBusy(false);
    }
  }

  const numberField = (name: string, label: string, value: number, hint?: string) => (
    <div>
      <label className="field-label" htmlFor={name}>
        {label}
      </label>
      <input id={name} name={name} type="number" min={0} className="field-input" defaultValue={value} />
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );

  return (
    <form onSubmit={onSubmit} className="mt-8 space-y-5">
      <SettingsGroup
        icon={<Wallet className="h-4 w-4" />}
        title="Advance payment tiers"
        description="Production starts only after the advance is paid. The tier is chosen automatically for every order and quote."
      >
        {numberField("advance_standard_percent", "Standard orders (%)", s.standardPercent)}
        {numberField("advance_custom_percent", "Custom and expensive orders (%)", s.customPercent)}
        {numberField("advance_large_percent", "Large orders (%)", s.largePercent)}
        {numberField("advance_expensive_from", "Expensive from (TSh)", s.expensiveFrom, "Orders at or above this total use the custom tier.")}
        {numberField("advance_large_from", "Large order from (TSh)", s.largeFrom, "Orders at or above this total use the large tier.")}
        {numberField("advance_large_items", "Large order from (items)", s.largeItems, "Or this many pieces in one order.")}
      </SettingsGroup>
      <button type="submit" className="btn-base btn-gold" disabled={busy}>
        {busy ? "Saving…" : "Save advance tiers"}
      </button>
    </form>
  );
}
