import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Mail, Phone } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { AdminBadge, AdminCard, AdminEmpty, AdminPageHeader } from "@/components/admin/admin-ui";
import { listContactMessages } from "@/lib/admin.functions";

export const Route = createFileRoute("/admin/messages")({
  head: () => ({ meta: [{ title: "Messages — Admin" }, { name: "robots", content: "noindex" }] }),
  component: AdminMessagesPage,
});

type Row = Awaited<ReturnType<typeof listContactMessages>>[number];

function AdminMessagesPage() {
  const list = useServerFn(listContactMessages);
  const [rows, setRows] = useState<Row[]>([]);

  useEffect(() => {
    list()
      .then(setRows)
      .catch((e) => toast.error(e instanceof Error ? e.message : "Load failed"));
  }, [list]);

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
              {message.subject && <AdminBadge tone="gold">{message.subject}</AdminBadge>}
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
