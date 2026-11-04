import { useRef, useState, type KeyboardEvent, type PointerEvent as ReactPointerEvent } from "react";
import { cn } from "@/lib/utils";

function stepFor(max: number) {
  if (max >= 20_000) return 1000;
  if (max >= 1000) return 100;
  return 1;
}

function snap(value: number, max: number) {
  const step = stepFor(max);
  const next = Math.round(value / step) * step;
  return Math.min(max, Math.max(0, next));
}

export function PriceFilter({
  label,
  value,
  max,
  count,
  resultsLabel,
  onChange,
}: {
  label: string;
  value: number;
  max: number;
  count: number;
  resultsLabel: string;
  onChange: (value: number) => void;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(false);
  const pct = max > 0 ? Math.min(100, Math.max(0, (value / max) * 100)) : 0;

  function fromClientX(clientX: number) {
    const track = trackRef.current;
    if (!track || max <= 0) return;
    const rect = track.getBoundingClientRect();
    const ratio = rect.width > 0 ? (clientX - rect.left) / rect.width : 0;
    onChange(snap(Math.min(1, Math.max(0, ratio)) * max, max));
  }

  function onPointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (max <= 0) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    setActive(true);
    fromClientX(event.clientX);
  }

  function onPointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    if (!active) return;
    fromClientX(event.clientX);
  }

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const step = stepFor(max);
    if (event.key === "ArrowRight" || event.key === "ArrowUp") {
      event.preventDefault();
      onChange(snap(Math.min(max, value + step), max));
    } else if (event.key === "ArrowLeft" || event.key === "ArrowDown") {
      event.preventDefault();
      onChange(snap(Math.max(0, value - step), max));
    } else if (event.key === "Home") {
      event.preventDefault();
      onChange(0);
    } else if (event.key === "End") {
      event.preventDefault();
      onChange(max);
    }
  }

  const amount = `TZS ${value.toLocaleString("en-US")}`;
  const thumbLeft = `calc(0.6rem + (100% - 1.2rem) * ${pct / 100})`;

  return (
    <div className={cn("price-filter", active && "is-active")}>
      <div className="flex items-center justify-between gap-3">
        <p className="price-filter-amount text-sm font-semibold text-navy">
          <span className="sr-only">{label}: </span>
          TZS 0 – {amount}
        </p>
        <p className="price-filter-count">{count} {resultsLabel}</p>
      </div>
      <div
        ref={trackRef}
        role="slider"
        tabIndex={0}
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={max}
        aria-valuenow={value}
        aria-valuetext={amount}
        className="price-filter-track"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={() => setActive(false)}
        onPointerCancel={() => setActive(false)}
        onKeyDown={onKeyDown}
      >
        <div className="price-filter-rail" aria-hidden>
          <div className="price-filter-fill" style={{ width: `${pct}%` }} />
        </div>
        <span className="price-filter-bubble" style={{ left: thumbLeft }} aria-hidden>
          {amount}
        </span>
        <span className="price-filter-thumb" style={{ left: thumbLeft }} aria-hidden />
      </div>
      <div className="price-filter-ends" aria-hidden>
        <span>TZS 0</span>
        <span>TZS {max.toLocaleString("en-US")}</span>
      </div>
    </div>
  );
}
