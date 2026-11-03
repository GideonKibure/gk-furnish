import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/admin/forgot")({
  beforeLoad: () => {
    throw redirect({ to: "/account/forgot", replace: true });
  },
});
