"use client";

import { LEVELS } from "@/lib/plane-builder/levels";
import type { EndReason } from "@/lib/plane-builder/sim/flight";
import { usePlaneBuilderStore } from "@/lib/plane-builder/state/store";
import FinishCard from "./FinishCard";
import { formatCoins, percentOf } from "./format";
import { cardClass, primaryButtonClass, secondaryButtonClass } from "./styles";

const END_LINES: Partial<Record<EndReason, string>> = {
  crash: "You crashed!",
  landed: "Nice landing!",
  stalled: "You ran out of speed.",
};

export default function Results() {
  const levelId = usePlaneBuilderStore((s) => s.levelId);
  const last = usePlaneBuilderStore((s) => s.lastFlight);
  const openLevel = usePlaneBuilderStore((s) => s.openLevel);
  const flyAgain = usePlaneBuilderStore((s) => s.flyAgain);
  if (!last) return null;

  const level = LEVELS[levelId];
  const { result, payout } = last;
  const percent = percentOf(result.distance, level.finishDistance);
  const isAlmost = percent >= 90 && !result.finished;
  const endLine = END_LINES[result.endReason];

  return (
    <div className="pointer-events-none absolute inset-0 z-10 flex items-end justify-center p-3 sm:items-center">
      <section
        aria-label="Flight results"
        className={`pointer-events-auto flex max-h-full w-full max-w-md flex-col gap-3 overflow-y-auto p-4 text-center ${cardClass}`}
      >
        {result.finished ? <FinishCard unlocked={last.unlocked} /> : null}
        {last.isNewBest ? (
          <p className="text-xl font-extrabold text-sky-700 dark:text-sky-300">
            New best!
          </p>
        ) : null}
        {endLine ? <p className="text-lg font-semibold">{endLine}</p> : null}
        <p className="text-3xl font-extrabold">
          {Math.round(result.distance)} m
        </p>
        <p className="text-slate-600 dark:text-slate-300">
          {percent}% of the way
        </p>
        {isAlmost ? (
          <p className="font-bold text-amber-700 dark:text-amber-300">
            Almost there!
          </p>
        ) : null}
        <p className="text-slate-700 dark:text-slate-200">
          {formatCoins(payout.distancePay)} + {formatCoins(payout.coinPay)}{" "}
          coins × {Number(payout.multiplier.toFixed(2))}
        </p>
        <p className="text-3xl font-extrabold text-amber-700 dark:text-amber-300">
          +🪙{formatCoins(payout.total)}
        </p>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => openLevel(levelId)}
            className={`${secondaryButtonClass} flex-1`}
          >
            Upgrade
          </button>
          <button
            type="button"
            onClick={flyAgain}
            className={`${primaryButtonClass} flex-1`}
          >
            Fly again
          </button>
        </div>
      </section>
    </div>
  );
}
