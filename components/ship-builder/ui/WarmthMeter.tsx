"use client";

import { Thermometer } from "lucide-react";
import { useEffect, useState } from "react";
import { getEscape, useEscape } from "@/lib/ship-builder/state/escapeLive";

/** How often the swimmer's warmth is read; it changes every frame. */
const WARMTH_POLL_MS = 150;

function currentWarmth(): number {
  const { phase } = getEscape();
  return phase.kind === "swimming" ? phase.swimmer.warmth : 1;
}

/** How warm the swimmer is, from sky blue (warm) to white (frozen). */
export default function WarmthMeter() {
  const isSwimming = useEscape().phase.kind === "swimming";
  const [warmth, setWarmth] = useState(currentWarmth);

  useEffect(() => {
    if (!isSwimming) return;
    const read = () => setWarmth(currentWarmth());
    read();
    const timer = setInterval(read, WARMTH_POLL_MS);
    return () => clearInterval(timer);
  }, [isSwimming]);

  if (!isSwimming) return null;
  const percent = Math.round(Math.min(1, Math.max(0, warmth)) * 100);
  return (
    <div
      role="meter"
      aria-label="Warmth"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={percent}
      data-testid="warmth-meter"
      className="pointer-events-none flex w-fit items-center gap-2 rounded-full bg-slate-900/80 px-3 py-1.5 text-sm font-medium text-white dark:bg-slate-100/90 dark:text-slate-900"
    >
      <Thermometer aria-hidden="true" className="h-4 w-4 shrink-0" />
      <span aria-hidden="true">Warmth</span>
      <span
        aria-hidden="true"
        className="h-2.5 w-28 overflow-hidden rounded-full bg-slate-600 dark:bg-slate-300"
      >
        <span
          className="block h-full rounded-full bg-gradient-to-r from-sky-400 to-white"
          style={{ width: `${percent}%` }}
        />
      </span>
    </div>
  );
}
