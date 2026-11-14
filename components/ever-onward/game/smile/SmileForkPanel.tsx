"use client";

import { canPerformAction } from "@/lib/ever-onward/engine/engine";
import { formatNumber } from "@/lib/ever-onward/engine/format";
import {
  currentFork,
  forkActionId,
  forkCost,
  forkResultLine,
  forkSide,
  isForkOpen,
  type ForkSide,
} from "@/lib/ever-onward/universes/smile/forks";
import type { PanelProps } from "../../universes/types";
import PanelFrame, { type PanelTone } from "../retro/PanelFrame";
import { pixelClass, retroFocusClass } from "../retro/retroStyles";

const TONE_BY_PHASE: readonly PanelTone[] = [
  "amber",
  "orange",
  "violet",
  "sky",
];

const SIDES: readonly ForkSide[] = [0, 1];

/**
 * A fork: one either-or choice for this part of the game, drawn as two cards
 * side by side. Buying one side closes the other for the rest of the run, so
 * each card says what it does and what it costs you, in plain words, before
 * anything is spent.
 */
export default function SmileForkPanel({ def, run, onAct }: PanelProps) {
  const fork = currentFork(run);
  if (run.complete || !isForkOpen(run, fork.id)) return null;

  const chosen = forkSide(run, fork.id);
  const cost = forkCost(fork.id);
  const have = Math.floor(run.resources[fork.currency] ?? 0);

  return (
    <PanelFrame
      label="A choice"
      title={fork.title}
      icon="Y"
      tone={TONE_BY_PHASE[run.phase] ?? "amber"}
      status={chosen === null ? "Pick one of two" : fork.sides[chosen].name}
      statusActive={chosen === null}
      testId="ms-fork"
      data={{
        "data-fork": fork.id,
        "data-chosen": chosen === null ? "none" : chosen,
      }}
      result={chosen === null ? "" : forkResultLine(run, fork.id)}
      resultTestId="ms-fork-result"
    >
      <p className="font-mono text-sm text-slate-200">{fork.prompt}</p>
      <ul className="grid gap-2 sm:grid-cols-2" aria-label="The two choices">
        {SIDES.map((side) => {
          const card = fork.sides[side];
          const isChosen = chosen === side;
          const isClosed = chosen !== null && !isChosen;
          const id = forkActionId(fork.id, side);
          const doable = canPerformAction(def, run, id);
          return (
            <li
              key={card.name}
              data-testid={`ms-fork-${side}`}
              data-state={isChosen ? "chosen" : isClosed ? "closed" : "open"}
              className={`flex flex-col gap-2 border-4 p-3 ${
                isChosen
                  ? "border-amber-300 bg-amber-950/60 shadow-[4px_4px_0_#78350f]"
                  : isClosed
                    ? "border-slate-700 bg-slate-950/90 opacity-70"
                    : "border-slate-500 bg-slate-900 shadow-[4px_4px_0_#0f172a]"
              }`}
            >
              <h3 className={`${pixelClass} text-[10px] text-slate-50`}>
                {card.name}
              </h3>
              <p
                id={`ms-fork-${side}-about`}
                className="font-mono text-sm text-slate-100"
              >
                {card.blurb}
              </p>
              <p
                id={`ms-fork-${side}-catch`}
                className="font-mono text-xs font-bold text-amber-200"
              >
                The catch: {card.catchLine}
              </p>
              <button
                type="button"
                aria-disabled={chosen !== null || !doable}
                aria-describedby={`ms-fork-${side}-about ms-fork-${side}-catch`}
                data-testid={`ms-fork-${side}-choose`}
                onClick={() => {
                  if (chosen === null && doable) onAct(id);
                }}
                className={`${pixelClass} mt-auto min-h-11 touch-manipulation border-4 px-3 py-2 text-[10px] ${retroFocusClass} ${
                  isChosen
                    ? "border-amber-200 bg-amber-400 text-amber-950"
                    : chosen !== null
                      ? "cursor-not-allowed border-slate-700 bg-slate-800 text-slate-400"
                      : doable
                        ? "border-amber-300 bg-amber-950/60 text-amber-300 shadow-[3px_3px_0_#78350f] hover:bg-amber-900/70 active:translate-y-0.5 active:shadow-none"
                        : "cursor-not-allowed border-slate-600 bg-slate-900 text-slate-400"
                }`}
              >
                {isChosen
                  ? "Your choice"
                  : isClosed
                    ? "Closed"
                    : `Choose: ${formatNumber(cost)} ${fork.currency}${
                        doable ? "" : ` (${formatNumber(have)} so far)`
                      }`}
              </button>
            </li>
          );
        })}
      </ul>
    </PanelFrame>
  );
}
