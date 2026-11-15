"use client";

import { useEffect, useState } from "react";
import { useGameStore } from "@/lib/planet-smasher/store";
import type { EndingKind } from "@/lib/planet-smasher/tools";
import { prefersReducedMotion } from "@/components/game-audio/channels";
import { playCue } from "../audio/sfx";
import type { PopulationGrid } from "@/lib/planet-smasher/population";
import { loadPlanetTextures } from "../scene/planetTextures";
import { formatInt } from "./format";

const EMOJI: Record<EndingKind, string> = {
  shatter: "💥",
  molten: "🌋",
  frozen: "🧊",
  consumed: "🤖",
  swallowed: "🕳️",
};

const COUNT_MS = 1200;

/** Counts from 0 up to `target` (straight to it for reduced motion). */
function useCountUp(target: number): number {
  const [shown, setShown] = useState(0);
  const instant = target <= 0 || prefersReducedMotion();
  useEffect(() => {
    if (instant) return;
    const start = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const k = Math.min(1, (now - start) / COUNT_MS);
      setShown(Math.round(target * (1 - (1 - k) ** 3)));
      if (k < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, instant]);
  return instant ? target : shown;
}

/** After an ending: the big emoji, the points earned and New planet. */
export default function EndingOverlay() {
  const phase = useGameStore((s) => s.phase);
  const ending = useGameStore((s) => s.ending);
  const earned = useGameStore((s) => s.planetPoints);
  const planetId = useGameStore((s) => s.progress.planetId);
  const shown = useCountUp(phase === "ended" ? earned : 0);

  if (phase !== "ended" || !ending) return null;

  const newPlanet = () => {
    playCue("newPlanet");
    const start = (grid: PopulationGrid) =>
      useGameStore.getState().newPlanet(grid);
    // The textures are cached, so this resolves at once after the first load.
    // A failed load retries once, then falls back to an even spread over the
    // current grid, so New planet always works.
    loadPlanetTextures(planetId)
      .catch(() => loadPlanetTextures(planetId))
      .then((t) => start(t.population))
      .catch(() => {
        const planet = useGameStore.getState().planet;
        const w = planet?.w ?? 1;
        const h = planet?.h ?? 1;
        start({ w, h, weights: new Float32Array(w * h).fill(1 / (w * h)) });
      });
  };

  return (
    <div
      role="status"
      className="pointer-events-none absolute inset-0 flex items-center justify-center pb-[max(1rem,env(safe-area-inset-bottom))] pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)]"
    >
      <div className="flex flex-col items-center gap-3">
        <span
          aria-hidden="true"
          data-testid="ending-emoji"
          className="animate-[ps-grow_0.6s_ease-out_both] text-8xl drop-shadow-[0_4px_8px_rgba(0,0,0,0.8)] sm:text-9xl"
        >
          {EMOJI[ending]}
        </span>
        <span
          data-testid="ending-points"
          aria-label={`${formatInt(earned)} points earned`}
          className="rounded-full bg-black/60 px-5 py-1 font-mono text-3xl font-black tabular-nums text-yellow-300 sm:text-5xl"
        >
          <span aria-hidden="true">⭐ +{formatInt(shown)}</span>
        </span>
        <button
          type="button"
          onClick={newPlanet}
          className="pointer-events-auto mt-2 min-h-[88px] min-w-[88px] rounded-3xl border-4 border-yellow-300 bg-blue-600 px-8 py-4 text-3xl font-black text-white shadow-2xl active:scale-95 sm:text-4xl"
        >
          <span aria-hidden="true">🔄 </span>New planet
        </button>
      </div>
    </div>
  );
}
