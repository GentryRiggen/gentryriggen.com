"use client";

import { useState } from "react";
import { formatDuration } from "@/lib/ever-onward/engine/format";
import {
  canRestart,
  emberReward,
  prestigeLabel,
  prestigeUpgradeCost,
} from "@/lib/ever-onward/engine/prestige";
import type { UniverseDef, UniverseSave } from "@/lib/ever-onward/engine/types";
import { uiFor } from "../universes";
import RetroHeading from "./retro/RetroHeading";
import {
  pixelClass,
  retroDangerButtonClass,
  retroFocusClass,
  retroPanelClass,
  retroPrimaryButtonClass,
  retroSecondaryButtonClass,
} from "./retro/retroStyles";

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
  const label = prestigeLabel(def);
  const plural = label.toLowerCase();

  return (
    <section
      aria-label={label}
      data-testid="lm-embers"
      className={`${retroPanelClass} space-y-4 p-4`}
    >
      {run.complete && (
        <div className="space-y-1">
          <RetroHeading
            as="h2"
            className="text-sm leading-relaxed sm:text-base"
          >
            {uiFor(def.id).copy.stillGoing}
          </RetroHeading>
          <p className="font-mono text-sm text-slate-200">
            You finished {def.title} in {formatDuration(run.time)}. This run
            earns {reward} {plural}.
            {universe.best !== null &&
              ` Your best time is ${formatDuration(universe.best)}.`}
          </p>
          <p className="font-mono text-sm text-slate-200">
            Universe 2 is coming soon.
          </p>
        </div>
      )}
      <div className="flex items-baseline justify-between">
        <h3 className={`${pixelClass} text-xs text-orange-200`}>{label}</h3>
        <span
          data-testid="lm-ember-count"
          className={`${pixelClass} text-lg tabular-nums text-orange-300 [text-shadow:2px_2px_0_#7c2d12]`}
        >
          {universe.embers}
        </span>
      </div>
      <p className="font-mono text-sm text-slate-200">
        {label} buy permanent upgrades. They shape your next run.
      </p>
      <ul className="space-y-3">
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
                className={`block w-full touch-manipulation border-4 p-3 text-left transition-transform disabled:cursor-not-allowed ${retroFocusClass} ${
                  affordable
                    ? "border-orange-300 bg-orange-950/50 text-orange-50 shadow-[4px_4px_0_#7c2d12] hover:bg-orange-900/60 active:translate-y-0.5 active:shadow-none"
                    : "border-slate-700 bg-slate-950/85 text-slate-400 shadow-[4px_4px_0_#0f172a]"
                }`}
              >
                <span className="flex items-start justify-between gap-3">
                  <span
                    className={`${pixelClass} min-w-0 text-[10px] leading-relaxed ${affordable ? "text-orange-200" : "text-slate-300"}`}
                  >
                    <span aria-hidden="true" className="mr-2">
                      ▶︎
                    </span>
                    {u.name}
                  </span>
                  <span
                    className={`${pixelClass} shrink-0 text-[10px] tabular-nums`}
                  >
                    {cost === null ? "Max" : `${cost} ${plural}`}
                  </span>
                </span>
                <span className="mt-2 block font-mono text-sm">
                  {u.description}
                </span>
                <span className="mt-2 block font-mono text-xs text-slate-300">
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
          className={`${retroPrimaryButtonClass} w-full`}
        >
          Play again
        </button>
      )}
      {!run.complete && canRestart(run) && !isConfirming && (
        <button
          type="button"
          onClick={() => setIsConfirming(true)}
          className={`${retroSecondaryButtonClass} w-full`}
        >
          Restart for {reward} {plural}
        </button>
      )}
      {!run.complete && isConfirming && (
        <div
          role="alertdialog"
          aria-label="Confirm restart"
          className="space-y-3 border-4 border-red-400 bg-red-950/60 p-3"
        >
          <p className="font-mono text-sm text-red-50">
            Start over from the beginning and keep {reward} {plural}? Your
            current run will be gone.
          </p>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => {
                setIsConfirming(false);
                onRestart();
              }}
              className={retroDangerButtonClass}
            >
              Yes, restart
            </button>
            <button
              type="button"
              onClick={() => setIsConfirming(false)}
              className={retroSecondaryButtonClass}
            >
              Keep playing
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
