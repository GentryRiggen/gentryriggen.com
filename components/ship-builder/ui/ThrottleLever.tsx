"use client";

import { useEffect, useRef, useState } from "react";
import type { ShipKind } from "@/lib/ship-builder/model/kinds";
import { sailInput } from "@/lib/ship-builder/state/sailInput";
import { controlsForKind } from "./controlsForKind";

export const REVERSE_THROTTLE = -0.3;
export const FULL_THROTTLE = 1;
const RANGE = FULL_THROTTLE - REVERSE_THROTTLE;
/** Within this of stop, a drag snaps to exactly stop. */
const DETENT = 0.06;
const KEY_STEP = 0.1;

function clampThrottle(value: number): number {
  return Math.max(REVERSE_THROTTLE, Math.min(FULL_THROTTLE, value));
}

/** Snaps values near stop to 0 so the lever "clicks" into the detent. */
function withDetent(value: number): number {
  const clamped = clampThrottle(value);
  return Math.abs(clamped) < DETENT ? 0 : clamped;
}

function describe(throttle: number): string {
  if (throttle === 0) return "Stop";
  if (throttle < 0) return "Reverse";
  if (throttle === FULL_THROTTLE) return "Full ahead";
  return `Ahead ${Math.round(throttle * 100)} percent`;
}

/** Pirate ships have no engine, so their lever sets the sails. */
export function throttleWord(kind: ShipKind): "Sails" | "Throttle" {
  return kind === "pirate" ? "Sails" : "Throttle";
}

interface ThrottleLeverProps {
  kind: ShipKind;
}

/**
 * A vertical lever: up is ahead, down is reverse, with a detent at stop. It
 * writes `sailInput.throttle` and reads it back each frame, so the keyboard
 * moves it too. Also a slider for keyboards and screen readers.
 */
export default function ThrottleLever({ kind }: ThrottleLeverProps) {
  const { leverStyle, label } = controlsForKind[kind];
  const trackRef = useRef<HTMLDivElement>(null);
  const dragIdRef = useRef<number | null>(null);
  const [throttle, setThrottle] = useState(sailInput.throttle);

  useEffect(() => {
    let frame = requestAnimationFrame(function sync() {
      setThrottle(sailInput.throttle);
      frame = requestAnimationFrame(sync);
    });
    return () => cancelAnimationFrame(frame);
  }, []);

  function setValue(value: number) {
    sailInput.throttle = withDetent(value);
    setThrottle(sailInput.throttle);
  }

  function valueAt(clientY: number): number {
    const box = trackRef.current?.getBoundingClientRect();
    if (!box || box.height === 0) return sailInput.throttle;
    const fromTop = (clientY - box.top) / box.height;
    return FULL_THROTTLE - fromTop * RANGE;
  }

  function handlePointerDown(event: React.PointerEvent<HTMLDivElement>) {
    dragIdRef.current = event.pointerId;
    event.currentTarget.setPointerCapture?.(event.pointerId);
    setValue(valueAt(event.clientY));
  }

  function handlePointerMove(event: React.PointerEvent<HTMLDivElement>) {
    if (dragIdRef.current !== event.pointerId) return;
    setValue(valueAt(event.clientY));
  }

  function handlePointerEnd(event: React.PointerEvent<HTMLDivElement>) {
    if (dragIdRef.current === event.pointerId) dragIdRef.current = null;
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    const current = sailInput.throttle;
    let next: number;
    if (event.key === "ArrowUp" || event.key === "ArrowRight") {
      next = current + KEY_STEP;
    } else if (event.key === "ArrowDown" || event.key === "ArrowLeft") {
      next = current - KEY_STEP;
    } else if (event.key === "Home") {
      next = FULL_THROTTLE;
    } else if (event.key === "End") {
      next = REVERSE_THROTTLE;
    } else return;
    event.preventDefault();
    // The drive keys listen on the window; the lever has handled this key.
    event.stopPropagation();
    // A step stops at the detent rather than skipping over it.
    const isStep = event.key.startsWith("Arrow");
    const crossesStop = isStep && current * next < 0;
    setValue(crossesStop ? 0 : next);
  }

  // The knob sits at its value along the track; this geometry is dynamic.
  const topPercent = ((FULL_THROTTLE - throttle) / RANGE) * 100;
  const stopPercent = (FULL_THROTTLE / RANGE) * 100;

  return (
    <div
      ref={trackRef}
      role="slider"
      tabIndex={0}
      aria-label={`${label} ${throttleWord(kind).toLowerCase()}`}
      aria-orientation="vertical"
      aria-valuemin={Math.round(REVERSE_THROTTLE * 100)}
      aria-valuemax={FULL_THROTTLE * 100}
      aria-valuenow={Math.round(throttle * 100)}
      aria-valuetext={describe(throttle)}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerEnd}
      onPointerCancel={handlePointerEnd}
      onKeyDown={handleKeyDown}
      className="pointer-events-auto relative h-36 w-14 touch-none select-none rounded-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-600 sm:h-44 dark:focus-visible:outline-sky-400"
    >
      <div
        className={`absolute inset-y-0 left-1/2 w-3 -translate-x-1/2 rounded-full ${leverStyle.trackClass}`}
      />
      <div
        data-testid="throttle-detent"
        className="absolute left-1/2 h-0.5 w-8 -translate-x-1/2 bg-slate-900/70 dark:bg-white/70"
        style={{ top: `${stopPercent}%` }}
      />
      <div
        data-testid="throttle-knob"
        className={`absolute left-1/2 -translate-x-1/2 -translate-y-1/2 border-2 shadow-md ${leverStyle.knobShapeClass} ${leverStyle.knobClass}`}
        style={{ top: `${topPercent}%` }}
      />
    </div>
  );
}
