"use client";

import { canPerformAction } from "@/lib/ever-onward/engine/engine";
import { formatNumber } from "@/lib/ever-onward/engine/format";
import {
  LAMP_ACTION_ID,
  PARK_ACTION_ID,
  SWITCH_ACTION_ID,
  darkCutText,
  darkness,
  hasPark,
  isTownOpen,
  lampPrice,
  lampsLeft,
  lampsOf,
  lightLevel,
  lightsSwitchedOn,
  litSteps,
  parkPrice,
  powerBill,
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
  const hasLights = litSteps(run) > 0;
  const isOn = lightsSwitchedOn(run);
  const bill = powerBill(run);
  const bulb = T.lightUpkeep;
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
      {hasLights ? (
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            data-testid="bh-switch"
            aria-pressed={isOn}
            onClick={() => onAct(SWITCH_ACTION_ID)}
            className={`${pixelClass} min-h-11 touch-manipulation border-4 px-3 py-2 text-left text-[10px] ${retroFocusClass} ${
              isOn
                ? "border-amber-200 bg-amber-400 text-amber-950 shadow-[3px_3px_0_#78350f] active:translate-y-0.5 active:shadow-none"
                : "border-slate-500 bg-slate-800 text-slate-200 shadow-[3px_3px_0_#0f172a] active:translate-y-0.5 active:shadow-none"
            }`}
          >
            Lights: {isOn ? "ON" : "OFF"}
          </button>
          <p
            data-testid="bh-power-bill"
            data-bill={Math.round(bill * 100)}
            className="font-mono text-xs text-slate-300"
          >
            Power bill: -{pct(bill)} of your bricks, every second
            {lightLevel(run) > 0.05 && lightLevel(run) < 0.95
              ? " (warming up)"
              : ""}
            . Free to switch, takes about {T.lightWarmSeconds} sec.
          </p>
        </div>
      ) : null}
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
              ? `+ ${Math.round(T.lampRelief * 100)} points off the dark meter`
              : "+ The street glows"}
            <br />
            {lampsLeft(run)
              ? `- Costs ${formatNumber(lampPrice(run))} bricks and ${pct(bulb)} of your bricks, every second`
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
              : `+ ${Math.round(T.parkRelief * 100)} points off the dark meter, the tower leans ${pct(1 - T.parkLean)} less`}
            <br />
            {hasPark(run)
              ? "- Nothing more to buy"
              : `- Costs ${formatNumber(parkPrice(run))} bricks and ${pct(bulb * 2)} of your bricks, every second`}
          </span>
        </button>
      </div>
      <p className="font-mono text-xs text-slate-300">
        Lamps and the park are for keeps, but they only work while the lights
        are on. A festival pays more for every step of light that is on.
      </p>
    </PanelFrame>
  );
}
