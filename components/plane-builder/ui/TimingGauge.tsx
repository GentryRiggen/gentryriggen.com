"use client";

import { useEffect, useRef, useState } from "react";
import type { MutableRefObject } from "react";
import {
  GREEN_HALF,
  YELLOW_HALF,
  gaugePosition,
  gaugeZone,
} from "@/lib/plane-builder/minigame/gauge";
import type { GaugeZone } from "@/lib/plane-builder/minigame/gauge";

const ZONE_LABEL: Record<GaugeZone, string> = {
  green: "green zone",
  yellow: "yellow zone",
  red: "red zone",
};

const pct = (share: number) => `${share * 100}%`;

interface TimingGaugeProps {
  /** The marker sweeps while true; each run starts from the left end. */
  isRunning: boolean;
  /** Written every frame with the marker's position, 0 to 1. */
  positionRef: MutableRefObject<number>;
  ariaLabel: string;
  /** Half-width of the green zone; wider with Lucky Clovers. */
  greenHalf?: number;
  className?: string;
}

/** A sweeping marker over red, yellow and green zones. */
export default function TimingGauge({
  isRunning,
  positionRef,
  ariaLabel,
  greenHalf = GREEN_HALF,
  className = "",
}: TimingGaugeProps) {
  const root = useRef<HTMLDivElement>(null);
  const marker = useRef<HTMLDivElement>(null);
  const [zone, setZone] = useState<GaugeZone>("red");

  useEffect(() => {
    if (!isRunning) return;
    const startedAt = performance.now();
    let frame = 0;
    let shownZone: GaugeZone = "red";

    function tick(now: number) {
      const position = gaugePosition((now - startedAt) / 1000);
      positionRef.current = position;
      if (marker.current) marker.current.style.left = pct(position);
      root.current?.setAttribute(
        "aria-valuenow",
        String(Math.round(position * 100))
      );
      const next = gaugeZone(position, greenHalf);
      if (next !== shownZone) {
        shownZone = next;
        setZone(next);
      }
      frame = requestAnimationFrame(tick);
    }

    positionRef.current = 0;
    if (marker.current) marker.current.style.left = "0%";
    // A new run starts at the left end, which is red.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setZone("red");
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [isRunning, positionRef, greenHalf]);

  return (
    <div
      ref={root}
      role="meter"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={0}
      aria-label={ariaLabel}
      aria-valuetext={ZONE_LABEL[zone]}
      className={`relative h-6 w-full overflow-hidden rounded-full border-2 border-slate-800 bg-red-500 dark:border-slate-100 dark:bg-red-600 ${className}`}
    >
      <div
        data-testid="gauge-zone-yellow"
        className="absolute inset-y-0 bg-yellow-300 dark:bg-yellow-400"
        style={{ left: pct(0.5 - YELLOW_HALF), width: pct(YELLOW_HALF * 2) }}
      />
      <div
        data-testid="gauge-zone-green"
        className="absolute inset-y-0 bg-emerald-500 dark:bg-emerald-400"
        style={{ left: pct(0.5 - greenHalf), width: pct(greenHalf * 2) }}
      />
      <div
        ref={marker}
        data-testid="gauge-marker"
        className="absolute inset-y-0 w-1.5 -translate-x-1/2 rounded-full bg-slate-900 ring-2 ring-white dark:bg-white dark:ring-slate-900"
        style={{ left: "0%" }}
      />
    </div>
  );
}
