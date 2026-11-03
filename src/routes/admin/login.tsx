import { createFileRoute, redirect } from "@tanstack/react-router";
import { z } from "zod";
import { safeNext } from "@/components/site/AuthCard";

export const Route = createFileRoute("/admin/login")({
  validateSearch: z.object({ next: z.string().optional() }),
  beforeLoad: ({ search }) => {
    throw redirect({ to: "/account/login", search: { next: safeNext(search.next, "/admin") }, replace: true });
  },
});
