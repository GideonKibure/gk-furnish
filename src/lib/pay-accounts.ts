/** Shown until the owner saves different details in Site settings. */
export const DEFAULT_PAY_ACCOUNTS = {
  mpesaNumber: "3456672",
  mpesaName: "Gideon Joseph Kibure",
  nmbNumber: "",
  nmbName: "Gideon Joseph Kibure",
  airtelNumber: "0692713993",
  airtelName: "GideonJoseph Kibure",
} as const;

export type PayAccounts = {
  mpesaNumber: string;
  mpesaName: string;
  nmbNumber: string;
  nmbName: string;
  airtelNumber: string;
  airtelName: string;
};

export function payAccountsFrom(row: {
  mpesa_lipa_number?: string | null;
  mpesa_lipa_name?: string | null;
  nmb_account_number?: string | null;
  nmb_account_name?: string | null;
  airtel_number?: string | null;
  airtel_name?: string | null;
} | null | undefined): PayAccounts {
  return {
    mpesaNumber: row?.mpesa_lipa_number?.trim() || DEFAULT_PAY_ACCOUNTS.mpesaNumber,
    mpesaName: row?.mpesa_lipa_name?.trim() || DEFAULT_PAY_ACCOUNTS.mpesaName,
    nmbNumber: row?.nmb_account_number?.trim() || "",
    nmbName: row?.nmb_account_name?.trim() || DEFAULT_PAY_ACCOUNTS.nmbName,
    airtelNumber: row?.airtel_number?.trim() || DEFAULT_PAY_ACCOUNTS.airtelNumber,
    airtelName: row?.airtel_name?.trim() || DEFAULT_PAY_ACCOUNTS.airtelName,
  };
}
