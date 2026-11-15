"use client";

import { useState } from "react";
import { useGameStore } from "@/lib/planet-smasher/store";

/** First-play nudge: a pulsing finger over the planet until the first hit. */
export default function TapHint() {
  const points = useGameStore((s) => s.progress.points);
  const hit = useGameStore((s) => s.lastHit !== null);
  // Once a hit lands this session the hint is done, even if the planet resets.
  const [hitSeen, setHitSeen] = useState(hit);
  if (hit && !hitSeen) setHitSeen(true);
  if (points > 0 || hit || hitSeen) return null;
  return (
    <div
      data-testid="tap-hint"
      className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center"
    >
      <span
        aria-hidden="true"
        className="animate-[ps-tap_1.1s_ease-in-out_infinite] text-8xl drop-shadow-[0_4px_6px_rgba(0,0,0,0.8)] sm:text-9xl"
      >
        👆
      </span>
      <span className="rounded-full bg-black/60 px-4 py-1 text-2xl font-black text-yellow-300 sm:text-4xl">
        Tap!
      </span>
    </div>
  );
}
