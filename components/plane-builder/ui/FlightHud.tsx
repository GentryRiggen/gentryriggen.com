"use client";

import { TWIST_INFO } from "@/lib/plane-builder/daily/daily";
import { secondsAheadOfGhost } from "@/lib/plane-builder/ghost/ghost";
import { LEVELS } from "@/lib/plane-builder/levels";
import {
  planeStats,
  stallSpeed,
  topSpeed,
} from "@/lib/plane-builder/plane/stats";
import { applyBonuses } from "@/lib/plane-builder/prestige";
import { comboMultiplier } from "@/lib/plane-builder/sim/flight";
import { usePlaneBuilderStore } from "@/lib/plane-builder/state/store";
import useActiveGhost from "../hooks/useActiveGhost";
import useFlightSnapshot from "../hooks/useFlightSnapshot";
import { formatCoins, percentOf } from "./format";
import CloseCallPop from "./CloseCallPop";
import FlightToasts from "./FlightToasts";
import BoostEffect from "./BoostEffect";
import Speedometer from "./Speedometer";

/** A gap smaller than this reads "even" (it would round to +0.0s). */
const EVEN_SECONDS = 0.05;

type FuelTone = "ok" | "low" | "critical";

/** Fuel turns orange when low and red (pulsing) when nearly gone. */
const FUEL_BAR: Record<FuelTone, string> = {
  ok: "bg-emerald-500 dark:bg-emerald-400",
  low: "bg-orange-500 dark:bg-orange-400",
  critical:
    "animate-pulse bg-red-500 motion-reduce:animate-none dark:bg-red-400",
};
const FUEL_RING: Record<FuelTone, string> = {
  ok: "border-white/80 dark:border-slate-700",
  low: "border-orange-500 dark:border-orange-400",
  critical: "border-red-500 dark:border-red-400",
};
const FUEL_TEXT: Record<FuelTone, string> = {
  ok: "",
  low: "text-orange-600 dark:text-orange-300",
  critical: "text-red-600 dark:text-red-300",
};

/**
 * Read-only overlay of the running flight: distance, speed, fuel, shields, and
 * the coin wallet plus what this flight has grabbed so far.
 */
export default function FlightHud() {
  const snapshot = useFlightSnapshot();
  const levelId = usePlaneBuilderStore((s) => s.levelId);
  const lp = usePlaneBuilderStore((s) => s.progress.levels[s.levelId]);
  const level = LEVELS[levelId];
  const bonuses = usePlaneBuilderStore((s) => s.progress.prestige.bonuses);
  const stats = applyBonuses(planeStats(level.plane, lp.tiers), bonuses);
  const daily = usePlaneBuilderStore((s) => s.daily);
  const ghost = useActiveGhost();
  const ghostGap =
    ghost && snapshot
      ? // Frozen at the finish: the plane flies on through the runout.
        secondsAheadOfGhost(
          ghost,
          snapshot.maxX,
          snapshot.finishTime ?? snapshot.time
        )
      : null;

  const maxX = snapshot?.maxX ?? 0;
  const percent = percentOf(maxX, level.finishDistance);
  const bestPercent = percentOf(lp.best, level.finishDistance);
  const fuelPercent =
    stats.fuel > 0 ? Math.round(((snapshot?.fuel ?? 0) / stats.fuel) * 100) : 0;
  const fuelTone: FuelTone =
    fuelPercent <= 12 ? "critical" : fuelPercent <= 35 ? "low" : "ok";
  const shields = snapshot?.shields ?? 0;
  const isFinished = snapshot?.finished ?? false;
  const grabbed = (snapshot?.coins ?? 0) + (snapshot?.nearMissCoins ?? 0);
  const combo = snapshot?.combo ?? 0;
  const isBoosting =
    stats.thrust > 0 &&
    (snapshot?.fuel ?? 0) > 0 &&
    (snapshot?.boost ?? false) &&
    daily?.twist !== "noBoost";

  return (
    <div
      aria-live="off"
      className="pointer-events-none absolute inset-0 z-10 select-none"
    >
      <BoostEffect isActive={isBoosting} />
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
              <div data-testid="flight-fuel" data-tone={fuelTone}>
                <p className="flex w-40 items-baseline justify-between text-sm font-extrabold text-slate-900 drop-shadow dark:text-slate-100">
                  <span>
                    <span aria-hidden="true">⛽ </span>Fuel
                  </span>
                  <span
                    data-testid="flight-fuel-amount"
                    className={`tabular-nums ${FUEL_TEXT[fuelTone]}`}
                  >
                    {fuelPercent <= 0 ? "EMPTY" : `${fuelPercent}%`}
                  </span>
                </p>
                <div
                  role="progressbar"
                  aria-label="Fuel"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={fuelPercent}
                  aria-valuetext={
                    fuelPercent <= 0 ? "Empty" : `${fuelPercent}% left`
                  }
                  className={`mt-0.5 h-4 w-40 overflow-hidden rounded-full border-2 bg-white/70 shadow dark:bg-slate-900/70 ${FUEL_RING[fuelTone]}`}
                >
                  <div
                    className={`h-full rounded-full ${FUEL_BAR[fuelTone]}`}
                    style={{ width: `${fuelPercent}%` }}
                  />
                </div>
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
          <div className="flex flex-col items-end gap-1.5">
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
            {combo > 1 ? (
              <p
                data-testid="combo-chip"
                className="rounded-full bg-sky-100 px-3 py-0.5 text-sm font-bold text-sky-900 shadow dark:bg-sky-900/70 dark:text-sky-100"
              >
                <span aria-hidden="true">🔥 </span>
                Combo ×{comboMultiplier(combo)}
              </p>
            ) : null}
            {daily ? (
              <p
                data-testid="daily-twist"
                className="rounded-full bg-violet-100 px-3 py-0.5 text-sm font-bold text-violet-900 shadow dark:bg-violet-900/70 dark:text-violet-100"
              >
                <span aria-hidden="true">{TWIST_INFO[daily.twist].emoji} </span>
                Daily: {TWIST_INFO[daily.twist].name}
              </p>
            ) : null}
            {ghostGap !== null ? (
              <p
                data-testid="ghost-gap"
                className={`rounded-full px-3 py-0.5 text-sm font-bold shadow ${
                  ghostGap >= 0
                    ? "bg-emerald-100 text-emerald-900 dark:bg-emerald-900/70 dark:text-emerald-100"
                    : "bg-rose-100 text-rose-900 dark:bg-rose-900/70 dark:text-rose-100"
                }`}
              >
                <span aria-hidden="true">👻 </span>
                {Math.abs(ghostGap) < EVEN_SECONDS
                  ? "Ghost: even"
                  : `Ghost: +${Math.abs(ghostGap).toFixed(1)}s ${
                      ghostGap >= 0 ? "ahead" : "behind"
                    }`}
              </p>
            ) : null}
          </div>
        </div>
      </div>
      <FlightToasts />
      <CloseCallPop />
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
