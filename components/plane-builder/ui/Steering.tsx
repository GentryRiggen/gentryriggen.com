"use client";

import { useRef, useState } from "react";
import useFlightKeys from "../hooks/useFlightKeys";
import useFlightSnapshot from "../hooks/useFlightSnapshot";
import { stickFromDrag } from "@/lib/plane-builder/sim/aim";
import { flightInput } from "@/lib/plane-builder/state/flightInput";
import { usePlaneBuilderStore } from "@/lib/plane-builder/state/store";

const STICK_RADIUS = 80;

interface Drag {
  id: number;
  x: number;
  y: number;
  dx: number;
  dy: number;
}

/**
 * The flight screen's controls: drag anywhere to steer, hold Boost, or use
 * the keyboard. Writes the shared `flightInput` the sim reads each step.
 */
export default function Steering() {
  useFlightKeys();
  const snapshot = useFlightSnapshot();
  const engineTier = usePlaneBuilderStore(
    (s) => s.progress.levels[s.levelId].tiers.engine
  );
  const isNoBoost = usePlaneBuilderStore((s) => s.daily?.twist === "noBoost");
  const [drag, setDrag] = useState<Drag | null>(null);
  const dragRef = useRef<Drag | null>(null);
  const [isBoosting, setIsBoosting] = useState(false);
  const canBoost = engineTier > 0 && (snapshot?.fuel ?? 0) > 0 && !isNoBoost;

  function update(next: Drag | null) {
    dragRef.current = next;
    setDrag(next);
  }

  function handlePointerDown(event: React.PointerEvent<HTMLDivElement>) {
    if (dragRef.current) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    update({
      id: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      dx: 0,
      dy: 0,
    });
  }

  function handlePointerMove(event: React.PointerEvent<HTMLDivElement>) {
    const start = dragRef.current;
    if (!start || start.id !== event.pointerId) return;
    const dx = event.clientX - start.x;
    const dy = event.clientY - start.y;
    const stick = stickFromDrag(dx, dy, STICK_RADIUS);
    flightInput.pitch = stick.pitch;
    flightInput.bank = stick.bank;
    update({ ...start, dx, dy });
  }

  function handlePointerEnd(event: React.PointerEvent<HTMLDivElement>) {
    if (dragRef.current?.id !== event.pointerId) return;
    flightInput.pitch = 0;
    flightInput.bank = 0;
    update(null);
  }

  function setBoost(on: boolean) {
    flightInput.boost = on;
    setIsBoosting(on);
  }

  const knob = drag
    ? {
        x: Math.max(-STICK_RADIUS, Math.min(STICK_RADIUS, drag.dx)),
        y: Math.max(-STICK_RADIUS, Math.min(STICK_RADIUS, drag.dy)),
      }
    : null;

  return (
    <div
      data-testid="steering-layer"
      className="pointer-events-auto absolute inset-0 z-10 touch-none select-none"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerEnd}
      onPointerCancel={handlePointerEnd}
    >
      {drag && knob ? (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute size-40 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white/60 bg-white/10 dark:border-slate-200/50"
          style={{ left: drag.x, top: drag.y }}
        >
          <div
            className="absolute left-1/2 top-1/2 size-12 -ml-6 -mt-6 rounded-full bg-white/70 shadow dark:bg-slate-200/70"
            style={{ transform: `translate(${knob.x}px, ${knob.y}px)` }}
          />
        </div>
      ) : null}
      <button
        type="button"
        aria-label="Boost"
        disabled={!canBoost}
        // Lit for keyboard boost too, so Shift or Space shows on screen.
        aria-pressed={isBoosting || (canBoost && (snapshot?.boost ?? false))}
        onPointerDown={(event) => {
          event.stopPropagation();
          event.currentTarget.setPointerCapture(event.pointerId);
          setBoost(true);
        }}
        onPointerUp={() => setBoost(false)}
        onPointerCancel={() => setBoost(false)}
        onLostPointerCapture={() => setBoost(false)}
        className="absolute bottom-6 right-6 flex size-20 touch-none select-none items-center justify-center rounded-full bg-orange-500 text-base font-extrabold text-white shadow-lg ring-4 ring-white/70 hover:bg-orange-400 disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-sky-700 dark:focus-visible:ring-sky-300 aria-pressed:bg-orange-300 aria-pressed:text-orange-950 dark:bg-orange-600 dark:ring-slate-200/40 dark:aria-pressed:bg-orange-400"
      >
        Boost
      </button>
    </div>
  );
}
