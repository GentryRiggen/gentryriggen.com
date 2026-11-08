"use client";

import { canPerformAction } from "@/lib/ever-onward/engine/engine";
import { formatNumber } from "@/lib/ever-onward/engine/format";
import {
  LAMP_ACTION_ID,
  PARK_ACTION_ID,
  darkCutText,
  darkness,
  hasPark,
  isTownOpen,
  lampPrice,
  lampsLeft,
  lampsOf,
  parkPrice,
} from "@/lib/ever-onward/universes/higher/town";
import { TUNING } from "@/lib/ever-onward/universes/higher/tuning";
import type { PanelProps } from "../../universes/types";
import PanelFrame from "../retro/PanelFrame";
import { pixelClass, retroFocusClass } from "../retro/retroStyles";
import { FILL } from "./HatBits";

const pct = (n: number): string => `${Math.round(n * 100)}%`;

/**
 * The shadow: the taller the tower, the darker the town, and a dark town
 * sends fewer bricks. Lamps and a park take some of the dark away, and cost
 * bricks that would have climbed the tower. The panel shows both sides, and
 * not which is worth it: that depends on how tall the tower is, how much of
 * the part is left, and what the day wants.
 */
export default function ShadowPanel({ def, run, onAct }: PanelProps) {
  if (!isTownOpen(run)) return null;
  const dark = darkness(run);
  const fill = FILL[Math.min(10, Math.round(dark * 10))];
  const canLamp = canPerformAction(def, run, LAMP_ACTION_ID);
  const canPark = canPerformAction(def, run, PARK_ACTION_ID);
  const T = TUNING.town;
  const lit = lampsOf(run);
  return (
    <PanelFrame
      label="The shadow over the town"
      title="The tower's shadow"
      icon="/"
      tone="violet"
      status={dark < 0.1 ? "bright" : dark < 0.5 ? "dim" : "dark"}
      statusActive={dark >= 0.5}
      testId="bh-shadow"
      data={{ "data-dark": Math.round(dark * 100), "data-lamps": lit }}
      result={darkCutText(run)}
      resultTestId="bh-shadow-cut"
      resultTone="amber"
    >
      <div
        role="meter"
        aria-label="How dark the town is"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(dark * 100)}
        className="h-3 w-full bg-black/50"
      >
        <span
          className={`block h-3 ${dark >= 0.5 ? "bg-violet-400" : "bg-amber-300"} ${fill}`}
        />
      </div>
      <p className="font-mono text-xs text-slate-300">
        The taller the tower, the darker the town, and a dark town sends fewer
        bricks.
      </p>
      <div className="grid gap-2 sm:grid-cols-2">
        <button
          type="button"
          aria-disabled={!canLamp}
          data-testid="bh-lamps"
          onClick={() => {
            if (canLamp) onAct(LAMP_ACTION_ID);
          }}
          className={`${pixelClass} min-h-11 w-full touch-manipulation space-y-1 border-4 p-2 text-left text-[10px] ${retroFocusClass} ${
            canLamp
              ? "border-amber-200 bg-amber-400 text-amber-950 shadow-[3px_3px_0_#78350f] hover:bg-amber-300 active:translate-y-0.5 active:shadow-none"
              : "cursor-not-allowed border-slate-600 bg-slate-900 text-slate-400"
          }`}
        >
          <span className="block">
            {lampsLeft(run)
              ? `Street lamps ${lit + 1} of ${T.lampSeconds.length}`
              : "All street lamps lit"}
          </span>
          <span className="block font-mono text-xs leading-snug font-bold normal-case">
            {lampsLeft(run)
              ? `+ The dark bites ${pct(T.lampRelief)} less`
              : "+ The street glows"}
            <br />
            {lampsLeft(run)
              ? `- Costs ${formatNumber(lampPrice(run))} bricks`
              : "- Nothing more to buy"}
          </span>
        </button>
        <button
          type="button"
          aria-disabled={!canPark}
          data-testid="bh-park"
          onClick={() => {
            if (canPark) onAct(PARK_ACTION_ID);
          }}
          className={`${pixelClass} min-h-11 w-full touch-manipulation space-y-1 border-4 p-2 text-left text-[10px] ${retroFocusClass} ${
            canPark
              ? "border-emerald-200 bg-emerald-400 text-emerald-950 shadow-[3px_3px_0_#064e3b] hover:bg-emerald-300 active:translate-y-0.5 active:shadow-none"
              : "cursor-not-allowed border-slate-600 bg-slate-900 text-slate-400"
          }`}
        >
          <span className="block">
            {hasPark(run) ? "The park is open" : "A park with lights"}
          </span>
          <span className="block font-mono text-xs leading-snug font-bold normal-case">
            {hasPark(run)
              ? "+ Trees and lanterns glow"
              : `+ The dark bites ${pct(T.parkRelief)} less`}
            <br />
            {hasPark(run)
              ? "- Nothing more to buy"
              : `- Costs ${formatNumber(parkPrice(run))} bricks`}
          </span>
        </button>
      </div>
      <p className="font-mono text-xs text-slate-300">
        Lights are for keeps. A festival pays more for every step of light.
      </p>
    </PanelFrame>
  );
}
