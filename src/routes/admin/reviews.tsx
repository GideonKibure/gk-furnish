import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Check, Star, Trash2, X } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  AdminCard,
  AdminEmpty,
  AdminLoading,
  AdminNotice,
  AdminPageHeader,
  StatusPill,
  StatusTabs,
  btn,
  formatDate,
} from "@/components/admin/admin-ui";
import { deleteAdminReview, listAdminReviews, setAdminReviewStatus } from "@/lib/ops/catalogue.functions";
import { humanize, reviewTone } from "@/lib/ops/status";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/admin/reviews")({
  head: () => ({ meta: [{ title: "Reviews — Admin" }, { name: "robots", content: "noindex" }] }),
  component: AdminReviewsPage,
});

type Data = Awaited<ReturnType<typeof listAdminReviews>>;
type Row = Data["rows"][number];
type Tab = "pending" | "approved" | "rejected" | "all";

function Stars({ value }: { value: number }) {
  return (
    <span className="inline-flex items-center gap-0.5" aria-label={`${value} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Star key={n} className={cn("h-4 w-4", n <= value ? "fill-gold text-gold" : "text-[#D1D5DB]")} />
      ))}
    </span>
  );
}

function AdminReviewsPage() {
  const list = useServerFn(listAdminReviews);
  const setStatus = useServerFn(setAdminReviewStatus);
  const remove = useServerFn(deleteAdminReview);
  const [data, setData] = useState<Data | null>(null);
  const [tab, setTab] = useState<Tab>("pending");
  const [busyId, setBusyId] = useState<string | null>(null);

  async function refresh() {
    setData(await list());
  }

  useEffect(() => {
    refresh().catch((e) => toast.error(e instanceof Error ? e.message : "Load failed"));
  }, []);

  async function act(r: Row, task: () => Promise<unknown>, success: string) {
    setBusyId(r.id);
    try {
      await task();
      toast.success(success);
      await refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "That did not work");
    } finally {
      setBusyId(null);
    }
  }

  const rows = data?.rows ?? [];
  const tabs = (["pending", "approved", "rejected", "all"] as const).map((id) => ({
    id,
    label: id === "all" ? "All" : humanize(id),
    count: id === "all" ? rows.length : rows.filter((r) => r.status === id).length,
  }));
  const shown = tab === "all" ? rows : rows.filter((r) => r.status === tab);

  return (
    <div>
      <AdminPageHeader
        title="Reviews"
        description="Customer reviews appear on product pages only after you approve them."
      />

      {!data ? (
        <AdminLoading label="Loading reviews…" />
      ) : !data.available ? (
        <AdminEmpty title="Reviews are not switched on yet" icon={<Star className="h-5 w-5" />}>
          {data.reason}
        </AdminEmpty>
      ) : (
        <>
          <StatusTabs tabs={tabs} value={tab} onChange={setTab} className="mb-4" />
          {!shown.length ? (
            <AdminEmpty title={tab === "pending" ? "Nothing waiting for review" : "No reviews here"} icon={<Star className="h-5 w-5" />} />
          ) : (
            <div className="grid gap-3 lg:grid-cols-2">
              {shown.map((r) => {
                const product = r.products as { name: string; slug: string } | null;
                return (
                  <AdminCard key={r.id}>
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-navy">{product?.name ?? "Product removed"}</p>
                        <p className="text-xs text-[#6B7280]">
                          {r.author_name} · {formatDate(r.created_at)}
                          {r.order_number ? ` · Order #${r.order_number}` : ""}
                        </p>
                      </div>
                      <StatusPill tone={reviewTone(r.status)}>{humanize(r.status)}</StatusPill>
                    </div>
                    <div className="mt-2">
                      <Stars value={r.rating} />
                    </div>
                    {r.title && <p className="mt-2 font-semibold text-navy">{r.title}</p>}
                    {r.body && <p className="mt-1 whitespace-pre-line text-sm text-[#374151]">{r.body}</p>}
                    {r.order_id && (
                      <div className="mt-2">
                        <StatusPill tone="info">Verified purchase</StatusPill>
                      </div>
                    )}
                    <div className="mt-4 flex flex-wrap gap-2 border-t border-[#F0F0F0] pt-3">
                      {r.status !== "approved" && (
                        <button
                          type="button"
                          className={btn("gold", "sm")}
                          disabled={busyId === r.id}
                          onClick={() => void act(r, () => setStatus({ data: { id: r.id, status: "approved" } }), "Review approved")}
                        >
                          <Check className="h-3.5 w-3.5" /> Approve
                        </button>
                      )}
                      {r.status !== "rejected" && (
                        <button
                          type="button"
                          className={btn("outline", "sm")}
                          disabled={busyId === r.id}
                          onClick={() => void act(r, () => setStatus({ data: { id: r.id, status: "rejected" } }), "Review rejected")}
                        >
                          <X className="h-3.5 w-3.5" /> Reject
                        </button>
                      )}
                      <button
                        type="button"
                        className={btn("danger", "sm", "ml-auto")}
                        disabled={busyId === r.id}
                        onClick={() => {
                          if (confirm("Delete this review permanently?")) {
                            void act(r, () => remove({ data: { id: r.id } }), "Review deleted");
                          }
                        }}
                        aria-label="Delete review"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </AdminCard>
                );
              })}
            </div>
          )}
          {tab === "pending" && tabs[0]!.count > 0 && (
            <div className="mt-4">
              <AdminNotice>Approved reviews count towards the star rating shown in the shop.</AdminNotice>
            </div>
          )}
        </>
      )}
    </div>
  );
}
