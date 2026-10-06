"use client";

import { useRef } from "react";
import { walkInput } from "@/lib/ship-builder/state/walkInput";

/** Horizontal drag, in pixels, that turns at full speed. */
const FULL_TURN_PX = 120;

function clampTurn(value: number): number {
  return Math.max(-1, Math.min(1, value));
}

/**
 * A transparent layer over the view: drag sideways to look around. The turn
 * speed follows how far the pointer is from where the drag began, and stops
 * when it is let go. It sits behind the other controls, so they win.
 */
export default function WalkLookLayer() {
  const dragRef = useRef<{ pointerId: number; startX: number } | null>(null);

  function handlePointerDown(event: React.PointerEvent<HTMLDivElement>) {
    if (dragRef.current) return;
    event.currentTarget.setPointerCapture?.(event.pointerId);
    dragRef.current = { pointerId: event.pointerId, startX: event.clientX };
  }

  function handlePointerMove(event: React.PointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    walkInput.turn = clampTurn((event.clientX - drag.startX) / FULL_TURN_PX);
  }

  function handlePointerEnd(event: React.PointerEvent<HTMLDivElement>) {
    if (dragRef.current?.pointerId !== event.pointerId) return;
    dragRef.current = null;
    walkInput.turn = 0;
  }

  return (
    <div
      data-testid="walk-look-layer"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerEnd}
      onPointerCancel={handlePointerEnd}
      className="pointer-events-auto absolute inset-0 touch-none select-none"
    />
  );
}
