import { Link2, MessageCircle } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

function FacebookIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className="h-4 w-4 fill-current">
      <path d="M13.5 21v-7.5h2.5l.4-3h-2.9V8.6c0-.9.3-1.5 1.5-1.5h1.5V4.4c-.3 0-1.2-.1-2.2-.1-2.2 0-3.7 1.3-3.7 3.8v2.4H8v3h2.6V21h2.9Z" />
    </svg>
  );
}

function XIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className="h-3.5 w-3.5 fill-current">
      <path d="M17.8 3h3.1l-6.8 7.7L22 21h-6.2l-4.9-6.4L5.3 21H2.2l7.2-8.3L2 3h6.4l4.4 5.8L17.8 3Zm-1.1 16.2h1.7L7.4 4.7H5.6l11.1 14.5Z" />
    </svg>
  );
}

export function ShareButtons({
  url,
  title,
  label,
  copyLabel,
  copiedLabel,
  className,
}: {
  url: string;
  title: string;
  label: string;
  copyLabel: string;
  copiedLabel: string;
  className?: string;
}) {
  const encoded = encodeURIComponent(url);
  const text = encodeURIComponent(title);
  const item = "icon-btn h-9 w-9 border border-border bg-white";
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <span className="text-sm font-medium text-muted-foreground">{label}:</span>
      <a
        className={item}
        href={`https://www.facebook.com/sharer/sharer.php?u=${encoded}`}
        target="_blank"
        rel="noreferrer"
        aria-label="Facebook"
      >
        <FacebookIcon />
      </a>
      <a
        className={item}
        href={`https://twitter.com/intent/tweet?url=${encoded}&text=${text}`}
        target="_blank"
        rel="noreferrer"
        aria-label="X"
      >
        <XIcon />
      </a>
      <a
        className={item}
        href={`https://wa.me/?text=${encodeURIComponent(`${title} ${url}`)}`}
        target="_blank"
        rel="noreferrer"
        aria-label="WhatsApp"
      >
        <MessageCircle className="h-4 w-4" />
      </a>
      <button
        type="button"
        className={item}
        aria-label={copyLabel}
        title={copyLabel}
        onClick={() => {
          void navigator.clipboard?.writeText(url).then(
            () => toast.success(copiedLabel),
            () => undefined,
          );
        }}
      >
        <Link2 className="h-4 w-4" />
      </button>
    </div>
  );
}
