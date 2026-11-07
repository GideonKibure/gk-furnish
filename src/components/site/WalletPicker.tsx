import { WALLETS, type WalletId } from "@/lib/palmpesa";
import { cn } from "@/lib/utils";

const TONE: Record<WalletId, string> = {
  mpesa: "border-[#E60000] bg-[#FFF5F5]",
  airtel: "border-[#ED1C24] bg-[#FFF1F1]",
  yas: "border-[#F5B800] bg-[#FFF8E1]",
  halopesa: "border-[#F58220] bg-[#FFF4EB]",
};

/** Four mobile-money choices. The PIN is entered on the phone, not on this page. */
export function WalletPicker({
  value,
  onChange,
  label,
}: {
  value: WalletId;
  onChange: (wallet: WalletId) => void;
  label: string;
}) {
  return (
    <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label={label}>
      {WALLETS.map((wallet) => {
        const selected = value === wallet.id;
        return (
          <button
            key={wallet.id}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(wallet.id)}
            className={cn(
              "rounded-lg border px-3 py-3 text-left text-sm font-semibold text-navy transition-colors",
              selected ? TONE[wallet.id] : "border-input bg-white hover:border-navy/30",
            )}
          >
            {wallet.label}
          </button>
        );
      })}
    </div>
  );
}
