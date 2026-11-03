import { createFileRoute } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { useEffect } from "react";

export const Route = createFileRoute("/admin/reset")({
  head: () => ({ meta: [{ title: "New password — GK furnish" }, { name: "robots", content: "noindex" }] }),
  component: AdminResetRedirect,
});

/** Older reset emails link here. Nothing on this page may touch the Supabase client, or it would consume the recovery token before it is forwarded. */
function AdminResetRedirect() {
  useEffect(() => {
    window.location.replace(`/account/reset${window.location.search}${window.location.hash}`);
  }, []);
  return (
    <div className="grid min-h-dvh place-items-center">
      <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
    </div>
  );
}
