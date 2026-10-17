"use client";

import { LEVELS } from "@/lib/plane-builder/levels";
import {
  planeStats,
  stallSpeed,
  topSpeed,
} from "@/lib/plane-builder/plane/stats";
import { usePlaneBuilderStore } from "@/lib/plane-builder/state/store";
import useFlightSnapshot from "../hooks/useFlightSnapshot";
import { formatCoins, percentOf } from "./format";
import Speedometer from "./Speedometer";

/**
 * Read-only overlay of the running flight: distance, speed, fuel, shields, and
 * the coin wallet plus what this flight has grabbed so far.
 */
export default function FlightHud() {
  const snapshot = useFlightSnapshot();
  const levelId = usePlaneBuilderStore((s) => s.levelId);
  const lp = usePlaneBuilderStore((s) => s.progress.levels[s.levelId]);
  const level = LEVELS[levelId];
  const stats = planeStats(level.plane, lp.tiers);

  const maxX = snapshot?.maxX ?? 0;
  const percent = percentOf(maxX, level.finishDistance);
  const bestPercent = percentOf(lp.best, level.finishDistance);
  const fuelPercent =
    stats.fuel > 0 ? Math.round(((snapshot?.fuel ?? 0) / stats.fuel) * 100) : 0;
  const shields = snapshot?.shields ?? 0;
  const isFinished = snapshot?.finished ?? false;
  const grabbed = snapshot?.coins ?? 0;

  return (
    <div
      aria-live="off"
      className="pointer-events-none absolute inset-0 z-10 select-none"
    >
      <div className="absolute inset-x-3 top-3 flex flex-col gap-2">
        <div className="flex items-center gap-3">
          <div
            role="progressbar"
            aria-label="Distance to the finish"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={percent}
            className="relative mx-3 h-4 flex-1 rounded-full bg-white/70 shadow dark:bg-slate-900/70"
          >
            {lp.best > 0 ? (
              <div
                aria-hidden="true"
                className="absolute inset-y-0 w-1 rounded bg-amber-500"
                style={{ left: `${bestPercent}%` }}
              />
            ) : null}
            <div
              aria-hidden="true"
              className="absolute inset-y-0 left-0 rounded-full bg-sky-500 dark:bg-sky-400"
              style={{ width: `${percent}%` }}
            />
            <div
              aria-hidden="true"
              className="absolute -top-1.5 -ml-3 text-xl leading-none"
              style={{ left: `${percent}%` }}
            >
              ✈️
            </div>
          </div>
          <p className="w-12 text-right text-lg font-extrabold text-slate-900 drop-shadow dark:text-slate-100">
            {percent}%
          </p>
        </div>
        <div className="flex items-start justify-between gap-3">
          <div className="flex flex-col gap-1.5">
            <Speedometer
              speed={snapshot?.speed ?? 0}
              stall={stallSpeed(stats)}
              top={topSpeed(stats)}
            />
            {stats.thrust > 0 ? (
              <div
                role="progressbar"
                aria-label="Fuel"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={fuelPercent}
                className="h-3 w-32 rounded-full bg-white/70 shadow dark:bg-slate-900/70"
              >
                <div
                  className="h-full rounded-full bg-orange-500 dark:bg-orange-400"
                  style={{ width: `${fuelPercent}%` }}
                />
              </div>
            ) : null}
            {stats.shields > 0 ? (
              <p
                aria-label={`${shields} shields`}
                className="flex gap-1 text-xl leading-none"
              >
                {Array.from({ length: stats.shields }, (_, i) => (
                  <span
                    key={i}
                    aria-hidden="true"
                    className={i < shields ? "" : "opacity-25 grayscale"}
                  >
                    🛡️
                  </span>
                ))}
              </p>
            ) : null}
          </div>
          <p className="rounded-full bg-amber-100 px-3 py-1 text-lg font-bold text-amber-900 shadow dark:bg-amber-900/70 dark:text-amber-100">
            <span aria-hidden="true">🪙 </span>
            {formatCoins(lp.coins + grabbed)}
            <span className="sr-only"> coins</span>
            {grabbed > 0 ? (
              <span className="ml-1.5 text-base text-amber-700 dark:text-amber-300">
                +{formatCoins(grabbed)}
              </span>
            ) : null}
          </p>
        </div>
      </div>
      {isFinished ? (
        <p
          aria-hidden="true"
          className="pb-finish-banner absolute inset-x-0 top-1/3 text-center text-6xl font-black text-amber-400 drop-shadow-lg"
        >
          FINISH!
        </p>
      ) : null}
      <p aria-live="polite" className="sr-only">
        {isFinished ? "Finish line!" : ""}
      </p>
    </div>
  );
}
