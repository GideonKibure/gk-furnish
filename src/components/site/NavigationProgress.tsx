import { useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";

/** Thin gold bar at the top of the screen while the next page is loading. */
export function NavigationProgress() {
  const loading = useRouterState({ select: (s) => s.status === "pending" });
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (loading) {
      const timer = setTimeout(() => setVisible(true), 120);
      return () => clearTimeout(timer);
    }
    setVisible(false);
    return undefined;
  }, [loading]);

  return (
    <div
      aria-hidden
      className={`pointer-events-none fixed inset-x-0 top-0 z-[100] h-[3px] overflow-hidden transition-opacity duration-300 ${
        visible ? "opacity-100" : "opacity-0"
      }`}
    >
      <div className="nav-progress-bar h-full w-1/3 rounded-full bg-gold shadow-[0_0_10px_var(--gold)]" />
    </div>
  );
}
