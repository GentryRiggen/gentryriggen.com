"use client";

import { useEffect, useState } from "react";
import { prefersReducedMotion } from "@/components/game-audio/channels";
import { PLANETS } from "@/lib/planet-smasher/planets";
import { useGameStore } from "@/lib/planet-smasher/store";
import { TOOLS } from "@/lib/planet-smasher/tools";
import {
  UNLOCK_PATH,
  nextUnlock,
  type Unlockable,
} from "@/lib/planet-smasher/unlocks";
import { formatInt } from "./format";

const FILL_MS = 1200;

const iconOf = (u: Unlockable): string =>
  u.kind === "tool" ? TOOLS[u.id].icon : PLANETS[u.id].icon;

/** Where the bar starts: the threshold just behind `points`. */
function previousAt(points: number): number {
  let prev = 0;
  for (const e of UNLOCK_PATH) {
    if (e.at <= points) prev = e.at;
    else break;
  }
  return prev;
}

/** Counts from `from` to `to` over FILL_MS (straight to `to` for reduced motion). */
function useAnimatedPoints(from: number | undefined, to: number): number {
  const [shown, setShown] = useState(from ?? to);
  const instant = from === undefined || from >= to || prefersReducedMotion();
  useEffect(() => {
    if (instant) return;
    const start = performance.now();
    const base = from ?? to;
    let raf = 0;
    const tick = (now: number) => {
      const k = Math.min(1, (now - start) / FILL_MS);
      setShown(base + (to - base) * (1 - (1 - k) ** 3));
      if (k < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [from, to, instant]);
  return instant ? to : shown;
}

interface NextUnlockProps {
  /** Animate from these points up to the current ones (the ending overlay). */
  animateFrom?: number;
}

/** The next thing to open as a dark silhouette, a bar and "⭐ 100 / 160". */
export default function NextUnlock({ animateFrom }: NextUnlockProps) {
  const points = useGameStore((s) => s.progress.points);
  const shown = useAnimatedPoints(animateFrom, points);
  const next = nextUnlock(Math.floor(shown));

  if (!next) {
    return (
      <div
        data-testid="next-unlock"
        className="flex items-center gap-2 rounded-full bg-black/55 px-3 py-1 text-sm font-bold text-yellow-200 sm:text-base"
      >
        <span aria-hidden="true" className="text-2xl">
          🏆
        </span>
        <span>All unlocked!</span>
      </div>
    );
  }

  const from = previousAt(shown);
  const fill = Math.min(1, Math.max(0, (shown - from) / (next.at - from)));
  return (
    <div
      data-testid="next-unlock"
      className="flex items-center gap-2 rounded-full bg-black/55 px-3 py-1"
    >
      <span
        aria-hidden="true"
        data-testid="next-unlock-icon"
        className="text-2xl brightness-0 grayscale drop-shadow-[0_0_2px_rgba(255,255,255,0.9)] sm:text-3xl"
      >
        {iconOf(next.item)}
      </span>
      <div className="flex flex-col gap-0.5">
        <div
          role="progressbar"
          aria-label="Next unlock"
          aria-valuemin={0}
          aria-valuemax={next.at}
          aria-valuenow={Math.floor(shown)}
          className="h-2 w-[120px] overflow-hidden rounded-full bg-white/25"
        >
          <div
            data-testid="next-unlock-fill"
            className="h-full origin-left rounded-full bg-yellow-300"
            style={{ transform: `scaleX(${fill})` }}
          />
        </div>
        <span className="font-mono text-xs font-bold tabular-nums text-yellow-200 sm:text-sm">
          ⭐ {formatInt(shown)} / {formatInt(next.at)}
        </span>
      </div>
    </div>
  );
}
