"use client";

import { canPerformAction } from "@/lib/ever-onward/engine/engine";
import {
  NC_START_ACTION_ID,
  NC_STOP_ACTION_ID,
  isNcOpen,
  isNoCrane,
  ncFails,
  ncLeft,
  ncWins,
} from "@/lib/ever-onward/universes/higher/sky";
import { TUNING } from "@/lib/ever-onward/universes/higher/tuning";
import type { PanelProps } from "../../universes/types";
import PanelFrame from "../retro/PanelFrame";
import { pixelClass, retroFocusClass } from "../retro/retroStyles";
import { FILL } from "./HatBits";

const K = TUNING.sky;
const pct = (n: number): string => `${Math.round(n * 100)}%`;

/**
 * The no-crane climb: an optional challenge. Switch the crane off and hoist
 * by hand for a while at a much lower pay. Get through and the tower pays
 * more for good; a gust or a snap ends it early. It opens with the first
 * cloud crane (there has to be a crane to switch off).
 */
export default function NoCranePanel({ def, run, onAct }: PanelProps) {
  if (!isNcOpen(run)) return null;
  const on = isNoCrane(run);
  const wins = ncWins(run);
  const canStart = canPerformAction(def, run, NC_START_ACTION_ID);
  const left = ncLeft(run);
  const done = Math.min(1, Math.max(0, 1 - left / K.ncSeconds));
  return (
    <PanelFrame
      label="The no-crane climb"
      title="The no-crane climb"
      icon="/"
      tone="lime"
      status={
        on ? `${left} sec to go` : wins >= K.ncMax ? "all badges" : "ready"
      }
      statusActive={on}
      testId="bh-nocrane"
      data={{ "data-on": on ? "1" : "0", "data-badges": wins }}
      result={
        wins > 0
          ? `${wins} of ${K.ncMax} badges. The tower pays +${pct(K.ncBonus * wins)} for good.`
          : ncFails(run) > 0
            ? "Not yet. A gust or a snap ended it."
            : ""
      }
      resultTestId="bh-nocrane-result"
      resultTone="emerald"
    >
      <p className="font-mono text-xs text-slate-200">
        Turn the crane off for {K.ncSeconds} sec and hoist by hand. Beams drop
        to {pct(K.ncPay)}. A gust or a snap ends the climb, and a failed one
        leaves the crew resting for {K.ncFailSeconds} sec. Make it and the tower
        pays +{pct(K.ncBonus)} for good (up to {K.ncMax} badges). You cannot tie
        down while the crane is off.
      </p>
      {on && (
        <div
          role="meter"
          aria-label="How much of the climb is done"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(done * 100)}
          className="h-3 w-full bg-black/50"
        >
          <span
            className={`block h-3 bg-lime-400 ${FILL[Math.round(done * 10)]}`}
          />
        </div>
      )}
      <button
        type="button"
        aria-disabled={on ? false : !canStart}
        data-testid={on ? "bh-nocrane-stop" : "bh-nocrane-start"}
        onClick={() => {
          if (on) onAct(NC_STOP_ACTION_ID);
          else if (canStart) onAct(NC_START_ACTION_ID);
        }}
        className={`${pixelClass} min-h-11 w-full touch-manipulation border-4 px-3 py-2 text-[10px] ${retroFocusClass} ${
          on || canStart
            ? "border-lime-200 bg-lime-400 text-lime-950 shadow-[3px_3px_0_#365314] hover:bg-lime-300 active:translate-y-0.5 active:shadow-none"
            : "cursor-not-allowed border-slate-600 bg-slate-900 text-slate-400"
        }`}
      >
        {on
          ? "Crane back on"
          : wins >= K.ncMax
            ? "All badges earned"
            : "Turn the crane off"}
      </button>
    </PanelFrame>
  );
}
