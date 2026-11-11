import { Copy } from "lucide-react";
import { toast } from "sonner";
import { formatAmount } from "@/config/site";
import { useLang } from "@/i18n/LanguageProvider";
import type { PayAccounts } from "@/lib/pay-accounts";

export function PayInstructions({
  accounts,
  channel,
  amount,
  orderNumber,
}: {
  accounts: PayAccounts;
  channel: "mobile" | "bank";
  amount: number;
  orderNumber?: string;
}) {
  const { t } = useLang();

  function copy(value: string) {
    void navigator.clipboard?.writeText(value).then(() => toast.success(t.track.copied));
  }

  const rows =
    channel === "bank"
      ? [
          {
            title: t.track.nmb,
            name: accounts.nmbName,
            account: accounts.nmbNumber,
            missing: t.track.nmbMissing,
          },
        ]
      : [
          { title: t.track.mpesaLipa, name: accounts.mpesaName, account: accounts.mpesaNumber, missing: "" },
          { title: t.track.airtel, name: accounts.airtelName, account: accounts.airtelNumber, missing: "" },
        ];

  return (
    <div className="mt-4 rounded-xl bg-sand p-4">
      <p className="text-sm text-navy">
        {t.track.amountDue}: <strong className="tabular-nums">{formatAmount(amount)}</strong>
      </p>
      {orderNumber ? (
        <p className="mt-1 text-sm text-navy">
          {t.track.orderNumber}: <strong>{orderNumber}</strong>
        </p>
      ) : null}
      <p className="mt-1 text-xs text-muted-foreground">{t.track.reference}</p>
      <ul className="mt-3 space-y-2">
        {rows.map((row) => (
          <li key={row.title} className="rounded-lg border border-border bg-white px-3 py-2.5 text-sm">
            <p className="font-semibold text-navy">{row.title}</p>
            {row.account ? (
              <>
                <p className="mt-1 text-navy">
                  {t.track.accountName}: {row.name}
                </p>
                <div className="mt-1 flex items-center justify-between gap-2">
                  <span className="font-semibold tabular-nums text-navy">{row.account}</span>
                  <button type="button" className="inline-flex items-center gap-1 text-xs font-semibold text-gold-ink" onClick={() => copy(row.account)}>
                    <Copy className="h-3.5 w-3.5" />
                    {t.track.copy}
                  </button>
                </div>
              </>
            ) : (
              <p className="mt-1 text-muted-foreground">{row.missing}</p>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
