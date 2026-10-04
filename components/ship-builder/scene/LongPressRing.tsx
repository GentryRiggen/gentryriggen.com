"use client";

import { useCallback } from "react";

interface LongPressRingProps {
  /** Pointer position relative to the canvas wrapper, in CSS pixels. */
  x: number;
  y: number;
}

// Tailwind can't know the pointer position at build time, so the ref writes it
// to CSS variables that the position classes read.
const RING_X = "--ship-ring-x";
const RING_Y = "--ship-ring-y";

/**
 * The filling ring shown under the pointer during a press-and-hold delete. It
 * fills over 600 ms (the `ringFill` keyframes in globals.css), matching
 * LONG_PRESS_MS in longPress.ts, so it completes as the part is removed.
 */
export default function LongPressRing({ x, y }: LongPressRingProps) {
  const place = useCallback(
    (element: HTMLDivElement | null) => {
      element?.style.setProperty(RING_X, `${x}px`);
      element?.style.setProperty(RING_Y, `${y}px`);
    },
    [x, y]
  );

  return (
    <div
      ref={place}
      data-testid="long-press-ring"
      aria-hidden="true"
      className="pointer-events-none absolute top-(--ship-ring-y) left-(--ship-ring-x) z-10 size-16 -translate-x-1/2 -translate-y-1/2"
    >
      <svg viewBox="0 0 64 64" className="size-full -rotate-90">
        <circle
          cx="32"
          cy="32"
          r="26"
          fill="none"
          strokeWidth="6"
          className="stroke-white/70 dark:stroke-slate-900/70"
        />
        <circle
          cx="32"
          cy="32"
          r="26"
          fill="none"
          strokeWidth="6"
          strokeLinecap="round"
          pathLength={100}
          strokeDasharray="100"
          className="animate-[ringFill_600ms_linear_forwards] stroke-red-500 [stroke-dashoffset:100] motion-reduce:animate-none motion-reduce:[stroke-dashoffset:0] dark:stroke-red-400"
        />
      </svg>
    </div>
  );
}
