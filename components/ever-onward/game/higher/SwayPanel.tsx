"use client";

import { canPerformAction } from "@/lib/ever-onward/engine/engine";
import {
  STEADY_ACTION_ID,
  hasSway,
  swayOf,
} from "@/lib/ever-onward/universes/higher/sway";
import { helperLevels } from "@/lib/ever-onward/universes/higher/lines";
import type { PanelProps } from "../../universes/types";
import PanelFrame from "../retro/PanelFrame";
import { pixelClass, retroFocusClass } from "../retro/retroStyles";

/** Width classes for the lean gauge, in tenths. */
const FILL: readonly string[] = [
  "w-0",
  "w-[10%]",
  "w-[20%]",
  "w-[30%]",
  "w-[40%]",
  "w-[50%]",
  "w-[60%]",
  "w-[70%]",
  "w-[80%]",
  "w-[90%]",
  "w-full",
];

const TOWERS = ["block tower", "tower", "tower"] as const;

/**
 * The lean: a taller tower sways, and a swaying tower slows its crew (to half
 * at the very worst, never to nothing). One press of Steady puts it right.
 * Braces, a footing and hard hats make the button needed less and less.
 */
export default function SwayPanel({ def, run, onAct }: PanelProps) {
  if (!hasSway(run) || run.complete || helperLevels(run) < 2) return null;
  const sway = swayOf(run);
  const canSteady = canPerformAction(def, run, STEADY_ACTION_ID);
  const state = sway >= 0.7 ? "wobbling" : sway >= 0.5 ? "leaning" : "upright";
  const fill = FILL[Math.min(10, Math.round(sway * 10))];
  return (
    <PanelFrame
      label="The lean"
      title="Steady the tower"
      icon="/"
      tone="orange"
      status={state}
      statusActive={state !== "upright"}
      testId="bh-sway"
      data={{ "data-state": state }}
      result={
        state === "wobbling"
          ? `The ${TOWERS[run.phase]} is wobbling! The crew has slowed to half speed.`
          : ""
      }
      resultTestId="bh-sway-result"
      resultTone="amber"
    >
      <div
        role="meter"
        aria-label="How far the tower leans"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(sway * 100)}
        className="h-3 w-full bg-black/50"
      >
        <span
          className={`block h-3 ${state === "upright" ? "bg-emerald-400" : state === "leaning" ? "bg-amber-400" : "bg-rose-400"} ${fill}`}
        />
      </div>
      <button
        type="button"
        aria-disabled={!canSteady}
        data-testid="bh-steady"
        onClick={() => {
          if (canSteady) onAct(STEADY_ACTION_ID);
        }}
        className={`${pixelClass} min-h-11 w-full touch-manipulation border-4 px-3 py-2 text-[10px] ${retroFocusClass} ${
          canSteady
            ? "border-orange-200 bg-orange-400 text-orange-950 shadow-[3px_3px_0_#7c2d12] hover:bg-orange-300 active:translate-y-0.5 active:shadow-none"
            : "cursor-not-allowed border-slate-600 bg-slate-900 text-slate-400"
        }`}
      >
        {canSteady ? "Steady it" : "Standing straight"}
      </button>
    </PanelFrame>
  );
}
