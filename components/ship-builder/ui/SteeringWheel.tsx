"use client";

import { useEffect, useRef } from "react";
import type { ShipKind } from "@/lib/ship-builder/model/kinds";
import { sailInput } from "@/lib/ship-builder/state/sailInput";
import usePrefersReducedMotion from "../hooks/usePrefersReducedMotion";
import { controlsForKind } from "./controlsForKind";

/** Lock to lock is 270 degrees, so full rudder is 135 degrees either way. */
const FULL_LOCK_DEGREES = 135;
const SPRING_BACK_MS = 220;

const SPOKE_COUNT = { spoked: 8, modern: 3, compact: 4, plain: 6 } as const;

function clampRudder(value: number): number {
  return Math.max(-1, Math.min(1, value));
}

/** Angle of a point around a centre, in degrees clockwise from straight up. */
function angleAround(cx: number, cy: number, x: number, y: number): number {
  return (Math.atan2(x - cx, cy - y) * 180) / Math.PI;
}

/** Smallest signed difference between two angles, in -180..180. */
function angleDelta(from: number, to: number): number {
  let delta = to - from;
  while (delta > 180) delta -= 360;
  while (delta < -180) delta += 360;
  return delta;
}

interface SteeringWheelProps {
  kind: ShipKind;
  /** Overrides the kind's wheel size, e.g. a bigger wheel in the cockpit. */
  sizeClass?: string;
}

/**
 * A wheel the player turns by dragging around its centre. It writes
 * `sailInput.rudder` and springs back to centre on release. Its picture
 * follows `sailInput` each frame, so the keyboard turns it too.
 */
export default function SteeringWheel({ kind, sizeClass }: SteeringWheelProps) {
  const { wheelStyle, label } = controlsForKind[kind];
  const reducedMotion = usePrefersReducedMotion();
  const rootRef = useRef<HTMLDivElement>(null);
  const rimRef = useRef<SVGSVGElement>(null);
  const dragRef = useRef<{
    pointerId: number;
    startAngle: number;
    startRudder: number;
  } | null>(null);
  const springRef = useRef<number | null>(null);

  // Keep the picture in step with the rudder input, with no React renders.
  // The rotation is dynamic geometry, so it is set on the element directly.
  useEffect(() => {
    let frame = requestAnimationFrame(function paint() {
      if (rimRef.current) {
        rimRef.current.style.transform = `rotate(${
          sailInput.rudder * FULL_LOCK_DEGREES
        }deg)`;
      }
      frame = requestAnimationFrame(paint);
    });
    return () => cancelAnimationFrame(frame);
  }, []);

  function stopSpring() {
    if (springRef.current !== null) cancelAnimationFrame(springRef.current);
    springRef.current = null;
  }

  useEffect(() => stopSpring, []);

  function springToCentre() {
    stopSpring();
    const from = sailInput.rudder;
    if (reducedMotion || from === 0) {
      sailInput.rudder = 0;
      return;
    }
    const startedAt = performance.now();
    const step = (now: number) => {
      const t = Math.min(1, (now - startedAt) / SPRING_BACK_MS);
      const eased = 1 - (1 - t) * (1 - t);
      sailInput.rudder = from * (1 - eased);
      springRef.current = t < 1 ? requestAnimationFrame(step) : null;
    };
    springRef.current = requestAnimationFrame(step);
  }

  function pointerAngle(event: React.PointerEvent): number {
    const box = rootRef.current?.getBoundingClientRect();
    const cx = box ? box.left + box.width / 2 : 0;
    const cy = box ? box.top + box.height / 2 : 0;
    return angleAround(cx, cy, event.clientX, event.clientY);
  }

  function handlePointerDown(event: React.PointerEvent<HTMLDivElement>) {
    stopSpring();
    event.currentTarget.setPointerCapture?.(event.pointerId);
    dragRef.current = {
      pointerId: event.pointerId,
      startAngle: pointerAngle(event),
      startRudder: sailInput.rudder,
    };
  }

  function handlePointerMove(event: React.PointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const delta = angleDelta(drag.startAngle, pointerAngle(event));
    sailInput.rudder = clampRudder(
      drag.startRudder + delta / FULL_LOCK_DEGREES
    );
  }

  function handlePointerEnd(event: React.PointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    dragRef.current = null;
    springToCentre();
  }

  const spokeCount = SPOKE_COUNT[wheelStyle.variant];

  return (
    <div
      ref={rootRef}
      role="img"
      aria-label={`${label} steering wheel. Drag to steer.`}
      data-variant={wheelStyle.variant}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerEnd}
      onPointerCancel={handlePointerEnd}
      className={`pointer-events-auto flex cursor-grab touch-none select-none items-center justify-center rounded-full active:cursor-grabbing ${sizeClass ?? wheelStyle.sizeClass} ${wheelStyle.backingClass}`}
    >
      <svg
        ref={rimRef}
        viewBox="0 0 100 100"
        aria-hidden="true"
        className="pointer-events-none h-full w-full"
      >
        <circle
          cx="50"
          cy="50"
          r={wheelStyle.variant === "modern" ? 38 : 34}
          fill="none"
          strokeWidth={wheelStyle.variant === "modern" ? 5 : 9}
          className={wheelStyle.rimClass}
        />
        {Array.from({ length: spokeCount }, (_, i) => {
          const angle = (i * 360) / spokeCount;
          return (
            <line
              key={angle}
              x1="50"
              y1="50"
              x2="50"
              y2={wheelStyle.variant === "spoked" ? "2" : "14"}
              transform={`rotate(${angle} 50 50)`}
              className={wheelStyle.spokeClass}
              strokeWidth={wheelStyle.variant === "modern" ? 3 : 4}
              strokeLinecap="round"
            />
          );
        })}
        <circle cx="50" cy="50" r="9" className={wheelStyle.hubClass} />
        <circle
          cx="50"
          cy="9"
          r="3.5"
          className="fill-red-500 dark:fill-red-400"
        />
      </svg>
    </div>
  );
}
