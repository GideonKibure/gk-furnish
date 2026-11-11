import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Clock3, Eye, Users } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  AdminCard,
  AdminEmpty,
  AdminLoading,
  AdminNotice,
  AdminPageHeader,
  DataTable,
  KpiCard,
  formatDate,
  type Column,
} from "@/components/admin/admin-ui";
import { listAdminVisits, type VisitRow } from "@/lib/visits.functions";

export const Route = createFileRoute("/admin/visits")({
  head: () => ({ meta: [{ title: "Visitors — Admin" }, { name: "robots", content: "noindex" }] }),
  component: AdminVisitsPage,
});

function todayInDar() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Dar_es_Salaam",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function formatStay(seconds: number) {
  const total = Math.max(0, Math.round(seconds));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const rest = total % 60;
  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m ${rest}s`;
  return `${rest}s`;
}

function AdminVisitsPage() {
  const load = useServerFn(listAdminVisits);
  const [day, setDay] = useState(todayInDar);
  const [report, setReport] = useState<Awaited<ReturnType<typeof listAdminVisits>> | null>(null);

  useEffect(() => {
    let alive = true;
    setReport(null);
    load({ data: { day } })
      .then((next) => {
        if (alive) setReport(next);
      })
      .catch((error) => {
        if (alive) toast.error(error instanceof Error ? error.message : "Could not load visits");
      });
    return () => {
      alive = false;
    };
  }, [day, load]);

  const columns: Column<VisitRow>[] = [
    {
      key: "who",
      header: "Visitor",
      cell: (row) => (
        <div className="min-w-0">
          <p className="truncate font-semibold text-navy">{row.name || "Guest"}</p>
          <p className="text-xs text-[#6B7280]">{row.visitor}</p>
        </div>
      ),
    },
    {
      key: "arrived",
      header: "Arrived",
      cell: (row) => <span className="whitespace-nowrap">{formatDate(row.startedAt, true)}</span>,
    },
    {
      key: "left",
      header: "Last seen",
      className: "hidden md:table-cell",
      cell: (row) => <span className="whitespace-nowrap">{formatDate(row.lastSeenAt, true)}</span>,
    },
    {
      key: "stay",
      header: "Time on site",
      cell: (row) => <span className="font-semibold tabular-nums text-navy">{formatStay(row.durationSeconds)}</span>,
    },
    {
      key: "path",
      header: "Last page",
      className: "hidden lg:table-cell",
      cell: (row) => <span className="text-[#374151]">{row.lastPath}</span>,
    },
  ];

  return (
    <div>
      <AdminPageHeader
        title="Visitors"
        description="People who opened the shop, and how long each visit stayed active. Admin pages are not counted. Only you can see this."
        action={
          <label className="text-sm font-semibold text-navy">
            Day
            <input
              type="date"
              className="ml-2 h-10 rounded-lg border border-[#E5E5E5] bg-white px-3 text-sm"
              value={day}
              max={todayInDar()}
              onChange={(event) => setDay(event.target.value || todayInDar())}
            />
          </label>
        }
      />
      {report && !report.available && <AdminNotice tone="pending">{report.reason}</AdminNotice>}
      {!report ? (
        <AdminLoading label="Loading visits…" />
      ) : (
        <>
          <div className="mb-4 grid gap-3 sm:grid-cols-3">
            <KpiCard label="People" value={report.visitors} hint="Different browsers on this day" icon={<Users className="h-5 w-5" />} />
            <KpiCard label="Visits" value={report.visits} hint="A new visit starts after 30 minutes away" icon={<Eye className="h-5 w-5" />} />
            <KpiCard label="Average stay" value={formatStay(report.averageSeconds)} hint="Active time, not time with the tab hidden" icon={<Clock3 className="h-5 w-5" />} />
          </div>
          <AdminCard hover={false} className="overflow-hidden p-0">
            <DataTable
              columns={columns}
              rows={report.rows}
              rowKey={(row) => row.id}
              mobileCard={(row) => (
                <div>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-navy">{row.name || "Guest"}</p>
                      <p className="text-xs text-[#6B7280]">{row.visitor}</p>
                    </div>
                    <p className="font-semibold tabular-nums text-navy">{formatStay(row.durationSeconds)}</p>
                  </div>
                  <p className="mt-2 text-xs text-[#6B7280]">
                    {formatDate(row.startedAt, true)} · {row.lastPath}
                  </p>
                </div>
              )}
              empty={<AdminEmpty title="No visits on this day">Visits appear after someone opens the shop.</AdminEmpty>}
            />
          </AdminCard>
        </>
      )}
    </div>
  );
}
