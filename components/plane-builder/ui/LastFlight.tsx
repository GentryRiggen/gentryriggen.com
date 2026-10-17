"use client";

import { useEffect, useRef } from "react";
import type { GaugeZone } from "@/lib/plane-builder/minigame/gauge";
import { LEVELS } from "@/lib/plane-builder/levels";
import type { FlightSummary } from "@/lib/plane-builder/state/store";
import type { LevelId } from "@/lib/plane-builder/levels/types";
import { endLineFor } from "./endLines";
import { formatCoins, percentOf } from "./format";

const BONUS_LABELS: Record<GaugeZone, string> = {
  green: "Jackpot!",
  yellow: "Nice!",
  red: "Kept your coins!",
};

interface LastFlightProps {
  levelId: LevelId;
  flight: FlightSummary;
}

/** How the flight just flown went, at the top of the hangar. */
export default function LastFlight({ levelId, flight }: LastFlightProps) {
  const heading = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    heading.current?.focus();
  }, [flight]);

  const level = LEVELS[levelId];
  const { result, payout } = flight;
  const percent = percentOf(result.distance, level.finishDistance);
  const isAlmost = percent >= 90 && !result.finished;
  const endLine = endLineFor(result.endReason);

  return (
    <section
      aria-label="Flight results"
      className="flex flex-col gap-1 rounded-xl bg-sky-50 p-3 text-center dark:bg-sky-950/60 short:p-2"
    >
      {result.finished ? (
        <p className="font-extrabold text-amber-700 dark:text-amber-300">
          Level complete!
          {flight.unlocked
            ? ` ${LEVELS[flight.unlocked].name} unlocked!`
            : null}
        </p>
      ) : null}
      <h3
        ref={heading}
        tabIndex={-1}
        className="font-semibold focus:outline-none"
      >
        {endLine}
        {flight.isNewBest ? (
          <span className="ml-2 font-extrabold text-sky-700 dark:text-sky-300">
            New best!
          </span>
        ) : null}
      </h3>
      <p className="text-2xl font-extrabold">
        {Math.round(result.distance)} m{" "}
        <span className="text-base font-semibold text-slate-600 dark:text-slate-300">
          ({percent}% of the way)
        </span>
      </p>
      {isAlmost ? (
        <p className="font-bold text-amber-700 dark:text-amber-300">
          Almost there!
        </p>
      ) : null}
      <p className="text-sm text-slate-700 dark:text-slate-200">
        Distance {formatCoins(payout.distancePay)} + coins grabbed{" "}
        {formatCoins(payout.coinPay)} × boost{" "}
        {Number(payout.multiplier.toFixed(2))}
      </p>
      {payout.landingBonus > 0 ? (
        <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-300">
          Nice landing +{formatCoins(payout.landingBonus)}
        </p>
      ) : null}
      {payout.milestoneBonus > 0 ? (
        <p className="text-sm font-semibold text-sky-700 dark:text-sky-300">
          Milestone flags +{formatCoins(payout.milestoneBonus)}
        </p>
      ) : null}
      <p className="text-2xl font-extrabold text-amber-700 dark:text-amber-300">
        <span aria-hidden="true">🪙 </span>
        Total: +{formatCoins(payout.total)}
      </p>
      {flight.bonus ? (
        <p className="font-extrabold text-emerald-700 dark:text-emerald-300">
          {BONUS_LABELS[flight.bonus.zone]}
          {flight.bonus.extra > 0
            ? ` Coins ×${flight.bonus.multiplier}: +${formatCoins(flight.bonus.extra)}`
            : null}
        </p>
      ) : null}
    </section>
  );
}
