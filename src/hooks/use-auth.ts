import type { Session, User } from "@supabase/supabase-js";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { loadSession } from "@/lib/session";

/** Current Supabase user in the browser; `ready` turns true once the stored session is read. */
export function useAuthUser() {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let alive = true;
    const settle = (session: Session | null) => {
      if (!alive) return;
      setUser(session?.user ?? null);
      setReady(true);
    };
    void loadSession().then(({ session, unknown }) => {
      if (!unknown) settle(session);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      // INITIAL_SESSION reports null on a network failure; loadSession above handles the first read.
      if (event !== "INITIAL_SESSION") settle(session);
    });
    return () => {
      alive = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  return { user, ready };
}
