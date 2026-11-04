import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Download, Mail, Phone, Users } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  AdminEmpty,
  AdminLoading,
  AdminPageHeader,
  DataTable,
  KpiCard,
  SearchInput,
  btn,
  formatDate,
  tzs,
  type Column,
} from "@/components/admin/admin-ui";
import { csvDate, downloadCsv } from "@/lib/ops/csv";
import { listAdminCustomers } from "@/lib/ops/customers.functions";

export const Route = createFileRoute("/admin/customers")({
  head: () => ({ meta: [{ title: "Customers — Admin" }, { name: "robots", content: "noindex" }] }),
  component: AdminCustomersPage,
});

type Row = Awaited<ReturnType<typeof listAdminCustomers>>[number];

function AdminCustomersPage() {
  const list = useServerFn(listAdminCustomers);
  const [rows, setRows] = useState<Row[] | null>(null);
  const [q, setQ] = useState("");

  useEffect(() => {
    list()
      .then(setRows)
      .catch((e) => toast.error(e instanceof Error ? e.message : "Load failed"));
  }, [list]);

  const shown = useMemo(() => {
    const term = q.trim().toLowerCase();
    const digits = term.replace(/\D/g, "");
    if (!rows || !term) return rows ?? [];
    return rows.filter(
      (c) =>
        (c.full_name ?? "").toLowerCase().includes(term) ||
        (c.email ?? "").toLowerCase().includes(term) ||
        (digits.length >= 3 && (c.phone ?? "").replace(/\D/g, "").includes(digits)),
    );
  }, [rows, q]);

  const withOrders = rows?.filter((c) => c.order_count > 0).length ?? 0;

  const columns: Column<Row>[] = [
    {
      key: "name",
      header: "Customer",
      cell: (c) => (
        <div className="min-w-0">
          <p className="truncate font-semibold text-navy">{c.full_name || "No name yet"}</p>
          <p className="truncate text-xs text-[#6B7280]">{c.email ?? "—"}</p>
        </div>
      ),
    },
    { key: "phone", header: "Phone", cell: (c) => c.phone ?? <span className="text-[#9CA3AF]">—</span> },
    { key: "location", header: "Location", className: "hidden xl:table-cell", cell: (c) => c.default_location ?? "—" },
    {
      key: "orders",
      header: "Orders",
      align: "right",
      cell: (c) =>
        c.order_count ? (
          <Link to="/admin/orders" search={{ q: c.phone || c.full_name || "" }} className="font-semibold text-[#B86A00] hover:underline">
            {c.order_count}
          </Link>
        ) : (
          <span className="text-[#9CA3AF]">0</span>
        ),
    },
    { key: "paid", header: "Paid", align: "right", cell: (c) => <span className="font-medium text-navy">{tzs(c.total_paid)}</span> },
    { key: "joined", header: "Joined", className: "hidden lg:table-cell", cell: (c) => formatDate(c.created_at) },
  ];

  return (
    <div>
      <AdminPageHeader
        title="Customers"
        description="People who created an account on the website. Guest checkouts appear only under Orders."
        action={
          <button
            type="button"
            className={btn("outline")}
            disabled={!shown.length}
            onClick={() =>
              downloadCsv(
                `gk-customers-${new Date().toISOString().slice(0, 10)}`,
                ["Name", "Email", "Phone", "Location", "Orders", "Paid (TSh)", "Last order", "Joined"],
                shown.map((c) => [
                  c.full_name,
                  c.email,
                  c.phone,
                  c.default_location,
                  c.order_count,
                  Math.round(c.total_paid),
                  csvDate(c.last_order_at),
                  csvDate(c.created_at),
                ]),
              )
            }
          >
            <Download className="h-4 w-4" /> Export CSV
          </button>
        }
      />

      {rows && (
        <div className="mb-4 grid gap-3 sm:grid-cols-3">
          <KpiCard label="Registered customers" value={rows.length} icon={<Users className="h-5 w-5" />} tone="navy" />
          <KpiCard label="Have ordered" value={withOrders} icon={<Users className="h-5 w-5" />} tone="success" />
          <KpiCard
            label="Paid by registered customers"
            value={tzs(rows.reduce((s, c) => s + c.total_paid, 0))}
            icon={<Users className="h-5 w-5" />}
            tone="gold"
          />
        </div>
      )}

      <SearchInput value={q} onChange={setQ} placeholder="Search name, email or phone" className="mb-4 max-w-md" />

      {!rows ? (
        <AdminLoading label="Loading customers…" />
      ) : (
        <DataTable
          rows={shown}
          columns={columns}
          rowKey={(c) => c.user_id}
          empty={<AdminEmpty title={rows.length ? "No customers match" : "No registered customers yet"} />}
          mobileCard={(c) => (
            <div>
              <div className="flex items-start justify-between gap-2">
                <p className="truncate font-semibold text-navy">{c.full_name || "No name yet"}</p>
                <p className="shrink-0 text-xs text-[#6B7280]">{c.order_count} orders</p>
              </div>
              <div className="mt-1 space-y-0.5 text-xs text-[#6B7280]">
                {c.email && (
                  <a href={`mailto:${c.email}`} className="flex items-center gap-1.5 hover:text-navy">
                    <Mail className="h-3.5 w-3.5" /> {c.email}
                  </a>
                )}
                {c.phone && (
                  <a href={`tel:${c.phone.replace(/[^\d+]/g, "")}`} className="flex items-center gap-1.5 hover:text-navy">
                    <Phone className="h-3.5 w-3.5" /> {c.phone}
                  </a>
                )}
              </div>
              <p className="mt-2 text-sm font-semibold text-navy">{tzs(c.total_paid)} paid</p>
            </div>
          )}
        />
      )}
    </div>
  );
}
