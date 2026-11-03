import { Outlet, createFileRoute, redirect, useRouterState } from "@tanstack/react-router";
import { AdminShell } from "@/components/admin/AdminShell";
import { supabase } from "@/integrations/supabase/client";

/** Old admin auth URLs that now forward to the shared sign-in portal. */
const PUBLIC_ADMIN_PATHS = ["/admin/login", "/admin/forgot", "/admin/reset"];

export const Route = createFileRoute("/admin")({
  beforeLoad: async ({ location }) => {
    if (PUBLIC_ADMIN_PATHS.includes(location.pathname)) return;
    const { data } = await supabase.auth.getSession();
    if (!data.session) {
      throw redirect({ to: "/account/login", search: { next: location.href } });
    }
  },
  component: AdminLayout,
});

function AdminLayout() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  if (PUBLIC_ADMIN_PATHS.includes(pathname)) return <Outlet />;
  return (
    <AdminShell>
      <Outlet />
    </AdminShell>
  );
}
