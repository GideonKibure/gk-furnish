import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

/** Muted looping video that plays only while its card is on screen. */
export function ProductVideo({ src, active = true, className }: { src: string; active?: boolean; className?: string }) {
  const frameRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const frame = frameRef.current;
    const video = videoRef.current;
    if (!frame || !video) return;
    if (!active) {
      video.pause();
      return;
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) video.play().catch(() => undefined);
        else video.pause();
      },
      { threshold: 0.4 },
    );
    observer.observe(frame);
    return () => observer.disconnect();
  }, [src, active]);

  return (
    <div ref={frameRef} className={cn("h-full w-full", className)}>
      <video
        ref={videoRef}
        src={src}
        muted
        loop
        playsInline
        preload="metadata"
        className="pointer-events-none h-full w-full object-cover"
      />
    </div>
  );
}
