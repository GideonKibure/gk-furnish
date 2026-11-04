import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

/** Muted looping video that loads when its card nears the screen and plays only while visible. */
export function ProductVideo({
  src,
  poster,
  active = true,
  className,
}: {
  src: string;
  poster?: string | undefined;
  active?: boolean;
  className?: string;
}) {
  const frameRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [near, setNear] = useState(false);

  useEffect(() => {
    const frame = frameRef.current;
    if (!frame || near) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) setNear(true);
      },
      { rootMargin: "300px 0px" },
    );
    observer.observe(frame);
    return () => observer.disconnect();
  }, [near]);

  useEffect(() => {
    const frame = frameRef.current;
    const video = videoRef.current;
    if (!frame || !video || !near) return;
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
  }, [src, active, near]);

  return (
    <div ref={frameRef} className={cn("h-full w-full", className)}>
      {near ? (
        <video
          ref={videoRef}
          src={src}
          poster={poster}
          muted
          loop
          playsInline
          preload="metadata"
          className="pointer-events-none h-full w-full object-cover"
        />
      ) : poster ? (
        <img src={poster} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover" />
      ) : null}
    </div>
  );
}
