"use client";

import type { ReactNode } from "react";
import { PLANETS } from "@/lib/planet-smasher/planets";
import { useGameStore } from "@/lib/planet-smasher/store";
import HealthBar from "./HealthBar";
import Odometer from "./Odometer";
import { formatInt } from "./format";

/** The red "-1,204,883" that floats up after each hit. */
function PopOff() {
  const hit = useGameStore((s) => s.lastHit);
  if (!hit) return null;
  return (
    <span
      key={hit.seq}
      data-testid="popoff"
      className="pointer-events-none absolute left-1/2 top-full mt-1 -translate-x-1/2 animate-[ps-popoff_1s_ease-out_forwards] whitespace-nowrap font-mono text-xl font-black text-red-500 drop-shadow-[0_2px_3px_rgba(0,0,0,0.9)] sm:text-3xl"
    >
      −{formatInt(hit.peopleLost)}
    </span>
  );
}

interface HudProps {
  /** The top-left slot (the planet picker). */
  left?: ReactNode;
}

/** Population, health and points along the top edge. */
export default function Hud({ left }: HudProps) {
  const planetId = useGameStore((s) => s.progress.planetId);
  const points = useGameStore((s) => s.progress.points);
  const start = PLANETS[planetId].population;
  return (
    <div className="pointer-events-none absolute inset-x-0 top-0 grid grid-cols-[1fr_auto_1fr] items-start gap-2 pl-[max(0.75rem,env(safe-area-inset-left))] pr-[max(0.75rem,env(safe-area-inset-right))] pt-[max(0.75rem,env(safe-area-inset-top))]">
      <div className="pointer-events-auto justify-self-start">{left}</div>
      <div className="relative flex w-[min(78vw,26rem)] flex-col items-center gap-2 sm:w-[28rem]">
        <div className="flex items-center gap-2">
          <Odometer key={planetId} value={start} />
          <span className="text-3xl sm:text-5xl" aria-hidden="true">
            {PLANETS[planetId].peopleIcon}
          </span>
        </div>
        <HealthBar />
        <PopOff />
      </div>
      <div className="justify-self-end rounded-full bg-black/55 px-3 py-1 font-mono text-xl font-black tabular-nums text-yellow-300 sm:text-3xl">
        <span aria-hidden="true">⭐ </span>
        <span aria-label={`${formatInt(points)} points`}>
          {formatInt(points)}
        </span>
      </div>
    </div>
  );
}
