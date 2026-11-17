import { useState } from "react";
import { useLang } from "@/i18n/LanguageProvider";
import { cn } from "@/lib/utils";

/** Photo, or a video that loads only after the customer taps play. */
export function ServiceMedia({
  url,
  kind,
  alt,
  className,
}: {
  url: string | null;
  kind: "image" | "video" | null;
  alt: string;
  className?: string;
}) {
  const { t } = useLang();
  const [play, setPlay] = useState(false);
  if (!url) return null;
  const video = kind === "video" || /\.(mp4|webm)(\?|$)/i.test(url);
  if (video && !play) {
    return (
      <button
        type="button"
        onClick={() => setPlay(true)}
        aria-label={t.pdp.video}
        className={cn("grid min-h-11 place-items-center bg-navy text-white", className)}
      >
        <span className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-navy">
          {t.pdp.video}
        </span>
      </button>
    );
  }
  if (video) {
    return (
      <video
        src={url}
        className={className}
        controls
        playsInline
        preload="metadata"
        aria-label={alt}
      />
    );
  }
  return (
    <img
      src={url}
      alt={alt}
      className={className}
      width={960}
      height={720}
      loading="lazy"
      decoding="async"
    />
  );
}
