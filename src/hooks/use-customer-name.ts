import type { User } from "@supabase/supabase-js";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useAuthUser } from "@/hooks/use-auth";
import { getMyProfile } from "@/lib/account.functions";

/** Name stored at sign-up or by Google, before the profile row has loaded. */
export function sessionName(user: User | null): string {
  if (!user) return "";
  const meta = user.user_metadata;
  const named = meta["full_name"] ?? meta["name"];
  if (typeof named === "string" && named.trim()) return named.trim();
  return user.email?.split("@")[0] ?? "";
}

/** First letter of the customer's name, for the gold profile mark. */
export function nameLetter(name: string): string {
  const letter = [...name.trim()][0];
  return letter ? letter.toUpperCase() : "G";
}

export function useCustomerName() {
  const { user, ready } = useAuthUser();
  const loadProfile = useServerFn(getMyProfile);
  const { data } = useQuery({
    queryKey: ["my-profile", user?.id],
    queryFn: () => loadProfile(),
    enabled: Boolean(user),
    staleTime: 5 * 60_000,
  });
  const name = (data?.full_name?.trim() || sessionName(user)).trim();
  return { user, ready, name, letter: nameLetter(name) };
}
