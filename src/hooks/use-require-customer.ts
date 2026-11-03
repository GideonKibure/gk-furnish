import { useNavigate } from "@tanstack/react-router";
import { useEffect, useRef } from "react";
import { useAuthUser } from "@/hooks/use-auth";

/** Sends signed-out visitors to the login page once, and back to this page after signing in. */
export function useRequireCustomer() {
  const { user, ready } = useAuthUser();
  const nav = useNavigate();
  const redirected = useRef(false);
  useEffect(() => {
    if (!ready || user || redirected.current) return;
    redirected.current = true;
    const here = `${window.location.pathname}${window.location.search}`;
    void nav({ to: "/account/login", search: { next: here }, replace: true });
  }, [ready, user]);
  return { user, ready };
}
