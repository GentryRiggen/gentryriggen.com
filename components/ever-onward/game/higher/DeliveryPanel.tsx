"use client";

import { canPerformAction } from "@/lib/ever-onward/engine/engine";
import {
  LOADS,
  LOAD_COUNT,
  bestLoad,
  isDeliveriesOpen,
  isLoadHere,
  loadActionId,
  loadPaysText,
  loadsPlaced,
} from "@/lib/ever-onward/universes/higher/deliveries";
import { tendingValue } from "@/lib/ever-onward/universes/higher/tick";
import type { PanelProps } from "../../universes/types";
import PanelFrame from "../retro/PanelFrame";
import { pixelClass, retroFocusClass } from "../retro/retroStyles";

const TITLES = [
  "A delivery!",
  "A delivery!",
  "A delivery!",
  "A quiet moment",
] as const;

/**
 * Deliveries: every minute or so a load waits to be placed. Three cards say
 * exactly what each gives, and one is marked as the best right now. A load
 * that is not placed waits as long as it takes.
 */
export default function DeliveryPanel({ def, run, onAct }: PanelProps) {
  if (run.complete || !isDeliveriesOpen(run)) return null;
  const here = isLoadHere(run);
  const value = tendingValue(run);
  const best = here ? bestLoad(run, value) : -1;
  return (
    <PanelFrame
      label="Deliveries"
      title={TITLES[run.phase]}
      icon="▣"
      tone="amber"
      status={here ? "Something has arrived" : "On its way"}
      statusActive={here}
      testId="bh-deliveries"
      data={{ "data-here": here ? "yes" : "no" }}
      result={here ? "" : `${loadsPlaced(run)} placed so far.`}
      resultTestId="bh-deliveries-result"
    >
      <p className="font-mono text-sm text-slate-200">
        {here
          ? "Pick what to do with it. The card marked best helps most right now."
          : "The next one is on its way. Nothing is lost if you wait."}
      </p>
      <ul className="grid gap-2 sm:grid-cols-3" aria-label="The loads">
        {Array.from({ length: LOAD_COUNT }, (_, option) => {
          const id = loadActionId(option);
          const doable = canPerformAction(def, run, id);
          const card = LOADS[run.phase][option];
          return (
            <li
              key={card.name}
              data-testid={`bh-load-${option}`}
              data-best={best === option ? "yes" : "no"}
              className={`flex flex-col gap-1.5 border-4 p-2 ${
                best === option
                  ? "border-amber-300 bg-amber-950/60 shadow-[4px_4px_0_#78350f]"
                  : "border-slate-600 bg-slate-900"
              }`}
            >
              <h3 className={`${pixelClass} text-[10px] text-slate-50`}>
                {card.name}
              </h3>
              <p
                id={`bh-load-${option}-note`}
                className="font-mono text-xs text-slate-200"
              >
                {card.note}
                {here && (
                  <span className="mt-1 block font-bold text-emerald-200 tabular-nums">
                    {loadPaysText(run, option, value)}
                  </span>
                )}
              </p>
              <button
                type="button"
                aria-disabled={!doable}
                aria-describedby={`bh-load-${option}-note`}
                data-testid={`bh-load-${option}-place`}
                onClick={() => {
                  if (doable) onAct(id);
                }}
                className={`${pixelClass} mt-auto min-h-11 touch-manipulation border-4 px-2 py-2 text-[10px] ${retroFocusClass} ${
                  doable
                    ? best === option
                      ? "border-amber-200 bg-amber-400 text-amber-950 shadow-[3px_3px_0_#78350f] hover:bg-amber-300 active:translate-y-0.5 active:shadow-none"
                      : "border-slate-300 bg-slate-700 text-slate-50 hover:bg-slate-600 active:translate-y-0.5"
                    : "cursor-not-allowed border-slate-700 bg-slate-900 text-slate-400"
                }`}
              >
                {doable
                  ? best === option
                    ? "Best: place it"
                    : "Place it"
                  : "Waiting"}
              </button>
            </li>
          );
        })}
      </ul>
    </PanelFrame>
  );
}
