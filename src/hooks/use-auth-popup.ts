import { createContext, useContext } from "react";

export type AuthMode = "signin" | "signup" | "forgot";
export type AuthReason = "auto" | "favourite" | "account" | "checkout";

export type OpenAuthOptions = {
  mode?: AuthMode;
  reason?: AuthReason;
  productId?: string;
  onDismiss?: () => void;
};

type AuthPopupApi = {
  open: (options?: OpenAuthOptions) => void;
};

export const AuthPopupContext = createContext<AuthPopupApi | null>(null);

/** Opens the shared sign-in popup. Safe to call outside the shop provider. */
export function useAuthPopup(): AuthPopupApi {
  const api = useContext(AuthPopupContext);
  if (!api) return { open: () => {} };
  return api;
}
