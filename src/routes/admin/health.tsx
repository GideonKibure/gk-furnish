import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Activity } from "lucide-react";
import { useEffect, useState } from "react";
import { AdminCard, AdminPageHeader } from "@/components/admin/admin-ui";
import { getSystemHealth } from "@/lib/health.functions";

export const Route = createFileRoute("/admin/health")({
  head: () => ({ meta: [{ title: "System health — Admin" }, { name: "robots", content: "noindex" }] }),
  component: HealthPage,
});

function when(value: string | null) {
  if (!value) return "Not recorded yet";
  return new Date(value).toLocaleString("en-GB", { timeZone: "Africa/Dar_es_Salaam" });
}

function HealthPage() {
  const load = useServerFn(getSystemHealth);
  const [data, setData] = useState<Awaited<ReturnType<typeof getSystemHealth>> | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    void load()
      .then(setData)
      .catch((err) => setError(err instanceof Error ? err.message : "Could not load health"));
  }, [load]);

  const rows = data
    ? [
        ["Last Snippe webhook", when(data.snippeWebhook)],
        ["Last Snippe reconcile", when(data.snippeReconcile)],
        ["Last reminders run", when(data.reminders)],
        ["Payments needing review", String(data.needsReview)],
        ["Orders needing attention", String(data.needsAttention)],
      ]
    : [];

  return (
    <div>
      <AdminPageHeader title="System health" description="The last time each background job ran, and anything waiting for you." />
      <AdminCard hover={false}>
        <div className="mb-4 flex items-center gap-2 text-navy">
          <Activity className="h-4 w-4" />
          <h2 className="text-base font-semibold">Background jobs</h2>
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        {!data && !error && <p className="text-sm text-muted-foreground">Loading…</p>}
        {data && !data.heartbeatsReady && (
          <p className="mb-3 text-sm text-muted-foreground">Run drizzle/migrations/0029_hardening.sql to start recording job times.</p>
        )}
        <dl className="grid gap-3 sm:grid-cols-2">
          {rows.map(([label, value]) => (
            <div key={label} className="rounded-lg border border-border px-3 py-2">
              <dt className="text-xs text-muted-foreground">{label}</dt>
              <dd className="mt-1 text-sm font-semibold text-navy">{value}</dd>
            </div>
          ))}
        </dl>
      </AdminCard>
    </div>
  );
}
