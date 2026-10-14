import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Mail, Phone, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { AdminBadge, AdminCard, AdminEmpty, AdminPageHeader } from "@/components/admin/admin-ui";
import { deleteContactMessage, listContactMessages } from "@/lib/admin.functions";

export const Route = createFileRoute("/admin/messages")({
  head: () => ({ meta: [{ title: "Messages — Admin" }, { name: "robots", content: "noindex" }] }),
  component: AdminMessagesPage,
});

type Row = Awaited<ReturnType<typeof listContactMessages>>[number];

function AdminMessagesPage() {
  const list = useServerFn(listContactMessages);
  const remove = useServerFn(deleteContactMessage);
  const [rows, setRows] = useState<Row[]>([]);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function refresh() {
    setRows(await list());
  }

  useEffect(() => {
    refresh().catch((e) => toast.error(e instanceof Error ? e.message : "Load failed"));
  }, []);

  async function onDelete(id: string, name: string) {
    if (!confirm(`Delete the message from ${name}? This cannot be undone.`)) return;
    setDeletingId(id);
    try {
      await remove({ data: { id } });
      toast.success("Message deleted");
      await refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Delete failed");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div>
      <AdminPageHeader
        title="Messages"
        description="Notes sent through the contact form, newest first."
      />

      <div className="space-y-4">
        {rows.map((message) => (
          <AdminCard key={message.id}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="font-display text-lg text-navy">{message.name}</p>
                <p className="mt-1 text-sm text-muted-foreground">{new Date(message.created_at).toLocaleString()}</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {message.subject && <AdminBadge tone="gold">{message.subject}</AdminBadge>}
                <button
                  type="button"
                  onClick={() => onDelete(message.id, message.name)}
                  disabled={deletingId === message.id}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-destructive/30 px-3 py-2 text-sm font-semibold text-destructive transition-colors hover:bg-destructive/10 disabled:opacity-50"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  {deletingId === message.id ? "Deleting…" : "Delete"}
                </button>
              </div>
            </div>
            <p className="mt-4 whitespace-pre-line text-sm leading-relaxed text-navy">{message.message}</p>
            <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2 text-sm">
              {message.phone && (
                <a
                  href={`tel:${message.phone.replace(/[^\d+]/g, "")}`}
                  className="inline-flex items-center gap-1.5 font-semibold text-gold transition-colors hover:text-navy hover:underline"
                >
                  <Phone className="h-3.5 w-3.5" />
                  {message.phone}
                </a>
              )}
              {message.email && (
                <a
                  href={`mailto:${message.email}`}
                  className="inline-flex items-center gap-1.5 font-semibold text-gold transition-colors hover:text-navy hover:underline"
                >
                  <Mail className="h-3.5 w-3.5" />
                  {message.email}
                </a>
              )}
            </div>
          </AdminCard>
        ))}
        {!rows.length && <AdminEmpty>No messages yet.</AdminEmpty>}
      </div>
    </div>
  );
}
