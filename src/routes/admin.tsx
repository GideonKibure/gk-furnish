import { Outlet, createFileRoute, redirect, useRouterState } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { AdminShell } from "@/components/admin/AdminShell";
import { loadSession } from "@/lib/session";

/** Old admin auth URLs that now forward to the shared sign-in portal. */
const PUBLIC_ADMIN_PATHS = ["/admin/login", "/admin/forgot", "/admin/reset"];

export const Route = createFileRoute("/admin")({
  // The session lives in browser storage, so the guard can only decide in the browser.
  ssr: false,
  beforeLoad: async ({ location }) => {
    if (PUBLIC_ADMIN_PATHS.includes(location.pathname)) return;
    const { session, unknown } = await loadSession();
    if (unknown) throw new Error("Could not reach the sign-in service. Check your connection and try again.");
    if (!session) {
      throw redirect({ to: "/account/login", search: { next: location.href } });
    }
  },
  pendingComponent: AdminPending,
  component: AdminLayout,
});

function AdminPending() {
  return (
    <div className="grid min-h-dvh place-items-center">
      <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
    </div>
  );
}

function AdminLayout() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  if (PUBLIC_ADMIN_PATHS.includes(pathname)) return <Outlet />;
  return (
    <AdminShell>
      <Outlet />
    </AdminShell>
  );
}
