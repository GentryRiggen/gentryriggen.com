"use client";

import { useRef, useState } from "react";
import { walkInput } from "@/lib/ship-builder/state/walkInput";

/** How far the thumb can travel from the centre, in pixels. */
const TRAVEL_PX = 36;
/** Fraction of full travel inside which the stick reads as centred. */
const DEAD_ZONE = 0.15;

interface StickValue {
  forward: number;
  strafe: number;
  /** Thumb offset in pixels, clamped to the circle. */
  thumbX: number;
  thumbY: number;
}

/** Turns a pointer offset from the stick's centre into walk input. */
function stickValue(dx: number, dy: number): StickValue {
  const length = Math.hypot(dx, dy);
  if (length === 0) return { forward: 0, strafe: 0, thumbX: 0, thumbY: 0 };
  const reach = Math.min(1, length / TRAVEL_PX);
  const live = reach < DEAD_ZONE ? 0 : (reach - DEAD_ZONE) / (1 - DEAD_ZONE);
  return {
    forward: (-dy / length) * live,
    strafe: (dx / length) * live,
    thumbX: (dx / length) * reach * TRAVEL_PX,
    thumbY: (dy / length) * reach * TRAVEL_PX,
  };
}

/**
 * A stick the player drags to walk: up is forward, right is a step to the
 * right. It writes `walkInput.forward/strafe` and lets go the moment the
 * finger lifts. The thumb moves with every pointer event, so its position is
 * set on the element directly rather than through React state.
 */
export default function WalkJoystick() {
  const rootRef = useRef<HTMLDivElement>(null);
  const thumbRef = useRef<HTMLDivElement>(null);
  const pointerIdRef = useRef<number | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  function moveThumb(x: number, y: number) {
    if (thumbRef.current) {
      thumbRef.current.style.transform = `translate(${x}px, ${y}px)`;
    }
  }

  function update(event: React.PointerEvent) {
    const box = rootRef.current?.getBoundingClientRect();
    if (!box) return;
    const value = stickValue(
      event.clientX - (box.left + box.width / 2),
      event.clientY - (box.top + box.height / 2)
    );
    walkInput.forward = value.forward;
    walkInput.strafe = value.strafe;
    moveThumb(value.thumbX, value.thumbY);
  }

  function handlePointerDown(event: React.PointerEvent<HTMLDivElement>) {
    if (pointerIdRef.current !== null) return;
    event.currentTarget.setPointerCapture?.(event.pointerId);
    pointerIdRef.current = event.pointerId;
    setIsDragging(true);
    update(event);
  }

  function handlePointerMove(event: React.PointerEvent<HTMLDivElement>) {
    if (pointerIdRef.current !== event.pointerId) return;
    update(event);
  }

  function handlePointerEnd(event: React.PointerEvent<HTMLDivElement>) {
    if (pointerIdRef.current !== event.pointerId) return;
    pointerIdRef.current = null;
    setIsDragging(false);
    walkInput.forward = 0;
    walkInput.strafe = 0;
    moveThumb(0, 0);
  }

  return (
    <div
      ref={rootRef}
      role="group"
      aria-label="Walk joystick. Drag to walk."
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerEnd}
      onPointerCancel={handlePointerEnd}
      className="pointer-events-auto flex h-32 w-32 touch-none select-none items-center justify-center rounded-full border border-slate-300 bg-white/70 shadow-lg backdrop-blur-sm dark:border-slate-700 dark:bg-slate-900/70"
    >
      <div
        ref={thumbRef}
        aria-hidden="true"
        className={`pointer-events-none h-14 w-14 rounded-full border border-slate-400 bg-slate-100 shadow-md dark:border-slate-500 dark:bg-slate-700 ${
          isDragging
            ? ""
            : "transition-transform duration-150 motion-reduce:transition-none"
        }`}
      />
    </div>
  );
}
