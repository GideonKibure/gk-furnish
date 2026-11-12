import { useNavigate } from "@tanstack/react-router";
import { useEffect, useRef } from "react";
import { useAuthPopup } from "@/hooks/use-auth-popup";
import { useAuthUser } from "@/hooks/use-auth";

/** Asks a signed-out visitor to sign in, and leaves the account page if they decline. */
export function useRequireCustomer() {
  const { user, ready } = useAuthUser();
  const { open } = useAuthPopup();
  const nav = useNavigate();
  const asked = useRef(false);
  useEffect(() => {
    if (!ready || user || asked.current) return;
    asked.current = true;
    open({
      reason: "account",
      mode: "signin",
      onDismiss: () => {
        void nav({ to: "/", replace: true });
      },
    });
  }, [ready, user, open, nav]);
  return { user, ready };
}
