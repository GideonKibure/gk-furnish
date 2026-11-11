/** Photo, or a video that plays on its own and starts again when it ends. */
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
  if (!url) return null;
  const video = kind === "video" || /\.(mp4|webm)(\?|$)/i.test(url);
  if (video) {
    return (
      <video
        src={url}
        className={className}
        autoPlay
        muted
        loop
        playsInline
        preload="metadata"
        aria-label={alt}
      />
    );
  }
  return <img src={url} alt={alt} className={className} width={960} height={720} decoding="async" />;
}
