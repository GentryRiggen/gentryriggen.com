"use client";

import { useGameStore } from "@/lib/planet-smasher/store";

/** A thick bar that drains and goes green, yellow, then red. */
export default function HealthBar() {
  const health = useGameStore((s) => s.planet?.health ?? 100);
  const pct = Math.max(0, Math.min(100, health));
  const color =
    pct > 60 ? "bg-green-500" : pct > 30 ? "bg-yellow-400" : "bg-red-500";
  return (
    <div
      role="progressbar"
      aria-label="Planet health"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(pct)}
      className="h-4 w-full overflow-hidden rounded-full border-2 border-white/70 bg-black/60 sm:h-5"
    >
      {/* The width is the one dynamic value here. */}
      <div
        className={`h-full rounded-full transition-[width,background-color] duration-300 ease-out ${color}`}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}
