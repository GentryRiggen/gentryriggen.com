"use client";

import { useEffect, useRef, useState } from "react";
import { walkInput } from "@/lib/shipwreck/walk";
import Icon from "./Icon";

/**
 * A see-through layer over the scene while walking: drag anywhere to look
 * around (it adds the drag to `walkInput.lookDx/lookDy`, which the walk
 * runner turns and tilts by). It sits under the other controls, so they
 * win. A faint hand-with-arrows picture shows where to drag and fades
 * after the first drag.
 */
export default function WalkLookLayer() {
  const drag = useRef<{ id: number; x: number; y: number } | null>(null);
  const [dragged, setDragged] = useState(false);

  // Gone mid-drag: the half-read look is dropped.
  useEffect(
    () => () => {
      if (!drag.current) return;
      walkInput.lookDx = 0;
      walkInput.lookDy = 0;
    },
    []
  );

  function onDown(e: React.PointerEvent<HTMLDivElement>) {
    if (drag.current) return;
    drag.current = { id: e.pointerId, x: e.clientX, y: e.clientY };
    try {
      e.currentTarget.setPointerCapture?.(e.pointerId);
    } catch {
      // A stale pointer (NotFoundError): drag on without the capture.
    }
  }

  function onMove(e: React.PointerEvent<HTMLDivElement>) {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    walkInput.lookDx += e.clientX - d.x;
    walkInput.lookDy += e.clientY - d.y;
    d.x = e.clientX;
    d.y = e.clientY;
    if (!dragged) setDragged(true);
  }

  function onEnd(e: React.PointerEvent<HTMLDivElement>) {
    if (drag.current?.id !== e.pointerId) return;
    drag.current = null;
  }

  return (
    <div
      data-testid="shipwreck-walk-look"
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={onEnd}
      onPointerCancel={onEnd}
      className="pointer-events-auto absolute inset-0 touch-none select-none"
    >
      <div
        aria-hidden="true"
        data-testid="shipwreck-walk-hint"
        className={`pointer-events-none absolute right-[18%] top-1/2 -translate-y-1/2 text-white transition-opacity duration-700 motion-reduce:transition-none ${
          dragged ? "opacity-0" : "opacity-60 motion-safe:animate-pulse"
        }`}
      >
        <Icon name="drag-look" className="size-24 drop-shadow-lg" />
      </div>
    </div>
  );
}
