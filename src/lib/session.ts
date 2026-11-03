import { isAuthRetryableFetchError } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

/**
 * Reads the stored browser session. `unknown` is true when the access token expired and the refresh
 * failed on a network error: the session is still stored and the auto-refresh will retry it, so this
 * must not be treated as signed out.
 */
export async function loadSession() {
  const { data, error } = await supabase.auth.getSession();
  return { session: data.session, unknown: !data.session && !!error && isAuthRetryableFetchError(error) };
}
