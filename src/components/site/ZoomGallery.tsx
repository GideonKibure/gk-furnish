import { ChevronLeft, ChevronRight, Maximize2, X, ZoomIn, ZoomOut } from "lucide-react";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
  type WheelEvent as ReactWheelEvent,
} from "react";
import { cn } from "@/lib/utils";

type GalleryImage = { src: string; label?: string };

function normalizeImages(images: string[] | GalleryImage[]): GalleryImage[] {
  return images.map((item) => (typeof item === "string" ? { src: item } : item)).filter((item) => Boolean(item.src));
}

/** Product gallery with hover magnifier, labeled angle thumbs, and a pan/zoom lightbox. */
export function ZoomGallery({
  images,
  alt,
  hint,
  viewsTitle,
  viewsHint,
}: {
  images: string[] | GalleryImage[];
  alt: string;
  hint?: string;
  viewsTitle?: string;
  viewsHint?: string;
}) {
  const items = normalizeImages(images);
  const [i, setI] = useState(0);
  const [zoom, setZoom] = useState<{ x: number; y: number } | null>(null);
  const [full, setFull] = useState(false);
  const n = items.length;
  const active = items[Math.min(i, Math.max(0, n - 1))] ?? items[0];
  const go = (d: number) => setI((v) => (v + d + n) % n);

  useEffect(() => {
    if (i >= n && n > 0) setI(0);
  }, [i, n]);

  function onMove(e: ReactMouseEvent<HTMLDivElement>) {
    const r = e.currentTarget.getBoundingClientRect();
    setZoom({
      x: ((e.clientX - r.left) / r.width) * 100,
      y: ((e.clientY - r.top) / r.height) * 100,
    });
  }

  return (
    <div className="zoom-gallery">
      <div
        className="group relative aspect-square overflow-hidden rounded-[1.75rem] bg-muted shadow-[var(--shadow-card)]"
        onMouseMove={onMove}
        onMouseLeave={() => setZoom(null)}
      >
        <button
          type="button"
          className="absolute inset-0 z-0 cursor-zoom-in"
          onClick={() => setFull(true)}
          aria-label="Open fullscreen gallery"
        >
          <img
            src={active?.src}
            alt={active?.label ? `${alt} — ${active.label}` : alt}
            className="h-full w-full object-cover transition-[transform,filter] duration-200 ease-out will-change-transform"
            style={
              zoom
                ? { transform: "scale(2.4)", transformOrigin: `${zoom.x}% ${zoom.y}%` }
                : { transform: "scale(1)" }
            }
            draggable={false}
          />
        </button>

        {active?.label && (
          <span className="pointer-events-none absolute left-3 top-3 z-[3] rounded-full bg-background/90 px-3 py-1 text-xs font-semibold text-navy shadow-sm backdrop-blur">
            {active.label}
          </span>
        )}

        {zoom && active?.src && (
          <div
            aria-hidden
            className="pointer-events-none absolute z-[1] hidden h-28 w-28 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white/90 shadow-[0_0_0_1px_rgba(20,33,61,0.25),0_12px_28px_-10px_rgba(0,0,0,0.45)] md:block"
            style={{
              left: `${zoom.x}%`,
              top: `${zoom.y}%`,
              backgroundImage: `url(${active.src})`,
              backgroundSize: "240% 240%",
              backgroundPosition: `${zoom.x}% ${zoom.y}%`,
            }}
          />
        )}

        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-[2] bg-gradient-to-t from-navy/50 to-transparent p-4 opacity-0 transition-opacity duration-300 group-hover:opacity-100 md:opacity-100">
          <p className="flex items-center gap-1.5 text-xs font-medium text-white/90">
            <ZoomIn className="h-3.5 w-3.5" />
            {hint ?? "Hover to zoom · tap for fullscreen"}
          </p>
        </div>

        <button
          type="button"
          onClick={() => setFull(true)}
          aria-label="Fullscreen"
          className="absolute right-3 top-3 z-[3] grid h-10 w-10 place-items-center rounded-full bg-background/90 text-navy shadow-sm backdrop-blur transition-transform hover:scale-105"
        >
          <Maximize2 className="h-4 w-4" />
        </button>

        {n > 1 && (
          <>
            <NavBtn
              side="left"
              className="z-[3] opacity-0 transition-opacity group-hover:opacity-100"
              onClick={() => go(-1)}
            />
            <NavBtn
              side="right"
              className="z-[3] opacity-0 transition-opacity group-hover:opacity-100"
              onClick={() => go(1)}
            />
          </>
        )}
      </div>

      {n > 0 && (
        <div className="mt-4">
          {(viewsTitle || n > 1) && (
            <div className="mb-2.5 flex flex-wrap items-end justify-between gap-2">
              <p className="text-sm font-semibold text-navy">{viewsTitle ?? "Product views"}</p>
              {viewsHint && n > 1 && <p className="text-xs text-muted-foreground">{viewsHint}</p>}
            </div>
          )}
          <div className={cn("grid gap-2.5", n >= 3 ? "grid-cols-3" : n === 2 ? "grid-cols-2" : "grid-cols-1 max-w-[9rem]")}>
            {items.map((item, k) => (
              <button
                key={`${item.src}-${k}`}
                type="button"
                onClick={() => setI(k)}
                aria-label={item.label ?? `Image ${k + 1}`}
                aria-current={k === i}
                className={cn(
                  "group/thumb overflow-hidden rounded-xl border-2 text-left transition-all duration-300",
                  k === i
                    ? "border-gold shadow-[var(--shadow-gold)]"
                    : "border-border/70 opacity-80 hover:border-gold/40 hover:opacity-100",
                )}
              >
                <div className="aspect-square overflow-hidden bg-muted">
                  <img
                    src={item.src}
                    alt=""
                    className="h-full w-full object-cover transition-transform duration-500 group-hover/thumb:scale-105"
                  />
                </div>
                {item.label && (
                  <span
                    className={cn(
                      "block px-2 py-1.5 text-center text-[0.7rem] font-semibold uppercase tracking-wider",
                      k === i ? "bg-gold-soft text-navy" : "bg-secondary/70 text-muted-foreground",
                    )}
                  >
                    {item.label}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      {full && (
        <Lightbox
          images={items.map((item) => item.src)}
          captions={items.map((item) => item.label ?? "")}
          index={i}
          onIndex={setI}
          onClose={() => setFull(false)}
          alt={alt}
        />
      )}
    </div>
  );
}

function NavBtn({
  side,
  onClick,
  className,
}: {
  side: "left" | "right";
  onClick: () => void;
  className?: string;
}) {
  const Icon = side === "left" ? ChevronLeft : ChevronRight;
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      aria-label={side === "left" ? "Previous" : "Next"}
      className={cn(
        "absolute top-1/2 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-full bg-background/90 text-navy shadow-sm backdrop-blur transition-transform hover:scale-105",
        side === "left" ? "left-3" : "right-3",
        className,
      )}
    >
      <Icon className="h-5 w-5" />
    </button>
  );
}

export function Lightbox({
  images,
  index,
  onIndex,
  onClose,
  alt,
  captions,
}: {
  images: string[];
  index: number;
  onIndex: (i: number) => void;
  onClose: () => void;
  alt: string;
  captions?: string[];
}) {
  const n = images.length;
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const drag = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null);
  const stageRef = useRef<HTMLDivElement>(null);

  const resetView = useCallback(() => {
    setScale(1);
    setOffset({ x: 0, y: 0 });
  }, []);

  const change = useCallback(
    (next: number) => {
      onIndex(((next % n) + n) % n);
      resetView();
    },
    [n, onIndex, resetView],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") change(index + 1);
      if (e.key === "ArrowLeft") change(index - 1);
      if (e.key === "+" || e.key === "=") setScale((s) => Math.min(4, s + 0.35));
      if (e.key === "-") setScale((s) => Math.max(1, s - 0.35));
      if (e.key === "0") resetView();
    };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [change, index, onClose, resetView]);

  function onWheel(e: ReactWheelEvent) {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.2 : 0.2;
    setScale((s) => {
      const next = Math.min(4, Math.max(1, s + delta));
      if (next <= 1) setOffset({ x: 0, y: 0 });
      return next;
    });
  }

  function onPointerDown(e: ReactPointerEvent) {
    if (scale <= 1) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { x: e.clientX, y: e.clientY, ox: offset.x, oy: offset.y };
  }

  function onPointerMove(e: ReactPointerEvent) {
    if (!drag.current) return;
    setOffset({
      x: drag.current.ox + (e.clientX - drag.current.x),
      y: drag.current.oy + (e.clientY - drag.current.y),
    });
  }

  function onPointerUp(e: ReactPointerEvent) {
    drag.current = null;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
  }

  function toggleZoom(e: ReactMouseEvent) {
    if (drag.current) return;
    if (scale > 1) {
      resetView();
      return;
    }
    const stage = stageRef.current?.getBoundingClientRect();
    if (!stage) {
      setScale(2.2);
      return;
    }
    const cx = e.clientX - stage.left - stage.width / 2;
    const cy = e.clientY - stage.top - stage.height / 2;
    setScale(2.4);
    setOffset({ x: -cx * 0.6, y: -cy * 0.6 });
  }

  return (
    <div className="fixed inset-0 z-[80] flex flex-col bg-ink/96 backdrop-blur-sm" role="dialog" aria-modal="true">
      <div className="flex items-center justify-between gap-3 px-4 py-3 text-primary-foreground">
        <p className="text-sm font-medium tabular-nums opacity-80">
          {captions?.[index] ?? `${index + 1} / ${n}`}
        </p>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="grid h-10 w-10 place-items-center rounded-full bg-white/10 transition-colors hover:bg-white/20"
            aria-label="Zoom out"
            onClick={() =>
              setScale((s) => {
                const next = Math.max(1, s - 0.4);
                if (next <= 1) setOffset({ x: 0, y: 0 });
                return next;
              })
            }
          >
            <ZoomOut className="h-4 w-4" />
          </button>
          <button
            type="button"
            className="grid h-10 w-10 place-items-center rounded-full bg-white/10 transition-colors hover:bg-white/20"
            aria-label="Zoom in"
            onClick={() => setScale((s) => Math.min(4, s + 0.4))}
          >
            <ZoomIn className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="grid h-10 w-10 place-items-center rounded-full bg-white/10 transition-colors hover:bg-white/20"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      </div>

      <div
        ref={stageRef}
        className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden px-2"
        onWheel={onWheel}
      >
        <img
          src={images[index]}
          alt={alt}
          onDoubleClick={toggleZoom}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          draggable={false}
          className={cn(
            "max-h-[min(78vh,900px)] max-w-[min(96vw,1100px)] select-none object-contain transition-transform duration-200 ease-out",
            scale > 1 ? "cursor-grab active:cursor-grabbing" : "cursor-zoom-in",
          )}
          style={{ transform: `translate3d(${offset.x}px, ${offset.y}px, 0) scale(${scale})` }}
        />
        {n > 1 && (
          <>
            <NavBtn side="left" className="!bg-white/15 !text-white hover:!bg-white/25" onClick={() => change(index - 1)} />
            <NavBtn side="right" className="!bg-white/15 !text-white hover:!bg-white/25" onClick={() => change(index + 1)} />
          </>
        )}
      </div>

      {n > 1 && (
        <div className="flex justify-center gap-2 overflow-x-auto px-4 py-3">
          {images.map((src, k) => (
            <button
              key={k}
              type="button"
              onClick={() => change(k)}
              className={cn(
                "h-14 w-14 shrink-0 overflow-hidden rounded-lg border-2 transition-opacity",
                k === index ? "border-gold opacity-100" : "border-transparent opacity-50 hover:opacity-90",
              )}
            >
              <img src={src} alt="" className="h-full w-full object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
