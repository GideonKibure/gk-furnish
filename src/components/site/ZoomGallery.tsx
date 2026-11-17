import { ChevronLeft, ChevronRight, Maximize2, Play, X, ZoomIn, ZoomOut } from "lucide-react";
import { ProductVideo } from "./ProductVideo";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
  type WheelEvent as ReactWheelEvent,
} from "react";
import { fill } from "@/i18n/fill";
import { useLang } from "@/i18n/LanguageProvider";
import { cycleTab, tabbable } from "@/lib/dialog-focus";
import { cn } from "@/lib/utils";
import { cardSrcSet, cardVariantUrl } from "@/lib/image-size";
import { useSaveData } from "./SaveData";

type GalleryImage = { src: string; label?: string };

function normalizeImages(images: string[] | GalleryImage[]): GalleryImage[] {
  return images.map((item) => (typeof item === "string" ? { src: item } : item)).filter((item) => Boolean(item.src));
}

/** Product gallery: vertical thumbs on desktop, hover magnifier, optional video, pan/zoom lightbox. */
export function ZoomGallery({
  images,
  alt,
  hint,
  video,
  videoLabel = "Video",
}: {
  images: string[] | GalleryImage[];
  alt: string;
  hint?: string;
  viewsTitle?: string;
  viewsHint?: string;
  /** Optional product video, offered as the last thumbnail. */
  video?: string | null;
  videoLabel?: string;
}) {
  const { t } = useLang();
  const items = normalizeImages(images);
  const [i, setI] = useState(0);
  const [showVideo, setShowVideo] = useState(false);
  const [full, setFull] = useState(false);
  const [zoom, setZoom] = useState<{ x: number; y: number } | null>(null);
  const dragX = useRef<number | null>(null);
  const swiped = useRef(false);
  const n = items.length;
  const active = items[Math.min(i, Math.max(0, n - 1))] ?? items[0];
  const { on: saveData } = useSaveData();
  const clip = saveData ? null : (video ?? null);
  const shown = active?.src ? (saveData ? cardVariantUrl(active.src) : active.src) : undefined;
  const sources = !saveData && active?.src ? cardSrcSet(active.src) : null;
  const go = (d: number) => {
    setShowVideo(false);
    setI((v) => (v + d + n) % n);
  };

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

  const thumbs = (n > 1 || clip) && (
    <div className="flex gap-2 overflow-x-auto no-scrollbar md:max-h-[34rem] md:flex-col md:overflow-y-auto md:overflow-x-visible">
      {items.map((item, k) => (
        <button
          key={`${item.src}-${k}`}
          type="button"
          onClick={() => {
            setShowVideo(false);
            setI(k);
          }}
          aria-label={item.label ?? `${alt} ${k + 1}`}
          aria-current={!showVideo && k === i ? "true" : undefined}
          className={cn(
            "h-16 w-16 shrink-0 overflow-hidden rounded-lg border-2 bg-white transition-colors md:h-[4.5rem] md:w-[4.5rem]",
            !showVideo && k === i ? "border-gold" : "border-border hover:border-navy/30",
          )}
        >
          <img
            src={cardVariantUrl(item.src)}
            alt=""
            width={72}
            height={72}
            loading={k === 0 ? "eager" : "lazy"}
            decoding="async"
            className="h-full w-full object-cover"
            onError={(event) => {
              if (event.currentTarget.src !== item.src) event.currentTarget.src = item.src;
            }}
          />
        </button>
      ))}
      {clip && (
        <button
          type="button"
          onClick={() => setShowVideo(true)}
          aria-label={videoLabel}
          aria-current={showVideo ? "true" : undefined}
          className={cn(
            "relative grid h-16 w-16 shrink-0 place-items-center overflow-hidden rounded-lg border-2 bg-navy text-white transition-colors md:h-[4.5rem] md:w-[4.5rem]",
            showVideo ? "border-gold" : "border-border hover:border-navy/30",
          )}
        >
          {items[0] && (
            <img src={cardVariantUrl(items[0].src)} alt="" width={72} height={72} className="absolute inset-0 h-full w-full object-cover opacity-50" />
          )}
          <span className="relative grid h-8 w-8 place-items-center rounded-full bg-white/90 text-navy">
            <Play className="ml-0.5 h-4 w-4 fill-current" />
          </span>
        </button>
      )}
    </div>
  );

  return (
    <div className="zoom-gallery flex flex-col gap-3 md:flex-row-reverse">
      <div
        className="group relative aspect-square min-w-0 flex-1 overflow-hidden rounded-xl border border-border bg-sand"
        onMouseMove={showVideo ? undefined : onMove}
        onMouseLeave={() => setZoom(null)}
      >
        {showVideo && clip ? (
          <ProductVideo src={clip} poster={items[0]?.src} className="absolute inset-0" />
        ) : (
        <button
          type="button"
          className="absolute inset-0 z-0 cursor-zoom-in"
          onPointerDown={(event) => {
            dragX.current = event.clientX;
            swiped.current = false;
          }}
          onPointerUp={(event) => {
            if (dragX.current == null) return;
            const moved = event.clientX - dragX.current;
            dragX.current = null;
            if (Math.abs(moved) < 48) return;
            swiped.current = true;
            go(moved < 0 ? 1 : -1);
          }}
          onClick={() => {
            if (swiped.current) {
              swiped.current = false;
              return;
            }
            setFull(true);
          }}
          aria-label="Open fullscreen gallery"
        >
          <img
            src={shown}
            {...(sources ? { srcSet: sources, sizes: "(min-width: 1024px) 50vw, 100vw" } : {})}
            alt={active?.label ? `${alt} — ${active.label}` : alt}
            width={1200}
            height={1200}
            fetchPriority={i === 0 ? "high" : "low"}
            decoding="async"
            className="h-full w-full object-cover transition-[transform,filter] duration-200 ease-out will-change-transform"
            style={
              zoom
                ? { transform: "scale(2.4)", transformOrigin: `${zoom.x}% ${zoom.y}%` }
                : { transform: "scale(1)" }
            }
            draggable={false}
          />
        </button>
        )}

        {zoom && !showVideo && active?.src && (
          <div
            aria-hidden
            className="pointer-events-none absolute z-[1] hidden h-28 w-28 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white/90 shadow-[0_0_0_1px_rgba(20,33,61,0.25),0_12px_28px_-10px_rgba(0,0,0,0.45)] md:block"
            style={{
              left: `${zoom.x}%`,
              top: `${zoom.y}%`,
              backgroundImage: `url(${shown ?? active.src})`,
              backgroundSize: "240% 240%",
              backgroundPosition: `${zoom.x}% ${zoom.y}%`,
            }}
          />
        )}

        {!showVideo && (
          <div className="pointer-events-none absolute inset-x-0 bottom-0 z-[2] p-3 opacity-0 transition-opacity duration-300 group-hover:opacity-100 max-md:hidden">
            <p className="inline-flex items-center gap-1.5 rounded-full bg-white/90 px-2.5 py-1 text-xs font-medium text-navy">
              <ZoomIn className="h-3.5 w-3.5" />
              {hint ?? t.detail.zoomHint}
            </p>
          </div>
        )}

        {!showVideo && (
          <button
            type="button"
            onClick={() => setFull(true)}
            aria-label={t.detail.fullscreen}
            className="absolute right-3 top-3 z-[3] grid h-11 w-11 place-items-center rounded-full bg-white/95 text-navy shadow-sm"
          >
            <Maximize2 className="h-4 w-4" />
          </button>
        )}

        {n > 1 && !showVideo && (
          <>
            <NavBtn
              side="left"
              label={t.detail.previousPhoto}
              className="z-[3] opacity-0 transition-opacity group-hover:opacity-100 max-md:opacity-100"
              onClick={() => go(-1)}
            />
            <NavBtn
              side="right"
              label={t.detail.nextPhoto}
              className="z-[3] opacity-0 transition-opacity group-hover:opacity-100 max-md:opacity-100"
              onClick={() => go(1)}
            />
          </>
        )}
      </div>

      {thumbs}

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
  label,
  onClick,
  className,
}: {
  side: "left" | "right";
  label: string;
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
      aria-label={label}
      className={cn(
        "absolute top-1/2 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-full bg-background/90 text-navy shadow-sm backdrop-blur transition-transform hover:scale-105",
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
  const { t } = useLang();
  const { on: saveData } = useSaveData();
  const layerRef = useRef<HTMLDivElement>(null);
  const current = images[index];
  const src = current ? (saveData ? cardVariantUrl(current) : current) : undefined;
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

  const keys = useRef({ change, index, onClose, resetView });
  keys.current = { change, index, onClose, resetView };
  useEffect(() => {
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    layerRef.current?.querySelector<HTMLElement>("button")?.focus();
    const onKey = (e: KeyboardEvent) => {
      const current = keys.current;
      if (e.key === "Escape") {
        e.preventDefault();
        current.onClose();
        return;
      }
      if (e.key === "Tab" && layerRef.current) {
        const next = cycleTab(
          tabbable(layerRef.current),
          document.activeElement instanceof HTMLElement ? document.activeElement : null,
          e.shiftKey,
        );
        if (next) {
          e.preventDefault();
          next.focus();
        }
        return;
      }
      if (e.key === "ArrowRight") current.change(current.index + 1);
      if (e.key === "ArrowLeft") current.change(current.index - 1);
      if (e.key === "+" || e.key === "=") setScale((s) => Math.min(4, s + 0.35));
      if (e.key === "-") setScale((s) => Math.max(1, s - 0.35));
      if (e.key === "0") current.resetView();
    };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
      previous?.focus();
    };
  }, []);

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
    <div ref={layerRef} className="fixed inset-0 z-[80] flex flex-col bg-ink/96 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label={alt}>
      <div className="flex items-center justify-between gap-3 px-4 py-3 text-primary-foreground">
        <p className="text-sm font-medium tabular-nums opacity-80">
          {captions?.[index] ?? `${index + 1} / ${n}`}
        </p>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="grid h-11 w-11 place-items-center rounded-full bg-white/10 transition-colors hover:bg-white/20"
            aria-label={t.detail.zoomOut}
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
            className="grid h-11 w-11 place-items-center rounded-full bg-white/10 transition-colors hover:bg-white/20"
            aria-label={t.detail.zoomIn}
            onClick={() => setScale((s) => Math.min(4, s + 0.4))}
          >
            <ZoomIn className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={onClose}
            aria-label={t.nav.close}
            className="grid h-11 w-11 place-items-center rounded-full bg-white/10 transition-colors hover:bg-white/20"
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
          src={src}
          alt={alt}
          width={1200}
          height={1200}
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
            <NavBtn side="left" label={t.detail.previousPhoto} className="!bg-white/15 !text-white hover:!bg-white/25" onClick={() => change(index - 1)} />
            <NavBtn side="right" label={t.detail.nextPhoto} className="!bg-white/15 !text-white hover:!bg-white/25" onClick={() => change(index + 1)} />
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
              aria-label={fill(t.detail.photoNumber, { n: k + 1 })}
              className={cn(
                "h-14 w-14 shrink-0 overflow-hidden rounded-lg border-2 transition-opacity",
                k === index ? "border-gold opacity-100" : "border-transparent opacity-50 hover:opacity-90",
              )}
            >
              <img src={src} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
