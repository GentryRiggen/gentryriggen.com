"use client";

import { useState } from "react";
import { formatDuration } from "@/lib/ever-onward/engine/format";
import {
  canRestart,
  emberReward,
  prestigeUpgradeCost,
} from "@/lib/ever-onward/engine/prestige";
import type { UniverseDef, UniverseSave } from "@/lib/ever-onward/engine/types";
import {
  cardClass,
  dangerButtonClass,
  focusRingClass,
  primaryButtonClass,
  secondaryButtonClass,
} from "../styles";

interface EmberPanelProps {
  def: UniverseDef;
  universe: UniverseSave;
  onBuy: (id: string) => void;
  onRestart: () => void;
}

/** Embers, permanent upgrades and the restart button (finished or not). */
export default function EmberPanel({
  def,
  universe,
  onBuy,
  onRestart,
}: EmberPanelProps) {
  const { run } = universe;
  const [isConfirming, setIsConfirming] = useState(false);
  const reward = emberReward(def, run);

  return (
    <section
      aria-label="Embers"
      data-testid="lm-embers"
      className={`${cardClass} space-y-3 p-4`}
    >
      {run.complete && (
        <div className="space-y-1">
          <h2 className="text-xl font-bold">The light is still on.</h2>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            You finished {def.title} in {formatDuration(run.time)}. This run
            earns {reward} embers.
            {universe.best !== null &&
              ` Your best time is ${formatDuration(universe.best)}.`}
          </p>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Universe 2 is coming soon.
          </p>
        </div>
      )}
      <div className="flex items-baseline justify-between">
        <h3 className="font-semibold">Embers</h3>
        <span
          data-testid="lm-ember-count"
          className="text-lg font-bold tabular-nums text-orange-600 dark:text-orange-300"
        >
          {universe.embers}
        </span>
      </div>
      <p className="text-sm text-slate-600 dark:text-slate-400">
        Embers buy permanent upgrades. They shape your next run.
      </p>
      <ul className="space-y-2">
        {def.prestige.upgrades.map((u) => {
          const level = universe.prestigeUpgrades[u.id] ?? 0;
          const cost = prestigeUpgradeCost(def, universe, u.id);
          const affordable = cost !== null && universe.embers >= cost;
          return (
            <li key={u.id}>
              <button
                type="button"
                disabled={!affordable}
                onClick={() => onBuy(u.id)}
                className={`w-full touch-manipulation rounded-xl border p-3 text-left disabled:cursor-not-allowed ${focusRingClass} ${
                  affordable
                    ? "border-orange-400 bg-orange-50 hover:bg-orange-100 dark:border-orange-500 dark:bg-orange-950/40 dark:hover:bg-orange-950/70"
                    : "border-slate-200 bg-slate-50 text-slate-600 opacity-80 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-400"
                }`}
              >
                <span className="flex items-baseline justify-between gap-3">
                  <span className="font-semibold">{u.name}</span>
                  <span className="shrink-0 text-sm tabular-nums">
                    {cost === null ? "Max" : `${cost} embers`}
                  </span>
                </span>
                <span className="mt-0.5 block text-sm">{u.description}</span>
                <span className="mt-1 block text-xs">
                  Level {level} of {u.maxLevel}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      {run.complete && (
        <button
          type="button"
          onClick={onRestart}
          className={`${primaryButtonClass} w-full`}
        >
          Play again
        </button>
      )}
      {!run.complete && canRestart(run) && !isConfirming && (
        <button
          type="button"
          onClick={() => setIsConfirming(true)}
          className={`${secondaryButtonClass} w-full`}
        >
          Restart for {reward} embers
        </button>
      )}
      {!run.complete && isConfirming && (
        <div
          role="alertdialog"
          aria-label="Confirm restart"
          className="space-y-2 rounded-xl border border-red-300 bg-red-50 p-3 dark:border-red-800 dark:bg-red-950/40"
        >
          <p className="text-sm">
            Start over from the beginning and keep {reward} embers? Your current
            run will be gone.
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => {
                setIsConfirming(false);
                onRestart();
              }}
              className={dangerButtonClass}
            >
              Yes, restart
            </button>
            <button
              type="button"
              onClick={() => setIsConfirming(false)}
              className={secondaryButtonClass}
            >
              Keep playing
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
