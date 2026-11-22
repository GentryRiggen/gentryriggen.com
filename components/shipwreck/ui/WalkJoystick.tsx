"use client";

import { useEffect, useRef, useState } from "react";
import { walkInput } from "@/lib/shipwreck/walk";

/** How far the knob can travel from the centre (px). */
const TRAVEL_PX = 44;
/** Fraction of full travel inside which the stick reads as centred. */
const DEAD_ZONE = 0.15;

interface StickValue {
  forward: number;
  strafe: number;
  /** The knob's offset (px), clamped to the ring. */
  knobX: number;
  knobY: number;
}

/**
 * A pointer offset from the stick's centre as walk input (copied from Ship
 * Builder's joystick: up is forward, right a step to the right).
 */
export function stickValue(dx: number, dy: number): StickValue {
  const length = Math.hypot(dx, dy);
  if (length === 0) return { forward: 0, strafe: 0, knobX: 0, knobY: 0 };
  const reach = Math.min(1, length / TRAVEL_PX);
  const live = reach < DEAD_ZONE ? 0 : (reach - DEAD_ZONE) / (1 - DEAD_ZONE);
  return {
    forward: (-dy / length) * live,
    strafe: (dx / length) * live,
    knobX: (dx / length) * reach * TRAVEL_PX,
    knobY: (dy / length) * reach * TRAVEL_PX,
  };
}

/** The four arrows around the ring (pictures: the way the knob goes). */
const CHEVRONS = [
  { d: "M6 15l6-6 6 6", at: "left-1/2 top-1 -translate-x-1/2" },
  { d: "M6 9l6 6 6-6", at: "bottom-1 left-1/2 -translate-x-1/2" },
  { d: "M15 6l-6 6 6 6", at: "left-1 top-1/2 -translate-y-1/2" },
  { d: "M9 6l6 6-6 6", at: "right-1 top-1/2 -translate-y-1/2" },
];

/**
 * The walk stick, always drawn while walking or floating: a ring with a
 * knob and four arrows. Dragging it writes `walkInput.forward/strafe`;
 * letting go (or the stick going away mid-drag) zeroes them. The knob
 * moves with every pointer event, so it is placed on the element, not
 * through React state.
 */
export default function WalkJoystick() {
  const rootRef = useRef<HTMLDivElement>(null);
  const knobRef = useRef<HTMLDivElement>(null);
  const pointerRef = useRef<number | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  // Gone mid-drag (Fly, a restart): let go, so nobody keeps walking.
  useEffect(() => {
    const pointer = pointerRef;
    return () => {
      if (pointer.current === null) return;
      pointer.current = null;
      walkInput.forward = 0;
      walkInput.strafe = 0;
    };
  }, []);

  function moveKnob(x: number, y: number) {
    if (knobRef.current)
      knobRef.current.style.transform = `translate(${x}px, ${y}px)`;
  }

  function update(e: React.PointerEvent) {
    const box = rootRef.current?.getBoundingClientRect();
    if (!box) return;
    const v = stickValue(
      e.clientX - (box.left + box.width / 2),
      e.clientY - (box.top + box.height / 2)
    );
    walkInput.forward = v.forward;
    walkInput.strafe = v.strafe;
    moveKnob(v.knobX, v.knobY);
  }

  function onDown(e: React.PointerEvent<HTMLDivElement>) {
    if (pointerRef.current !== null) return;
    pointerRef.current = e.pointerId;
    try {
      e.currentTarget.setPointerCapture?.(e.pointerId);
    } catch {
      // A stale pointer (NotFoundError): drag on without the capture.
    }
    setIsDragging(true);
    update(e);
  }

  function onMove(e: React.PointerEvent<HTMLDivElement>) {
    if (pointerRef.current !== e.pointerId) return;
    update(e);
  }

  function onEnd(e: React.PointerEvent<HTMLDivElement>) {
    if (pointerRef.current !== e.pointerId) return;
    pointerRef.current = null;
    setIsDragging(false);
    walkInput.forward = 0;
    walkInput.strafe = 0;
    moveKnob(0, 0);
  }

  return (
    <div
      ref={rootRef}
      role="group"
      aria-label="Walk: drag the stick"
      data-testid="shipwreck-walk-stick"
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={onEnd}
      onPointerCancel={onEnd}
      className={`pointer-events-auto relative grid size-36 touch-none select-none place-items-center rounded-full border-4 shadow-lg shadow-black/50 backdrop-blur-md ${
        isDragging
          ? "border-amber-300 bg-slate-950/60 dark:bg-slate-950/60"
          : "border-white/60 bg-slate-950/45 dark:bg-slate-950/45"
      }`}
    >
      {CHEVRONS.map(({ d, at }) => (
        <svg
          key={d}
          viewBox="0 0 24 24"
          aria-hidden="true"
          className={`pointer-events-none absolute size-8 text-white/85 ${at}`}
          fill="none"
          stroke="currentColor"
          strokeWidth={3}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d={d} />
        </svg>
      ))}
      <div
        ref={knobRef}
        aria-hidden="true"
        className={`pointer-events-none size-16 rounded-full border-2 border-white bg-amber-400 shadow-md shadow-black/50 ${
          isDragging
            ? ""
            : "transition-transform duration-150 motion-reduce:transition-none"
        }`}
      />
    </div>
  );
}
